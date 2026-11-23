import { onAuthStateChanged, type User } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountAuthModal } from './components/AccountAuthModal.tsx';
import { AgeGateModal } from './components/AgeGateModal.tsx';
import { ChatsView } from './components/ChatsView.tsx';
import { ControlModeView } from './components/ControlModeView.tsx';
import { CoupleHeroStrip } from './components/CoupleHeroStrip.tsx';
import { DeviceBridgeModal } from './components/DeviceBridgeModal.tsx';
import { InstallAppModal } from './components/InstallAppModal.tsx';
import { MembershipView } from './components/MembershipView.tsx';
import { MobileBottomNav } from './components/MobileBottomNav.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { QrPairingModal } from './components/QrPairingModal.tsx';
import { SmartwatchQrModal } from './components/SmartwatchQrModal.tsx';
import { SoloModeView } from './components/SoloModeView.tsx';
import { TopBar } from './components/TopBar.tsx';
import { VideoModeView } from './components/VideoModeView.tsx';
import { WatchHapticVisualizer } from './components/WatchHapticVisualizer.tsx';
import { WatchReceiverView } from './components/WatchReceiverView.tsx';
import { getCurrentWeekOfYear } from './data/weeklyOffers.ts';
import { audioHapticEngine } from './engines/audioHapticEngine.ts';
import { dispatchWatchHaptic, setWatchQrPulseSender } from './engines/bluetoothBridge.ts';
import {
  auth,
  isUserContactVerified,
  loadVerifiedUserProfile,
  type VerifiedAccountProfile,
} from './firebase.ts';
import { detectInitialPlatform, generateClientId } from './utils/platform.ts';
import type {
  AddOnId,
  AddOnPackage,
  AppMode,
  ConversionCurve,
  EarbudDeviceState,
  HapticFrame,
  PartnerMember,
  PlanTierId,
  PlatformType,
  PulsePattern,
  RoomChatMessage,
  SoundscapeTrack,
  SubscriptionPlan,
  SubscriptionSession,
  SuggestedPulse,
  WatchDeviceState,
} from './types.ts';

const INITIAL_FRAME: HapticFrame = {
  intensity: 0,
  frequencyHz: 48,
  subBassEnergy: 0,
  midEnergy: 0,
  pattern: 'wave',
  sourceMode: 'solo',
  timestamp: Date.now(),
};

function getInitialRoomAndMode(): {
  room: string;
  mode: AppMode;
  watchPair: string | null;
} {
  if (typeof window === 'undefined') return { room: 'WMD-4821', mode: 'solo', watchPair: null };
  const params = new URLSearchParams(window.location.search);
  const watchPairRaw = params.get('watchPair');
  const watchPair = watchPairRaw
    ? watchPairRaw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20) || null
    : null;
  const param = params.get('room');
  if (param) {
    const cleaned = param.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
    if (cleaned) return { room: cleaned, mode: 'control', watchPair };
  }
  return { room: 'WMD-4821', mode: 'solo', watchPair };
}

function getInitialAgeVerified(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem('wmd_age_18_ok') === 'true';
  } catch {
    return false;
  }
}

function getInitialWatchSetupDone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem('wmd_watch_qr_done') === 'true';
  } catch {
    return false;
  }
}

