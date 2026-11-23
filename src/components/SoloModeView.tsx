import { Mic, MicOff, Pause, Play, Sparkles, Upload, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SOUNDSCAPES } from '../data/soundscapes.ts';
import { WEEKLY_OFFERS, getCurrentWeekOfYear } from '../data/weeklyOffers.ts';
import { audioHapticEngine } from '../engines/audioHapticEngine.ts';
import type {
  AddOnId,
  ConversionCurve,
  PlanTierId,
  PulsePattern,
  SoundscapeTrack,
  SubscriptionSession,
  SuggestedPulse,
} from '../types.ts';
import { SoloAiChat } from './SoloAiChat.tsx';

interface SoloModeViewProps {
  activeTrackId: string | null;
  isPlaying: boolean;
  onPlayTrack: (track: SoundscapeTrack) => void;
  onStopPlayback: () => void;
  curve: ConversionCurve;
  onChangeCurve: (curve: ConversionCurve) => void;
  planId: PlanTierId;
  session: SubscriptionSession;
  onActivatePlan: (planId: PlanTierId) => Promise<void>;
  onActivateAddOn: (addOnId: AddOnId) => Promise<void>;
  onPlaySuggestedPulse: (pulse: SuggestedPulse) => void;
  onOpenMembership: () => void;
}

const CURVES: { id: ConversionCurve; label: string; detail: string; lifetimeOnly?: boolean }[] = [
  { id: 'sub-bass', label: 'Sub-Bass Lock', detail: '20–90 Hz deep rhythm' },
  { id: 'heartbeat', label: 'Heartbeat', detail: 'Organic double-pulse cadence', lifetimeOnly: true },
  { id: 'melodic-wave', label: 'Melodic Wave', detail: 'Smooth mid-band swell', lifetimeOnly: true },
  { id: 'transient-spark', label: 'Transient Spark', detail: 'Crisp percussive peaks', lifetimeOnly: true },
];

