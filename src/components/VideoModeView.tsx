import { Download, Film, Lock, Pause, Play, Radio, Sparkles, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { WEEKLY_OFFERS, getCurrentWeekOfYear } from '../data/weeklyOffers.ts';
import { audioHapticEngine } from '../engines/audioHapticEngine.ts';
import { drawTeaseVideoFrame, getActiveTeaseScene } from '../engines/sensoryMediaRenderer.ts';
import type {
  AddOnId,
  GeneratedTeaseVideo,
  HapticFrame,
  PlanTierId,
  SubscriptionSession,
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
}: VideoModeViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ambientCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const teaseCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>('Ambient Cinema Loop');
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [latencyOffsetMs, setLatencyOffsetMs] = useState(0);
  const [posterFailed, setPosterFailed] = useState(false);

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

  const isLocked = planId !== 'lifetime';
  const remainingWeeklySeconds = Math.max(
    0,
    session.videoSecondsWeeklyLimit - session.videoSecondsUsedThisWeek
  );

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
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
        void vid.play();
        setIsVideoPlaying(true);
      } else if (remoteVideoCommand.action === 'pause') {
        vid.pause();
        setIsVideoPlaying(false);
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

  const handleUploadVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) {
      onOpenMembership();
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const nextUrl = URL.createObjectURL(file);
    setVideoUrl(nextUrl);
    setVideoName(file.name);
    setIsAmbientPlaying(false);
    audioHapticEngine.stopAllSources();

    requestAnimationFrame(() => {
      const vid = videoRef.current;
      if (vid) {
        vid.src = nextUrl;
        audioHapticEngine.attachMediaElement(vid, 'video');
        void vid.play();
        setIsVideoPlaying(true);
      }
    });
  };

  const toggleAmbientCinema = () => {
    if (isLocked) {
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
          01. Unlimited Device Video Player
        </h2>
        <span className="text-xs text-[#E8C5A5]">
          Included in ₱250 Download Pass · Unlimited playback · Earbud Audio + Watch Vibration
        </span>
      </div>

      {/* Main Video Stage */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#16141A]">
        {isLocked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0D0C0F]/88 backdrop-blur-sm p-6 text-center">
            <Lock className="h-8 w-8 text-[#E8C5A5]" />
            <h2 className="font-display mt-3 text-xl font-medium text-[#F5F2EE]">
              Unlimited Video Mode · Included in ₱250 First Payment
            </h2>
            <p className="mt-1.5 max-w-md text-xs text-[#A099A8] leading-relaxed">
              Browse any video file on your phone or computer and play it without limits—audio routes to your earbuds while bass &amp; peaks vibrate your smartwatch.
            </p>
            <button
              type="button"
              onClick={onOpenMembership}
              className="mt-4 min-h-[44px] rounded-xl bg-[#E85D75] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
            >
              Unlock ₱250 Lifetime Membership
            </button>
          </div>
        )}

        <div className="relative aspect-video w-full bg-[#0D0C0F]">
          {videoUrl ? (
            <video
              ref={videoRef}
              controls
              playsInline
              onPlay={() => {
                if (videoRef.current) {
                  audioHapticEngine.attachMediaElement(videoRef.current, 'video');
                  setIsVideoPlaying(true);
                  if (syncWithPartner) onEmitVideoSync('play', videoRef.current.currentTime);
                }
              }}
              onPause={() => {
                setIsVideoPlaying(false);
                if (syncWithPartner && videoRef.current) {
                  onEmitVideoSync('pause', videoRef.current.currentTime);
                }
              }}
              onSeeked={() => {
                if (syncWithPartner && videoRef.current) {
                  onEmitVideoSync('seek', videoRef.current.currentTime);
                }
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
                    Browse any device video for unlimited Earbud audio + {frame.intensity}% Watch vibration
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-[#E85D75] px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-[#d94d66]">
                    <Upload className="h-4 w-4" />
                    <span>Browse Device Video</span>
                    <input
                      type="file"
                      accept="video/*,.mp4,.mov,.m4v,.webm"
                      onChange={handleUploadVideo}
                      className="sr-only"
                    />
                  </label>
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

        {/* Video Transport & Sync Calibration */}
        <div className="grid gap-4 border-t border-white/[0.06] p-5 sm:grid-cols-2 lg:grid-cols-3 lg:items-center">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-[#201D27] px-4 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#2A2633]">
              <Upload className="h-4 w-4 text-[#E8C5A5]" />
              <span>{videoUrl ? 'Change Device Video' : 'Browse Video File'}</span>
              <input
                type="file"
                accept="video/*,.mp4,.mov,.m4v,.webm"
                onChange={handleUploadVideo}
                className="sr-only"
              />
            </label>
            {videoUrl && (
              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) videoRef.current.pause();
                  URL.revokeObjectURL(videoUrl);
                  setVideoUrl(null);
                  setVideoName('Ambient Cinema Loop');
                  setIsVideoPlaying(false);
                }}
                className="min-h-[44px] rounded-xl border border-white/10 bg-[#0D0C0F] px-3 py-2 text-xs text-[#A099A8] hover:text-[#F5F2EE] cursor-pointer"
              >
                Use Ambient Loop
              </button>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-[#A099A8]">Bluetooth Watch Offset</span>
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
              onChange={(e) => setLatencyOffsetMs(Number(e.target.value))}
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
        Active status: {videoUrl ? (isVideoPlaying ? 'Extracting video audio track' : 'Video paused') : isAmbientPlaying ? 'Ambient audio-haptic loop running' : 'Idle'} · Watch pulse active in dual-link bridge.
      </div>
    </div>
  );
}