export default function App() {
  const initialBoot = getInitialRoomAndMode();
  const [ageVerified18Plus, setAgeVerified18Plus] = useState<boolean>(getInitialAgeVerified);
  const [watchPairReceiverCode, setWatchPairReceiverCode] = useState<string | null>(
    initialBoot.watchPair
  );
  const [watchCode, setWatchCode] = useState<string>(() => {
    const rand = Math.floor(100 + Math.random() * 900);
    return `WMD-W${rand}`;
  });
  const [watchOnboardingDone, setWatchOnboardingDone] = useState<boolean>(
    () => Boolean(initialBoot.watchPair) || getInitialWatchSetupDone()
  );
  const [watchQrModalOpen, setWatchQrModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [accountProfile, setAccountProfile] = useState<VerifiedAccountProfile | null>(null);
  const [lastWatchReceiverPulse, setLastWatchReceiverPulse] = useState<{
    intensity: number;
    frequencyHz: number;
    timestamp: number;
  } | null>(null);

  const [activeMode, setActiveMode] = useState<AppMode>(initialBoot.mode);
  const [platform, setPlatform] = useState<PlatformType>(detectInitialPlatform);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);

  const handleConfirm18Plus = useCallback(() => {
    setAgeVerified18Plus(true);
    try {
      window.sessionStorage.setItem('wmd_age_18_ok', 'true');
    } catch {
      // Ignore storage error in restricted Safari modes
    }
  }, []);

  const handleCompleteWatchOnboarding = useCallback(() => {
    setWatchOnboardingDone(true);
    setWatchQrModalOpen(false);
    try {
      window.sessionStorage.setItem('wmd_watch_qr_done', 'true');
    } catch {
      // Ignore storage error in restricted Safari modes
    }
  }, []);

  // Listen to Firebase Auth state & load verified user profile from Firestore
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user && isUserContactVerified(user)) {
        void loadVerifiedUserProfile(user)
          .then((loaded) => {
            if (loaded) {
              setAccountProfile(loaded);
              setUserName(loaded.displayName);
            } else if (user.displayName) {
              setUserName(user.displayName);
            }
          })
          .catch(() => {
            // Structured error already logged inside loadVerifiedUserProfile
          });
      } else {
        setAccountProfile(null);
      }
    });
    return unsub;
  }, []);

  // Audio-Haptic State
  const [frame, setFrame] = useState<HapticFrame>(INITIAL_FRAME);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [curve, setCurve] = useState<ConversionCurve>('sub-bass');
  const [watchIntensityScale, setWatchIntensityScale] = useState(82);
  const [earbudVolume, setEarbudVolume] = useState(76);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);

  // Paired Dual Devices
  const [watch, setWatch] = useState<WatchDeviceState>({
    connected: false,
    name: 'Smartwatch Bridge',
    platformBridge: 'virtual-wrist',
    batteryLevel: null,
    firmwareNote: 'Virtual wrist pulse active',
  });
  const [earbud, setEarbud] = useState<EarbudDeviceState>({
    connected: true,
    deviceId: 'default',
    label: 'Earbuds / System Audio',
    volume: 76,
    balance: 0,
  });

  // WebSocket Partner Room State
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [roomId, setRoomId] = useState(initialBoot.room);
  const [userName, setUserName] = useState('You');
  const [selfId, setSelfId] = useState<string | null>(null);
  const [members, setMembers] = useState<PartnerMember[]>([]);
  const [roomMessages, setRoomMessages] = useState<RoomChatMessage[]>([]);
  const [broadcastAudioToPartner, setBroadcastAudioToPartner] = useState(false);
  const [lastReceivedNote, setLastReceivedNote] = useState<string | null>(null);
  const [syncVideoWithPartner, setSyncVideoWithPartner] = useState(false);
  const [remoteVideoCommand, setRemoteVideoCommand] = useState<{
    action: 'play' | 'pause' | 'seek';
    currentTime: number;
    seq: number;
  } | null>(null);

  // Subscription & Add-On State (token kept strictly in React memory)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [addOns, setAddOns] = useState<AddOnPackage[]>([]);
  const [session, setSession] = useState<SubscriptionSession>({
    planId: 'free',
    active: false,
    addOnImageUnlocked: false,
    addOnVideoUnlocked: false,
    videoSecondsUsedThisWeek: 0,
    videoSecondsWeeklyLimit: 20,
    currentWeekNumber: getCurrentWeekOfYear(),
    expiresAt: null,
    token: null,
  });

  // Fetch subscription plans and add-ons on mount
  useEffect(() => {
    void fetch('/api/subscription/plans')
      .then((r) => r.json())
      .then(
        (data: {
          plans?: SubscriptionPlan[];
          addOns?: AddOnPackage[];
          currentWeekNumber?: number;
        }) => {
          if (Array.isArray(data.plans)) setPlans(data.plans);
          if (Array.isArray(data.addOns)) setAddOns(data.addOns);
          if (typeof data.currentWeekNumber === 'number') {
            setSession((prev) => ({
              ...prev,
              currentWeekNumber: data.currentWeekNumber!,
            }));
          }
        }
      )
      .catch(() => {
        // Ignore transient offline error
      });
  }, []);

  // Refs for 60fps loop access without tearing down subscription
  const watchRef = useRef(watch);
  watchRef.current = watch;
  const vibrateRef = useRef(vibrateEnabled);
  vibrateRef.current = vibrateEnabled;
  const broadcastAudioRef = useRef(broadcastAudioToPartner);
  broadcastAudioRef.current = broadcastAudioToPartner;
  const lastWsPulseSentRef = useRef(0);

  // Subscribe to Web Audio -> Haptic frame engine
  useEffect(() => {
    const unsubscribe = audioHapticEngine.subscribe((nextFrame) => {
      setFrame(nextFrame);
      dispatchWatchHaptic(
        nextFrame.intensity,
        nextFrame.frequencyHz,
        watchRef.current.platformBridge,
        vibrateRef.current
      );

      if (
        broadcastAudioRef.current &&
        nextFrame.intensity > 5 &&
        wsRef.current?.readyState === WebSocket.OPEN
      ) {
        const now = performance.now();
        if (now - lastWsPulseSentRef.current >= 70) {
          lastWsPulseSentRef.current = now;
          wsRef.current.send(
            JSON.stringify({
              type: 'haptic:pulse',
              intensity: nextFrame.intensity,
              frequencyHz: nextFrame.frequencyHz,
              pattern: nextFrame.pattern,
              sourceMode: nextFrame.sourceMode,
            })
          );
        }
      }
    });
    return unsubscribe;
  }, []);

  const watchCodeRef = useRef(watchCode);
  watchCodeRef.current = watchCode;

  // Forward live haptic frames to QR-linked smartwatch when active
  useEffect(() => {
    setWatchQrPulseSender((intensity, frequencyHz) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'watch:pulse',
            watchCode: watchCodeRef.current,
            intensity,
            frequencyHz,
          })
        );
      }
    });
    return () => setWatchQrPulseSender(null);
  }, []);

  // Connect & auto-reconnect WebSocket room & watch QR relay
  useEffect(() => {
    let closed = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsConnected(true);
        if (watchPairReceiverCode) {
          socket.send(
            JSON.stringify({
              type: 'watch:join',
              watchCode: watchPairReceiverCode,
              watchName: 'QR Paired Smartwatch',
            })
          );
          return;
        }
        socket.send(
          JSON.stringify({
            type: 'watch:host',
            watchCode: watchCodeRef.current,
          })
        );
        socket.send(
          JSON.stringify({
            type: 'room:join',
            roomId,
            name: userName,
            platform,
            watchConnected: watchRef.current.connected,
            earbudConnected: earbud.connected,
            watchName: watchRef.current.name,
            earbudName: earbud.label,
          })
        );
      };

      socket.onmessage = (event) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(event.data)) as Record<string, unknown>;
        } catch {
          return;
        }

        if (msg.type === 'watch:paired') {
          const pairedCode = String(msg.watchCode || watchCodeRef.current);
          const pairedName = String(msg.watchName || 'QR Paired Smartwatch');
          setWatch({
            connected: true,
            name: pairedName,
            platformBridge: 'qr-watch-link',
            batteryLevel: null,
            firmwareNote: `Vibration Only · QR Linked (${pairedCode})`,
            watchPairCode: pairedCode,
          });
        } else if (msg.type === 'watch:disconnected') {
          setWatch((prev) =>
            prev.platformBridge === 'qr-watch-link'
              ? {
                  connected: false,
                  name: 'Smartwatch Bridge',
                  platformBridge: 'virtual-wrist',
                  batteryLevel: null,
                  firmwareNote: 'QR watch link disconnected',
                }
              : prev
          );
        } else if (msg.type === 'watch:pulse') {
          setLastWatchReceiverPulse({
            intensity: Number(msg.intensity) || 0,
            frequencyHz: Number(msg.frequencyHz) || 60,
            timestamp: Number(msg.timestamp) || Date.now(),
          });
        } else if (msg.type === 'room:joined') {
          setSelfId(typeof msg.selfId === 'string' ? msg.selfId : null);
          if (Array.isArray(msg.members)) setMembers(msg.members as PartnerMember[]);
          if (Array.isArray(msg.messages)) setRoomMessages(msg.messages as RoomChatMessage[]);
        } else if (msg.type === 'room:presence') {
          if (Array.isArray(msg.members)) setMembers(msg.members as PartnerMember[]);
        } else if (msg.type === 'haptic:pulse') {
          const intensity = Number(msg.intensity) || 0;
          const hz = Number(msg.frequencyHz) || 60;
          const pattern = (msg.pattern as PulsePattern) || 'wave';
          const senderName = String(msg.senderName || 'Partner');
          audioHapticEngine.setSourceMode('control');
          audioHapticEngine.triggerManualPulse(intensity, hz, pattern, 320, false);
          setLastReceivedNote(`Receiving ${intensity}% · ${hz} Hz from ${senderName}`);
        } else if (msg.type === 'chat:message') {
          const incoming = msg.message as RoomChatMessage | undefined;
          if (!incoming) return;
          setRoomMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          if (incoming.attachedPulse && incoming.senderId !== selfId) {
            audioHapticEngine.setSourceMode('chat');
            audioHapticEngine.triggerManualPulse(
              incoming.attachedPulse.intensity,
              incoming.attachedPulse.baseHz,
              incoming.attachedPulse.pattern,
              950,
              false
            );
          }
        } else if (msg.type === 'video:sync') {
          setRemoteVideoCommand({
            action: (msg.action as 'play' | 'pause' | 'seek') || 'seek',
            currentTime: Number(msg.currentTime) || 0,
            seq: Date.now(),
          });
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, 2200);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
    // Only reconnect lifecycle on mount; room switches emit room:join directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-host watch QR code whenever regenerated
  useEffect(() => {
    if (!watchPairReceiverCode && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'watch:host',
          watchCode,
        })
      );
    }
  }, [watchCode, watchPairReceiverCode]);

  // Push device status changes to room members
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'device:status',
          watchConnected: watch.connected,
          earbudConnected: earbud.connected,
          watchName: watch.name,
          earbudName: earbud.label,
        })
      );
    }
  }, [watch.connected, watch.name, earbud.connected, earbud.label]);

  const handleJoinRoom = useCallback(
    (nextRoomId: string, nextName: string) => {
      const cleanedRoom = nextRoomId.trim().toUpperCase() || 'WMD-4821';
      const cleanedName = nextName.trim() || 'Partner';
      setRoomId(cleanedRoom);
      setUserName(cleanedName);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'room:join',
            roomId: cleanedRoom,
            name: cleanedName,
            platform,
            watchConnected: watch.connected,
            earbudConnected: earbud.connected,
            watchName: watch.name,
            earbudName: earbud.label,
          })
        );
      }
    },
    [platform, watch.connected, watch.name, earbud.connected, earbud.label]
  );

  const handlePlayTrack = (track: SoundscapeTrack) => {
    audioHapticEngine.setSourceMode('solo');
    audioHapticEngine.startSynthSoundscape(track.synthPreset, track.bpm, track.baseHz);
    setActiveTrackId(track.id);
    setIsPlaying(true);
  };

  const handleStopPlayback = () => {
    audioHapticEngine.stopAllSources();
    setIsPlaying(false);
  };

  const handleChangeCurve = (nextCurve: ConversionCurve) => {
    setCurve(nextCurve);
    audioHapticEngine.setConversionCurve(nextCurve);
  };

  const handleChangeWatchIntensity = (val: number) => {
    setWatchIntensityScale(val);
    audioHapticEngine.setWatchIntensityScale(val);
  };

  const handleChangeEarbudVolume = (val: number) => {
    setEarbudVolume(val);
    setEarbud((prev) => ({ ...prev, volume: val }));
    audioHapticEngine.setEarbudVolume(val);
  };

  const handleUpdateEarbud = (next: EarbudDeviceState) => {
    setEarbud(next);
    audioHapticEngine.setEarbudBalance(next.balance);
  };

  const resolveCurrentSourceMode = () =>
    activeMode === 'membership'
      ? 'solo'
      : activeMode === 'chats'
      ? 'chat'
      : activeMode;

  const handleTestWatchVibration = () => {
    audioHapticEngine.setSourceMode(resolveCurrentSourceMode());
    audioHapticEngine.triggerManualPulse(85, 62, 'heartbeat', 750, false);
  };

  const handleTestEarbudAudio = () => {
    audioHapticEngine.playEarbudAudioChime();
  };

  const handleTestDualSync = () => {
    audioHapticEngine.setSourceMode(resolveCurrentSourceMode());
    audioHapticEngine.triggerManualPulse(85, 68, 'heartbeat', 700, false);
    audioHapticEngine.playEarbudAudioChime();
  };

  const handleSendPartnerPulse = useCallback(
    (intensity: number, frequencyHz: number, pattern: PulsePattern) => {
      audioHapticEngine.setSourceMode('control');
      audioHapticEngine.triggerManualPulse(intensity, frequencyHz, pattern, 260, false);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'haptic:pulse',
            intensity,
            frequencyHz,
            pattern,
            sourceMode: 'control',
          })
        );
      }
    },
    []
  );

  const handleSendRoomMessage = (text: string, attachedPulse?: SuggestedPulse) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat:send',
          id: generateClientId('msg'),
          text,
          attachedPulse,
        })
      );
    }
  };

  const handlePlaySuggestedPulse = (pulse: SuggestedPulse) => {
    audioHapticEngine.setSourceMode('chat');
    audioHapticEngine.triggerManualPulse(
      pulse.intensity,
      pulse.baseHz,
      pulse.pattern,
      1400,
      false
    );
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'haptic:pulse',
          intensity: pulse.intensity,
          frequencyHz: pulse.baseHz,
          pattern: pulse.pattern,
          sourceMode: 'chat',
        })
      );
    }
  };

  const handleEmitVideoSync = (action: 'play' | 'pause' | 'seek', currentTime: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'video:sync',
          action,
          currentTime,
        })
      );
    }
  };

  const handleActivatePlan = async (planId: PlanTierId) => {
    if (planId === 'lifetime' && !ageVerified18Plus) {
      setAgeVerified18Plus(false);
      return;
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }
    const res = await fetch('/api/subscription/activate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ planId, ageVerified18Plus }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as SubscriptionSession;
    setSession(data);
  };

  const handleActivateAddOn = async (addOnId: AddOnId) => {
    if (!ageVerified18Plus) {
      setAgeVerified18Plus(false);
      return;
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }
    const res = await fetch('/api/subscription/activate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ addOnId, ageVerified18Plus }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as SubscriptionSession;
    setSession(data);
  };

  const partnerConnected = members.some((m) => m.id !== selfId);

  if (watchPairReceiverCode) {
    return (
      <>
        <WatchReceiverView
          watchCode={watchPairReceiverCode}
          wsConnected={wsConnected}
          lastPulse={lastWatchReceiverPulse}
          onExitReceiverMode={() => {
            setWatchPairReceiverCode(null);
            if (typeof window !== 'undefined') {
              const nextUrl = new URL(window.location.href);
              nextUrl.searchParams.delete('watchPair');
              window.history.replaceState({}, '', nextUrl.toString());
            }
          }}
        />
        <AgeGateModal open={!ageVerified18Plus} onConfirm18Plus={handleConfirm18Plus} />
      </>
    );
  }

  const isAccountVerified = Boolean(firebaseUser && isUserContactVerified(firebaseUser));
  const needsMandatoryAuth =
    ageVerified18Plus && watchOnboardingDone && authReady && !isAccountVerified;

  return (
    <div className="min-h-screen bg-[#0D0C0F] text-[#F5F2EE] pb-24 md:pb-12">
      <TopBar
        activeMode={activeMode}
        onSelectMode={setActiveMode}
        onOpenDevices={() => setDevicesOpen(true)}
        onOpenAccount={() => setAccountModalOpen(true)}
        accountVerified={isAccountVerified}
        accountLabel={accountProfile?.displayName || firebaseUser?.displayName || undefined}
        dualLinkActive={watch.connected && earbud.connected}
      />

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <CoupleHeroStrip
          activeMode={activeMode}
          onSelectMode={setActiveMode}
          roomId={roomId}
          members={members}
          selfId={selfId}
          wsConnected={wsConnected}
          onSendQuickHeartbeat={() => handleSendPartnerPulse(78, 54, 'heartbeat')}
          platform={platform}
          watchConnected={watch.connected}
          earbudConnected={earbud.connected}
          onOpenQr={() => setQrOpen(true)}
          onOpenInstall={() => setInstallOpen(true)}
        />

        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          {/* Primary Active Mode Workspace */}
          <div className="lg:col-span-8">
            {activeMode === 'solo' && (
              <SoloModeView
                activeTrackId={activeTrackId}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                onStopPlayback={handleStopPlayback}
                curve={curve}
                onChangeCurve={handleChangeCurve}
                planId={session.planId}
                session={session}
                onActivatePlan={handleActivatePlan}
                onActivateAddOn={handleActivateAddOn}
                onPlaySuggestedPulse={handlePlaySuggestedPulse}
                onOpenMembership={() => setActiveMode('membership')}
              />
            )}

            {activeMode === 'control' && (
              <ControlModeView
                roomId={roomId}
                onJoinRoom={handleJoinRoom}
                userName={userName}
                wsConnected={wsConnected}
                members={members}
                selfId={selfId}
                broadcastAudioToPartner={broadcastAudioToPartner}
                onToggleBroadcastAudio={setBroadcastAudioToPartner}
                onSendPartnerPulse={handleSendPartnerPulse}
                lastReceivedNote={lastReceivedNote}
                planId={session.planId}
                onOpenMembership={() => setActiveMode('membership')}
                onOpenQr={() => setQrOpen(true)}
              />
            )}

            {activeMode === 'video' && (
              <VideoModeView
                frame={frame}
                planId={session.planId}
                session={session}
                onSessionUpdate={setSession}
                onActivateAddOn={handleActivateAddOn}
                onOpenMembership={() => setActiveMode('membership')}
                syncWithPartner={syncVideoWithPartner}
                onToggleSyncWithPartner={setSyncVideoWithPartner}
                onEmitVideoSync={handleEmitVideoSync}
                remoteVideoCommand={remoteVideoCommand}
              />
            )}

            {activeMode === 'chats' && (
              <ChatsView
                roomId={roomId}
                selfId={selfId}
                roomMessages={roomMessages}
                onSendRoomMessage={handleSendRoomMessage}
                onPlayPulse={handlePlaySuggestedPulse}
                partnerConnected={partnerConnected}
                planId={session.planId}
                session={session}
                onActivateAddOn={handleActivateAddOn}
                onOpenMembership={() => setActiveMode('membership')}
              />
            )}

            {activeMode === 'membership' && (
              <MembershipView
                plans={plans}
                addOns={addOns}
                session={session}
                onActivatePlan={handleActivatePlan}
                onActivateAddOn={handleActivateAddOn}
                onOpenInstall={() => setInstallOpen(true)}
              />
            )}
          </div>

          {/* Persistent Smartwatch + Earbuds Dual-Link Telemetry Sidebar */}
          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <WatchHapticVisualizer
              frame={frame}
              watch={watch}
              earbud={earbud}
              platform={platform}
              onChangePlatform={setPlatform}
              watchIntensityScale={watchIntensityScale}
              onChangeWatchIntensity={handleChangeWatchIntensity}
              earbudVolume={earbudVolume}
              onChangeEarbudVolume={handleChangeEarbudVolume}
              onOpenDevices={() => setDevicesOpen(true)}
              onOpenWatchQr={() => setWatchQrModalOpen(true)}
              onOpenInstall={() => setInstallOpen(true)}
              onTestWatchVibration={handleTestWatchVibration}
              onTestEarbudAudio={handleTestEarbudAudio}
            />
          </div>
        </div>
      </main>

      <MobileBottomNav activeMode={activeMode} onSelectMode={setActiveMode} />

      <OfflineIndicator />

      <DeviceBridgeModal
        open={devicesOpen}
        onClose={() => setDevicesOpen(false)}
        watch={watch}
        onUpdateWatch={setWatch}
        earbud={earbud}
        onUpdateEarbud={handleUpdateEarbud}
        onSelectAudioSink={async (id) => {
          await audioHapticEngine.setAudioSink(id);
        }}
        vibrateEnabled={vibrateEnabled}
        onToggleVibrate={setVibrateEnabled}
        platform={platform}
        onTestWatchVibration={handleTestWatchVibration}
        onTestEarbudAudio={handleTestEarbudAudio}
        onTestDualSync={handleTestDualSync}
        onOpenQr={() => setQrOpen(true)}
        onOpenWatchQr={() => setWatchQrModalOpen(true)}
      />

      <QrPairingModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        roomId={roomId}
        userName={userName}
        onJoinRoom={handleJoinRoom}
      />

      <InstallAppModal
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        selectedPlatform={platform}
        onSelectPlatform={setPlatform}
        ageVerified18Plus={ageVerified18Plus}
        onRequireAgeGate={() => {
          setInstallOpen(false);
          setAgeVerified18Plus(false);
        }}
      />

      {/* Priority Step 1: Smartwatch QR Pairing Before Entering Main Workspace */}
      <SmartwatchQrModal
        open={(ageVerified18Plus && !watchOnboardingDone) || watchQrModalOpen}
        isInitialOnboarding={!watchOnboardingDone}
        onClose={() => setWatchQrModalOpen(false)}
        watchCode={watchCode}
        onChangeWatchCode={setWatchCode}
        watch={watch}
        onUpdateWatch={setWatch}
        onTestWatchVibration={handleTestWatchVibration}
        onCompleteOnboarding={handleCompleteWatchOnboarding}
      />

      {/* Step 2: Verified Email or Mobile Account Sign-Up / Sign-In */}
      <AccountAuthModal
        open={needsMandatoryAuth || accountModalOpen}
        isMandatoryOnboarding={needsMandatoryAuth}
        currentUser={firebaseUser}
        profile={accountProfile}
        onClose={() => setAccountModalOpen(false)}
        onVerifiedComplete={(prof) => {
          setAccountProfile(prof);
          setUserName(prof.displayName);
          setAccountModalOpen(false);
        }}
      />

      <AgeGateModal open={!ageVerified18Plus} onConfirm18Plus={handleConfirm18Plus} />
    </div>
  );
}