export function SoloModeView({
  activeTrackId,
  isPlaying,
  onPlayTrack,
  onStopPlayback,
  curve,
  onChangeCurve,
  planId,
  session,
  onActivatePlan,
  onActivateAddOn,
  onPlaySuggestedPulse,
  onOpenMembership,
}: SoloModeViewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [localFileUrl, setLocalFileUrl] = useState<string | null>(null);
  const [localPlaying, setLocalPlaying] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [padPos, setPadPos] = useState<{ x: number; y: number } | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const weekNum = session.currentWeekNumber || getCurrentWeekOfYear();
  const weeklyDrop = WEEKLY_OFFERS[weekNum - 1] || WEEKLY_OFFERS[0];

  useEffect(() => {
    return () => {
      if (localFileUrl) {
        URL.revokeObjectURL(localFileUrl);
      }
    };
  }, [localFileUrl]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (localFileUrl) {
      URL.revokeObjectURL(localFileUrl);
    }
    const url = URL.createObjectURL(file);
    setLocalFileUrl(url);
    setLocalFileName(file.name);
    setMicActive(false);
    onStopPlayback();

    requestAnimationFrame(() => {
      const el = audioRef.current;
      if (el) {
        el.src = url;
        audioHapticEngine.attachMediaElement(el, 'solo');
        void el.play();
        setLocalPlaying(true);
      }
    });
  };

  const toggleLocalAudio = () => {
    const el = audioRef.current;
    if (!el || !localFileUrl) return;
    if (el.paused) {
      onStopPlayback();
      audioHapticEngine.attachMediaElement(el, 'solo');
      void el.play();
      setLocalPlaying(true);
    } else {
      el.pause();
      setLocalPlaying(false);
    }
  };

  const toggleMic = async () => {
    setMicError(null);
    if (micActive) {
      audioHapticEngine.stopMicrophone();
      setMicActive(false);
      return;
    }
    try {
      onStopPlayback();
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setLocalPlaying(false);
      }
      audioHapticEngine.setSourceMode('solo');
      await audioHapticEngine.startMicrophone();
      setMicActive(true);
    } catch (err: unknown) {
      setMicError(
        err instanceof Error
          ? err.message
          : 'Microphone access was blocked. Allow microphone permission to convert voice to watch pulses.'
      );
      setMicActive(false);
    }
  };

  const handlePadPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    setPadPos({ x, y });
    const hz = Math.round(35 + x * 165);
    const intensity = Math.round(15 + y * 85);
    const pattern: PulsePattern = y > 0.7 ? 'crescendo' : x > 0.55 ? 'rhythmic' : 'wave';
    audioHapticEngine.setSourceMode('solo');
    audioHapticEngine.triggerManualPulse(intensity, hz, pattern, 260, false);
  };

  return (
    <div className="space-y-6">
      {/* Subtle Weekly Tease Offer Nudge */}
      {(!session.addOnImageUnlocked || !session.addOnVideoUnlocked || planId === 'free') && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8C5A5]/25 bg-[#1B1721] px-5 py-3.5">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#E8C5A5]" />
            <div>
              <div className="text-xs font-semibold text-[#F5F2EE]">
                Week {weeklyDrop.week} Tease Offer · {weeklyDrop.title}
              </div>
              <p className="mt-0.5 text-[11px] text-[#A099A8]">{weeklyDrop.hook}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenMembership}
            className="min-h-[36px] rounded-xl bg-[#E85D75] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer whitespace-nowrap"
          >
            {planId === 'free' ? 'Unlock ₱250 Lifetime' : 'Explore Add-Ons'}
          </button>
        </div>
      )}

      {/* Curated Soundscapes Grid */}
      <section aria-labelledby="soundscapes-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="soundscapes-heading" className="text-base font-semibold text-[#F5F2EE]">
            01. Sensory Soundscapes
          </h2>
          <span className="text-xs text-[#8F8898]">Synthesized live · Earbuds + Watch</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 items-stretch">
          {SOUNDSCAPES.map((track) => {
            const active = activeTrackId === track.id && isPlaying;
            const imgFailed = Boolean(failedImages[track.id]);
            return (
              <div
                key={track.id}
                className={`group flex flex-col overflow-hidden rounded-2xl border transition-colors ${
                  active
                    ? 'border-[#E85D75]/60 bg-[#1E1A22]'
                    : 'border-white/[0.08] bg-[#16141A] hover:border-white/20'
                }`}
              >
                <div className="relative aspect-square w-full overflow-hidden bg-[#1D1924]">
                  {!imgFailed ? (
                    <img
                      src={track.coverImage}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [track.id]: true }))
                      }
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#2B1B26] to-[#131118] p-4 text-center">
                      <Volume2 className="h-8 w-8 text-[#E85D75]" />
                      <span className="mt-2 text-sm font-medium text-[#F5F2EE]">
                        {track.title}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                  <button
                    type="button"
                    onClick={() => (active ? onStopPlayback() : onPlayTrack(track))}
                    aria-label={active ? `Pause ${track.title}` : `Play ${track.title}`}
                    className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#E85D75] text-white shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    {active ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                  </button>
                </div>

                <div className="p-4">
                  <h3 className="text-base font-semibold text-[#F5F2EE] truncate">
                    {track.title}
                  </h3>
                  <p className="mt-1 text-xs text-[#A099A8] truncate">{track.subtitle}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-[#8F8898] font-mono-tabular">
                    <span>{track.bpm} BPM</span>
                    <span aria-hidden="true">·</span>
                    <span>{track.baseHz} Hz</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Personal Audio & Voice-to-Pulse Inputs */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#16141A] p-5">
          <h3 className="text-sm font-semibold text-[#F5F2EE]">02. Your Music Library</h3>
          <p className="mt-1 text-xs text-[#A099A8] leading-relaxed">
            Load any MP3, WAV, or M4A track from your device. Basslines drive your watch while melodies play in your earbuds.
          </p>

          <audio
            ref={audioRef}
            onEnded={() => setLocalPlaying(false)}
            className="hidden"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-[#201D27] px-4 py-2 text-xs font-medium text-[#F5F2EE] transition-colors hover:bg-[#2A2633]">
              <Upload className="h-4 w-4 text-[#E8C5A5]" />
              <span>{localFileName ? 'Change Audio File' : 'Select Audio File'}</span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>

            {localFileUrl && (
              <button
                type="button"
                onClick={toggleLocalAudio}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E85D75] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#d94d66] cursor-pointer"
              >
                {localPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span className="max-w-[140px] truncate">{localFileName}</span>
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#16141A] p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#F5F2EE]">03. Live Voice-to-Pulse</h3>
            {planId !== 'lifetime' && (
              <button
                type="button"
                onClick={onOpenMembership}
                className="text-xs font-medium text-[#E8C5A5] hover:underline cursor-pointer"
              >
                ₱250 Lifetime
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-[#A099A8] leading-relaxed">
            Speak, hum, or capture room acoustics through your microphone to drive real-time smartwatch pulses without speaker feedback.
          </p>

          <div className="mt-4">
            <button
              type="button"
              onClick={toggleMic}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                micActive
                  ? 'bg-[#E85D75] text-white'
                  : 'border border-white/10 bg-[#201D27] text-[#F5F2EE] hover:bg-[#2A2633]'
              }`}
            >
              {micActive ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-[#E85D75]" />}
              <span>{micActive ? 'Stop Voice Capture' : 'Enable Microphone Pulse'}</span>
            </button>
            {micError && <p className="mt-2 text-xs text-[#F47286]">{micError}</p>}
          </div>
        </div>
      </section>

      {/* Tactile Conversion Curve + Solo Touch Sculptor */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#16141A] p-5">
          <h3 className="text-sm font-semibold text-[#F5F2EE]">04. Audio-to-Pulse Curve</h3>
          <p className="mt-1 text-xs text-[#A099A8]">
            Choose how frequencies map onto your smartwatch linear motor.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CURVES.map((item) => {
              const selected = curve === item.id;
              const locked = item.lifetimeOnly && planId === 'free';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (locked) {
                      onOpenMembership();
                    } else {
                      onChangeCurve(item.id);
                    }
                  }}
                  className={`flex min-h-[56px] flex-col items-start justify-center rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                    selected
                      ? 'border-[#E85D75] bg-[#E85D75]/12 text-[#F5F2EE]'
                      : 'border-white/[0.07] bg-[#0D0C0F] text-[#A099A8] hover:border-white/20 hover:text-[#F5F2EE]'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#F5F2EE]">{item.label}</span>
                    {locked && <span className="text-[11px] text-[#E8C5A5]">₱250</span>}
                  </div>
                  <span className="mt-0.5 text-[11px] text-[#8F8898]">{item.detail}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#16141A] p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#F5F2EE]">05. Solo Touch Sculptor</h3>
            <span className="text-[11px] text-[#8F8898] font-mono-tabular">
              {padPos
                ? `${Math.round(35 + padPos.x * 165)} Hz · ${Math.round(15 + padPos.y * 85)}%`
                : 'Drag to pulse'}
            </span>
          </div>
          <div
            role="application"
            aria-label="Solo tactile touchpad"
            onPointerDown={handlePadPointer}
            onPointerMove={(e) => {
              if (e.buttons === 1) handlePadPointer(e);
            }}
            onPointerUp={() => setPadPos(null)}
            onPointerLeave={() => setPadPos(null)}
            className="relative mt-3 h-40 w-full touch-none select-none overflow-hidden rounded-xl border border-white/10 bg-[#0D0C0F] cursor-crosshair"
          >
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-[#6E6778]">
              Touch &amp; glide — X: Frequency · Y: Intensity
            </div>
            {padPos && (
              <div
                className="pointer-events-none absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#E85D75] bg-[#E85D75]/25"
                style={{
                  left: `${padPos.x * 100}%`,
                  bottom: `${padPos.y * 100}%`,
                  transform: 'translate(-50%, 50%)',
                }}
              />
            )}
          </div>
        </div>
      </section>

      {/* Solo AI Intimate Chat (10 free messages then ₱250 lifetime + Add-On 1 & 2 offer) */}
      <SoloAiChat
        session={session}
        onPlayPulse={onPlaySuggestedPulse}
        onActivatePlan={onActivatePlan}
        onActivateAddOn={onActivateAddOn}
        onOpenMembership={onOpenMembership}
      />
    </div>
  );
}
