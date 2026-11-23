import {
  CheckCircle2,
  Download,
  Film,
  Headphones,
  Lock,
  Pause,
  Play,
  QrCode,
  Radio,
  RefreshCw,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  Watch,
  Waves,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { WEEKLY_OFFERS, getCurrentWeekOfYear } from '../data/weeklyOffers.ts';
import { audioHapticEngine } from '../engines/audioHapticEngine.ts';
import {
  canPickAudioOutputDevice,
  listAudioOutputDevices,
  selectEarbudOutputPrompt,
} from '../engines/bluetoothBridge.ts';
import { drawTeaseVideoFrame, getActiveTeaseScene } from '../engines/sensoryMediaRenderer.ts';
import type {
  AddOnId,
  AudioOutputOption,
  EarbudDeviceState,
  GeneratedTeaseVideo,
  HapticFrame,
  PlanTierId,
  SubscriptionSession,
  WatchDeviceState,
} from '../types.ts';

interface VideoModeViewProps {
  frame: HapticFrame;
  planId: PlanTierId;
  session: SubscriptionSession;
  onSessionUpdate: (next: SubscriptionSession) => void;
  onActivateAddOn: (addOnId: AddOnId) => Promise<void>;
  onOpenMembership: () => void;
  syncWithPartner: boolean;
  onToggleSyncWithPartner: (val: boolean) => void;
  onEmitVideoSync: (action: 'play' | 'pause' | 'seek', currentTime: number) => void;
  remoteVideoCommand: { action: 'play' | 'pause' | 'seek'; currentTime: number; seq: number } | null;
  watch: WatchDeviceState;
  earbud: EarbudDeviceState;
  onUpdateEarbud: (e: EarbudDeviceState) => void;
  onSelectAudioSink: (deviceId: string) => Promise<void>;
  earbudVolume: number;
  onChangeEarbudVolume: (val: number) => void;
  watchIntensityScale: number;
  onChangeWatchIntensity: (val: number) => void;
  onOpenWatchQr: () => void;
  onOpenDevices: () => void;
  onTestWatchVibration: () => void;
  onTestEarbudAudio: () => void;
}

const PREVIEW_LIMIT_SECONDS = 30;

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VideoModeView({
  frame,
  planId,
  session,
  onSessionUpdate,
  onActivateAddOn,
  onOpenMembership,
  syncWithPartner,
  onToggleSyncWithPartner,
  onEmitVideoSync,
  remoteVideoCommand,
  watch,
  earbud,
  onUpdateEarbud,
  onSelectAudioSink,
  earbudVolume,
  onChangeEarbudVolume,
  watchIntensityScale,
  onChangeWatchIntensity,
  onOpenWatchQr,
  onOpenDevices,
  onTestWatchVibration,
  onTestEarbudAudio,
}: VideoModeViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ambientCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const teaseCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>('Ambient Cinema Loop');
  const [videoMeta, setVideoMeta] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [latencyOffsetMs, setLatencyOffsetMs] = useState(0);
  const [posterFailed, setPosterFailed] = useState(false);
  const [trialPreviewActive, setTrialPreviewActive] = useState(false);
  const [trialEndedPrompt, setTrialEndedPrompt] = useState(false);

  // Dual-channel routing controls
  const [audioOutputs, setAudioOutputs] = useState<AudioOutputOption[]>([]);
  const [earbudsMuted, setEarbudsMuted] = useState(false);
  const [sinkFeedback, setSinkFeedback] = useState<string | null>(null);

  // Add-On 2 (₱350/yr · 20s/week Teasing AI Video Studio)
  const currentWeek = session.currentWeekNumber || getCurrentWeekOfYear();
  const weeklyOffer = WEEKLY_OFFERS[currentWeek - 1] || WEEKLY_OFFERS[0];
  const [teasePrompt, setTeasePrompt] = useState(weeklyOffer.teasePrompt);
  const [generatingTease, setGeneratingTease] = useState(false);
  const [unlockingVideoPack, setUnlockingVideoPack] = useState(false);
  const [teaseError, setTeaseError] = useState<string | null>(null);
  const [generatedTease, setGeneratedTease] = useState<GeneratedTeaseVideo | null>(null);
  const [teasePlaying, setTeasePlaying] = useState(false);
  const [teaseElapsed, setTeaseElapsed] = useState(0);
  const [recordingWebm, setRecordingWebm] = useState(false);

  const hasUnlimitedPass = planId === 'lifetime';
  const showLockOverlay = !hasUnlimitedPass && !trialPreviewActive;
  const remainingWeeklySeconds = Math.max(
    0,
    session.videoSecondsWeeklyLimit - session.videoSecondsUsedThisWeek
  );

  useEffect(() => {
    void listAudioOutputDevices().then(setAudioOutputs);
  }, []);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      audioHapticEngine.setMediaPlaying(false);
    };
  }, [videoUrl]);

  // Handle incoming remote WebSocket video sync commands
  useEffect(() => {
    if (!remoteVideoCommand || !syncWithPartner) return;
    const vid = videoRef.current;
    if (videoUrl && vid) {
      if (Math.abs(vid.currentTime - remoteVideoCommand.currentTime) > 0.8) {
        vid.currentTime = remoteVideoCommand.currentTime;
      }
      if (remoteVideoCommand.action === 'play') {
        audioHapticEngine.attachMediaElement(vid, 'video');
        audioHapticEngine.setMediaPlaying(true);
        void vid.play();
      } else if (remoteVideoCommand.action === 'pause') {
        vid.pause();
        audioHapticEngine.setMediaPlaying(false);
      }
    } else {
      if (remoteVideoCommand.action === 'play') {
        audioHapticEngine.setSourceMode('video');
        audioHapticEngine.startSynthSoundscape('velvet', 72, 52);
        setIsAmbientPlaying(true);
      } else if (remoteVideoCommand.action === 'pause') {
        audioHapticEngine.stopAllSources();
        setIsAmbientPlaying(false);
      }
    }
  }, [remoteVideoCommand, syncWithPartner, videoUrl]);

  // Procedural 60fps reactive ambient cinema canvas when no external video file is uploaded
  useEffect(() => {
    if (videoUrl) return;
    const canvas = ambientCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;

    const draw = () => {
      t += isAmbientPlaying ? 0.022 : 0.005;
      const w = canvas.width;
      const h = canvas.height;
      const intensityRatio = frame.intensity / 100;

      ctx.fillStyle = '#0D0C0F';
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 4; i++) {
        const radius = 55 + i * 42 + intensityRatio * 46 + Math.sin(t + i) * 14;
        const grad = ctx.createRadialGradient(
          w / 2 + Math.cos(t * 0.6 + i) * 32,
          h / 2 + Math.sin(t * 0.5 + i) * 20,
          10,
          w / 2,
          h / 2,
          radius * 1.4
        );
        grad.addColorStop(0, `rgba(232, 93, 117, ${0.18 + intensityRatio * 0.22})`);
        grad.addColorStop(0.6, `rgba(232, 197, 165, ${0.07 + intensityRatio * 0.08})`);
        grad.addColorStop(1, 'rgba(13, 12, 15, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, radius * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [videoUrl, isAmbientPlaying, frame.intensity]);

  // Teasing AI Video 20-second playback loop synced to smartwatch haptics
  useEffect(() => {
    if (!generatedTease) return;
    const canvas = teaseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawTeaseVideoFrame(ctx, canvas.width, canvas.height, generatedTease, teaseElapsed);

    if (!teasePlaying) return;

    let raf = 0;
    let lastTs = performance.now();
    let lastPulseTs = 0;
    let currentElapsed = teaseElapsed;

    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      currentElapsed += dt;
      if (currentElapsed >= generatedTease.durationSeconds) {
        currentElapsed = 0;
      }
      setTeaseElapsed(currentElapsed);
      drawTeaseVideoFrame(ctx, canvas.width, canvas.height, generatedTease, currentElapsed);

      if (now - lastPulseTs >= 280) {
        lastPulseTs = now;
        const activeScene = getActiveTeaseScene(generatedTease, currentElapsed);
        audioHapticEngine.setSourceMode('video');
        audioHapticEngine.triggerManualPulse(
          activeScene.intensity,
          activeScene.frequencyHz,
          'crescendo',
          260,
          false
        );
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [generatedTease, teasePlaying, teaseElapsed]);

  const loadLocalVideoFile = (file: File) => {
    setVideoError(null);
    setTrialEndedPrompt(false);
    if (!hasUnlimitedPass && !trialPreviewActive) {
      setTrialPreviewActive(true);
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const nextUrl = URL.createObjectURL(file);
    setVideoUrl(nextUrl);
    setVideoName(file.name);
    setVideoMeta(
      `${(file.size / (1024 * 1024)).toFixed(1)} MB · Local device file`
    );
    setIsAmbientPlaying(false);
    audioHapticEngine.stopAllSources();

    requestAnimationFrame(() => {
      const vid = videoRef.current;
      if (vid) {
        vid.src = nextUrl;
        audioHapticEngine.attachMediaElement(vid, 'video');
        vid
          .play()
          .then(() => {
            audioHapticEngine.setMediaPlaying(true);
            setIsVideoPlaying(true);
          })
          .catch(() => {
            audioHapticEngine.setMediaPlaying(false);
            setIsVideoPlaying(false);
          });
      }
    });
  };

  const handleUploadVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    loadLocalVideoFile(file);
  };

  const handleDropVideo = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm|mkv|3gp)$/i.test(file.name)) {
      setVideoError('Please choose a supported video file (MP4, MOV, M4V, WebM).');
      return;
    }
    loadLocalVideoFile(file);
  };

  const handleRefreshAudioOutputs = async () => {
    const list = await listAudioOutputDevices();
    setAudioOutputs(list);
    setSinkFeedback('Audio outputs refreshed. Select your Bluetooth earbuds below.');
  };

  const handlePickBluetoothEarbuds = async () => {
    const picked = await selectEarbudOutputPrompt();
    if (picked) {
      await onSelectAudioSink(picked.deviceId);
      onUpdateEarbud({
        ...earbud,
        connected: true,
        deviceId: picked.deviceId,
        label: picked.label,
      });
      setAudioOutputs((prev) =>
        prev.some((p) => p.deviceId === picked.deviceId) ? prev : [picked, ...prev]
      );
      setSinkFeedback(`Earbud audio locked to: ${picked.label}`);
      return;
    }
    await handleRefreshAudioOutputs();
  };

  const handleToggleEarbudMute = () => {
    const next = !earbudsMuted;
    setEarbudsMuted(next);
    audioHapticEngine.setEarbudMuted(next);
  };

  const toggleAmbientCinema = () => {
    if (showLockOverlay) {
      onOpenMembership();
      return;
    }
    if (isAmbientPlaying) {
      audioHapticEngine.stopAllSources();
      setIsAmbientPlaying(false);
      if (syncWithPartner) onEmitVideoSync('pause', 0);
    } else {
      audioHapticEngine.setSourceMode('video');
      audioHapticEngine.startSynthSoundscape('velvet', 72, 52);
      setIsAmbientPlaying(true);
      if (syncWithPartner) onEmitVideoSync('play', 0);
    }
  };

  const handleUnlockVideoAddOn = async () => {
    setUnlockingVideoPack(true);
    setTeaseError(null);
    try {
      await onActivateAddOn('video-pack');
    } finally {
      setUnlockingVideoPack(false);
    }
  };

  const handleGenerateTeaseVideo = async () => {
    setTeaseError(null);
    if (!session.addOnVideoUnlocked) {
      await handleUnlockVideoAddOn();
      return;
    }
    if (generatingTease) return;
    setGeneratingTease(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session.token) {
        headers.Authorization = `Bearer ${session.token}`;
      }
      const res = await fetch('/api/ai/generate-tease-video', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: teasePrompt.trim() || weeklyOffer.teasePrompt,
        }),
      });
      const data = (await res.json()) as {
        video?: GeneratedTeaseVideo;
        session?: SubscriptionSession;
        error?: string;
      };
      if (!res.ok || !data.video) {
        setTeaseError(data.error || 'Could not generate teasing AI video right now.');
        return;
      }
      if (data.session) {
        onSessionUpdate(data.session);
      }
      setGeneratedTease(data.video);
      setTeaseElapsed(0);
      setTeasePlaying(true);
    } catch {
      setTeaseError('Network interruption while generating teasing AI video.');
    } finally {
      setGeneratingTease(false);
    }
  };

  const handleExportWebm = () => {
    const canvas = teaseCanvasRef.current;
    if (!canvas || !generatedTease || typeof MediaRecorder === 'undefined') return;
    setRecordingWebm(true);
    setTeaseElapsed(0);
    setTeasePlaying(true);

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunks.push(ev.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watch-me-darling-week-${generatedTease.weekNumber}-tease.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setRecordingWebm(false);
    };
    recorder.start();
    window.setTimeout(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, 5000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[#F5F2EE]">
          01. Device Video Player · Split Audio &amp; Vibration
        </h2>
        <span className="text-xs text-[#E8C5A5]">
          {hasUnlimitedPass
            ? '₱250 Lifetime Pass Active · Unlimited playback · Earbud Audio + Watch Vibration'
            : '30s Preview Ready · ₱250 Download Pass unlocks unlimited playback'}
        </span>
      </div>

      {/* Main Video Stage with Drag-and-Drop + File Browse */}
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDropVideo}
        className={`relative overflow-hidden rounded-3xl border bg-[#16141A] transition-colors ${
          isDragOver ? 'border-[#E85D75]' : 'border-white/[0.08]'
        }`}
      >
        {showLockOverlay && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0D0C0F]/90 backdrop-blur-sm p-6 text-center">
            <Lock className="h-8 w-8 text-[#E8C5A5]" />
            <h2 className="font-display mt-3 text-xl font-medium text-[#F5F2EE]">
              Unlimited Video Mode · Included in ₱250 First Payment
            </h2>
            <p className="mt-1.5 max-w-md text-xs text-[#A099A8] leading-relaxed">
              Browse any video file on your device—audio plays exclusively through your earbuds while bass &amp; peaks vibrate your smartwatch.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={onOpenMembership}
                className="min-h-[44px] rounded-xl bg-[#E85D75] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
              >
                Unlock ₱250 Lifetime Pass
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrialPreviewActive(true);
                  fileInputRef.current?.click();
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-[#1B1721] px-4 py-2.5 text-xs font-semibold text-[#E8C5A5] hover:bg-[#25202E] cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Browse File (30s Preview)</span>
              </button>
            </div>
          </div>
        )}

        {trialEndedPrompt && !hasUnlimitedPass && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0D0C0F]/92 backdrop-blur-sm p-6 text-center">
            <Lock className="h-8 w-8 text-[#E85D75]" />
            <h3 className="font-display mt-3 text-xl font-medium text-[#F5F2EE]">
              30-Second Preview Complete
            </h3>
            <p className="mt-1.5 max-w-md text-xs text-[#A099A8] leading-relaxed">
              Unlock the ₱250 Lifetime Membership to keep watching your full device videos with continuous Earbud Audio + Smartwatch Vibration.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={onOpenMembership}
                className="min-h-[44px] rounded-xl bg-[#E85D75] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
              >
                Unlock ₱250 Unlimited Video
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrialEndedPrompt(false);
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    void videoRef.current.play();
                  }
                }}
                className="min-h-[44px] rounded-xl border border-white/15 bg-[#1B1721] px-4 py-2.5 text-xs font-medium text-[#F5F2EE] hover:bg-[#25202E] cursor-pointer"
              >
                Replay 30s Preview
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mp4,.mov,.m4v,.webm,.mkv,.3gp"
          onChange={handleUploadVideo}
          className="sr-only"
          aria-label="Browse device video file"
        />

        <div className="relative aspect-video w-full bg-[#0D0C0F]">
          {videoUrl ? (
            <video
              ref={videoRef}
              controls
              playsInline
              onLoadedMetadata={() => {
                const vid = videoRef.current;
                if (!vid) return;
                const dims =
                  vid.videoWidth && vid.videoHeight
                    ? `${vid.videoWidth}×${vid.videoHeight}`
                    : 'Video ready';
                setVideoMeta(`${dims} · ${formatDuration(vid.duration)}`);
              }}
              onPlay={() => {
                if (videoRef.current) {
                  audioHapticEngine.attachMediaElement(videoRef.current, 'video');
                  audioHapticEngine.setMediaPlaying(true);
                  setIsVideoPlaying(true);
                  if (syncWithPartner) onEmitVideoSync('play', videoRef.current.currentTime);
                }
              }}
              onPause={() => {
                audioHapticEngine.setMediaPlaying(false);
                setIsVideoPlaying(false);
                if (syncWithPartner && videoRef.current) {
                  onEmitVideoSync('pause', videoRef.current.currentTime);
                }
              }}
              onEnded={() => {
                audioHapticEngine.setMediaPlaying(false);
                setIsVideoPlaying(false);
              }}
              onTimeUpdate={() => {
                const vid = videoRef.current;
                if (!hasUnlimitedPass && vid && vid.currentTime >= PREVIEW_LIMIT_SECONDS) {
                  vid.pause();
                  audioHapticEngine.setMediaPlaying(false);
                  setIsVideoPlaying(false);
                  setTrialEndedPrompt(true);
                }
              }}
              onSeeked={() => {
                if (syncWithPartner && videoRef.current) {
                  onEmitVideoSync('seek', videoRef.current.currentTime);
                }
              }}
              onError={() => {
                audioHapticEngine.setMediaPlaying(false);
                setIsVideoPlaying(false);
                setVideoError(
                  'This video codec could not be decoded by your browser. Try an MP4 (H.264/AAC) or WebM file.'
                );
              }}
              className="h-full w-full object-contain"
            />
          ) : (
            <>
              {!posterFailed && (
                <img
                  src="/src/assets/images/video_cinema_poster_1795443282766.jpg"
                  alt="Couple evening terrace cinema backdrop"
                  referrerPolicy="no-referrer"
                  onError={() => setPosterFailed(true)}
                  className="absolute inset-0 h-full w-full object-cover opacity-55"
                />
              )}
              <canvas
                ref={ambientCanvasRef}
                width={800}
                height={450}
                className="relative h-full w-full object-cover mix-blend-screen"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#F5F2EE]">{videoName}</h2>
                  <p className="text-xs text-[#D3CDD9]">
                    Browse or drop any device video · Earbud audio + {frame.intensity}% Watch vibration
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-[#E85D75] px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-[#d94d66]"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Browse Device Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleAmbientCinema}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-[#16141A]/90 px-4 py-2 text-xs font-semibold text-[#F5F2EE] hover:bg-[#221E29] cursor-pointer"
                  >
                    {isAmbientPlaying ? (
                      <>
                        <Pause className="h-4 w-4" /> Pause Loop
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" /> Ambient Loop
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* File Controls + Calibration Bar */}
        <div className="grid gap-4 border-t border-white/[0.06] p-5 sm:grid-cols-2 lg:grid-cols-3 lg:items-center">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-[#201D27] px-4 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#2A2633]"
            >
              <Upload className="h-4 w-4 text-[#E8C5A5]" />
              <span>{videoUrl ? 'Change Device Video' : 'Browse Video File'}</span>
            </button>
            {videoUrl && (
              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) videoRef.current.pause();
                  audioHapticEngine.setMediaPlaying(false);
                  URL.revokeObjectURL(videoUrl);
                  setVideoUrl(null);
                  setVideoName('Ambient Cinema Loop');
                  setVideoMeta(null);
                  setVideoError(null);
                  setIsVideoPlaying(false);
                }}
                className="min-h-[44px] rounded-xl border border-white/10 bg-[#0D0C0F] px-3 py-2 text-xs text-[#A099A8] hover:text-[#F5F2EE] cursor-pointer"
              >
                Use Ambient Loop
              </button>
            )}
            {videoMeta && (
              <span className="text-[11px] text-[#A099A8] truncate max-w-[240px]">
                {videoName} ({videoMeta})
              </span>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-[#A099A8]">Watch vs Earbud Sync Offset</span>
              <span className="font-mono-tabular text-[#E8C5A5]">
                {latencyOffsetMs > 0 ? `+${latencyOffsetMs}` : latencyOffsetMs} ms
              </span>
            </div>
            <input
              aria-label="Bluetooth watch sync latency offset"
              type="range"
              min={-200}
              max={200}
              step={10}
              value={latencyOffsetMs}
              onChange={(e) => {
                const next = Number(e.target.value);
                setLatencyOffsetMs(next);
                audioHapticEngine.setLatencyOffsetMs(next);
              }}
              className="resona-slider w-full"
            />
          </div>

          <div className="flex items-center justify-between sm:col-span-2 lg:col-span-1 lg:justify-end">
            <button
              type="button"
              onClick={() => onToggleSyncWithPartner(!syncWithPartner)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-colors cursor-pointer ${
                syncWithPartner
                  ? 'bg-[#E85D75]/20 border border-[#E85D75] text-[#F5F2EE]'
                  : 'border border-white/10 bg-[#0D0C0F] text-[#A099A8] hover:text-[#F5F2EE]'
              }`}
            >
              <Radio className="h-4 w-4 text-[#E85D75]" />
              <span>{syncWithPartner ? 'Synced with Partner' : 'Sync with Partner'}</span>
            </button>
          </div>
        </div>

        {videoError && (
          <div className="border-t border-[#F47286]/30 bg-[#251319] px-5 py-3 text-xs text-[#F47286]">
            {videoError}
          </div>
        )}
      </section>

      {/* Dual-Channel Hardware Split: Earbuds = Audio ONLY | Smartwatch = Vibration ONLY */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Channel A: Earbuds Audio */}
        <div className="rounded-3xl border border-[#E8C5A5]/25 bg-[#16141A] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8C5A5]/15">
                <Headphones className="h-5 w-5 text-[#E8C5A5]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#F5F2EE]">
                  Earbuds · Audio &amp; Sound Only
                </h3>
                <p className="text-[11px] text-[#A099A8]">
                  Video soundtrack routes here only (never to your watch)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleEarbudMute}
              title="Mute earbuds while smartwatch keeps vibrating"
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                earbudsMuted
                  ? 'border-[#F47286]/50 bg-[#251319] text-[#F47286]'
                  : 'border-white/10 bg-[#0D0C0F] text-[#E8C5A5]'
              }`}
            >
              {earbudsMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              <span>{earbudsMuted ? 'Muted' : 'Audio On'}</span>
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-[#A099A8]">
                <label htmlFor="video-earbud-route">Bluetooth Earbud Output</label>
                <div className="flex items-center gap-2">
                  {canPickAudioOutputDevice() && (
                    <button
                      type="button"
                      onClick={() => void handlePickBluetoothEarbuds()}
                      className="text-[#E8C5A5] hover:underline cursor-pointer"
                    >
                      Pick Earbuds
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleRefreshAudioOutputs()}
                    aria-label="Refresh audio output devices"
                    className="inline-flex items-center gap-1 text-[#A099A8] hover:text-[#F5F2EE] cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh
                  </button>
                </div>
              </div>
              <select
                id="video-earbud-route"
                value={earbud.deviceId}
                onChange={(e) => {
                  const selected = audioOutputs.find((o) => o.deviceId === e.target.value);
                  onUpdateEarbud({
                    ...earbud,
                    connected: true,
                    deviceId: e.target.value,
                    label: selected?.label || 'Bluetooth Earbuds',
                  });
                  void onSelectAudioSink(e.target.value).then(( ) => {
                    setSinkFeedback(
                      audioHapticEngine.isSinkSelectionSupported()
                        ? `Audio routed to ${selected?.label || 'selected earbuds'}`
                        : 'Using OS Bluetooth audio routing (connect AirPods / Buds in device Bluetooth).'
                    );
                  });
                }}
                className="h-10 w-full rounded-xl border border-white/10 bg-[#0D0C0F] px-3 text-xs text-[#F5F2EE] focus:border-[#E8C5A5] focus:outline-none"
              >
                {audioOutputs.map((opt) => (
                  <option key={opt.deviceId} value={opt.deviceId}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[#A099A8]">Earbud Volume</span>
                <span className="font-mono-tabular text-[#E8C5A5]">
                  {earbudsMuted ? '0% (Muted)' : `${earbudVolume}%`}
                </span>
              </div>
              <input
                aria-label="Video earbud volume"
                type="range"
                min={0}
                max={100}
                value={earbudVolume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (earbudsMuted && v > 0) {
                    setEarbudsMuted(false);
                    audioHapticEngine.setEarbudMuted(false);
                  }
                  onChangeEarbudVolume(v);
                }}
                className="resona-slider w-full"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={onTestEarbudAudio}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/10 bg-[#0D0C0F] px-3 py-1.5 text-xs font-medium text-[#F5F2EE] hover:bg-[#221D28] cursor-pointer"
              >
                <Headphones className="h-3.5 w-3.5 text-[#E8C5A5]" />
                <span>Test Earbud Audio</span>
              </button>
              <span className="text-[11px] text-[#8F8898]">
                {sinkFeedback || 'Haptics stay active even if earbuds are muted'}
              </span>
            </div>
          </div>
        </div>

        {/* Channel B: Smartwatch Vibration Only */}
        <div className="rounded-3xl border border-[#E85D75]/30 bg-[#16141A] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E85D75]/15">
                <Watch className="h-5 w-5 text-[#E85D75]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#F5F2EE]">
                  Smartwatch · Vibration Only
                </h3>
                <p className="text-[11px] text-[#A099A8]">
                  Sub-bass &amp; peaks pulse your wrist · Zero sound on watch
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-[#0D0C0F] px-2.5 py-1 font-mono-tabular text-xs text-[#E85D75]">
              <Waves className="h-3.5 w-3.5" />
              {frame.intensity}%
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0D0C0F] px-3 py-2.5 text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium text-[#F5F2EE]">
                  <CheckCircle2
                    className={`h-3.5 w-3.5 shrink-0 ${
                      watch.connected ? 'text-[#E8C5A5]' : 'text-[#8F8898]'
                    }`}
                  />
                  <span className="truncate">{watch.name}</span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-[#8F8898]">
                  {watch.firmwareNote}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={onOpenWatchQr}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-[#E85D75] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
                >
                  <QrCode className="h-3 w-3" />
                  Watch QR
                </button>
                <button
                  type="button"
                  onClick={onOpenDevices}
                  className="min-h-[34px] rounded-lg border border-white/10 bg-[#16141A] px-2.5 py-1 text-[11px] font-medium text-[#D3CDD9] hover:text-[#F5F2EE] cursor-pointer"
                >
                  BLE
                </button>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[#A099A8]">Watch Vibration Intensity</span>
                <span className="font-mono-tabular text-[#E85D75]">{watchIntensityScale}%</span>
              </div>
              <input
                aria-label="Video smartwatch vibration intensity"
                type="range"
                min={0}
                max={100}
                value={watchIntensityScale}
                onChange={(e) => onChangeWatchIntensity(Number(e.target.value))}
                className="resona-slider w-full"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={onTestWatchVibration}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/10 bg-[#0D0C0F] px-3 py-1.5 text-xs font-medium text-[#F5F2EE] hover:bg-[#221D28] cursor-pointer"
              >
                <Waves className="h-3.5 w-3.5 text-[#E85D75]" />
                <span>Test Watch Vibration</span>
              </button>
              <span className="font-mono-tabular text-[11px] text-[#8F8898]">
                {frame.frequencyHz} Hz · Zero audio on watch
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Optional Add-On 2 (₱350/yr · 20s/week): AI Teasing Video Generator */}
      <section className="overflow-hidden rounded-3xl border border-[#E8C5A5]/25 bg-[#16141A] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-[#E85D75]" />
              <h3 className="text-sm font-semibold text-[#F5F2EE]">
                02. Optional Add-On 2 · Teasing AI Video Generator (₱350 / year)
              </h3>
            </div>
            <p className="mt-1 text-xs text-[#A099A8]">
              Your own device videos above are always unlimited with the ₱250 pass. Add this optional AI pack to generate 20s/week of custom teasing AI clips for 1 year.
            </p>
          </div>
          <div className="font-mono-tabular text-xs text-[#E8C5A5]">
            Week {currentWeek}/52 · {remainingWeeklySeconds}s / {session.videoSecondsWeeklyLimit}s left
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-[#0D0C0F] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-[#E8C5A5]">
              This Week&apos;s Tease Theme: {weeklyOffer.title}
            </span>
            <span className="text-[#8F8898]">{weeklyOffer.bonusPerk}</span>
          </div>

          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
            <input
              type="text"
              value={teasePrompt}
              onChange={(e) => setTeasePrompt(e.target.value)}
              placeholder="Describe the teasing mood for your 20-second video..."
              className="h-11 flex-1 rounded-xl border border-white/10 bg-[#16141A] px-3.5 text-sm text-[#F5F2EE] placeholder:text-[#6E6778] focus:border-[#E85D75] focus:outline-none"
            />
            <button
              type="button"
              disabled={generatingTease || unlockingVideoPack}
              onClick={() => void handleGenerateTeaseVideo()}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#E85D75] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d94d66] disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {unlockingVideoPack
                  ? 'Unlocking Add-On 2...'
                  : generatingTease
                  ? 'Choreographing 20s...'
                  : session.addOnVideoUnlocked
                  ? 'Generate 20s Tease Video'
                  : 'Unlock Add-On 2 · ₱350/yr'}
              </span>
            </button>
          </div>
          {teaseError && <p className="mt-2 text-xs text-[#F47286]">{teaseError}</p>}
        </div>

        {generatedTease && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0D0C0F]">
            <canvas
              ref={teaseCanvasRef}
              width={800}
              height={420}
              className="aspect-video w-full object-cover"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3 text-xs">
              <div>
                <span className="font-semibold text-[#F5F2EE]">{generatedTease.title}</span>
                <span className="ml-2 font-mono-tabular text-[#8F8898]">
                  {teaseElapsed.toFixed(1)}s / {generatedTease.durationSeconds}s
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTeasePlaying((p) => !p)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#E85D75] px-3 py-1.5 font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
                >
                  {teasePlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  <span>{teasePlaying ? 'Pause' : 'Play with Watch Pulse'}</span>
                </button>
                <button
                  type="button"
                  disabled={recordingWebm}
                  onClick={handleExportWebm}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/10 bg-[#1B1721] px-3 py-1.5 font-medium text-[#E8C5A5] hover:bg-[#251F2E] disabled:opacity-50 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{recordingWebm ? 'Saving clip...' : 'Save Clip'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="text-xs text-[#8F8898]">
        Active status:{' '}
        {videoUrl
          ? isVideoPlaying
            ? 'Playing device video · Earbuds = Audio Only | Smartwatch = Vibration Only'
            : 'Device video paused'
          : isAmbientPlaying
          ? 'Ambient audio-haptic loop running'
          : 'Idle — browse a video file above'}
        .
      </div>
    </div>
  );
}
