import { Download, Headphones, QrCode, Watch, Waves } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import type {
  EarbudDeviceState,
  HapticFrame,
  PlatformType,
  WatchDeviceState,
} from '../types.ts';
import { PLATFORM_EDITIONS } from '../utils/platform.ts';

interface WatchHapticVisualizerProps {
  frame: HapticFrame;
  watch: WatchDeviceState;
  earbud: EarbudDeviceState;
  platform: PlatformType;
  onChangePlatform: (p: PlatformType) => void;
  watchIntensityScale: number;
  onChangeWatchIntensity: (val: number) => void;
  earbudVolume: number;
  onChangeEarbudVolume: (val: number) => void;
  onOpenDevices: () => void;
  onOpenWatchQr: () => void;
  onOpenInstall: () => void;
  onTestWatchVibration: () => void;
  onTestEarbudAudio: () => void;
}

export function WatchHapticVisualizer({
  frame,
  watch,
  earbud,
  platform,
  onChangePlatform,
  watchIntensityScale,
  onChangeWatchIntensity,
  earbudVolume,
  onChangeEarbudVolume,
  onOpenDevices,
  onOpenWatchQr,
  onOpenInstall,
  onTestWatchVibration,
  onTestEarbudAudio,
}: WatchHapticVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HapticFrame>(frame);
  frameRef.current = frame;
  const { isInstalled, isInstallable } = usePWAInstall();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phase = 0;

    const render = () => {
      const f = frameRef.current;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const amp = Math.max(2, (f.intensity / 100) * (h * 0.36));
      const freq = 0.03 + (f.frequencyHz / 220) * 0.07;
      phase += 0.08 + (f.intensity / 100) * 0.14;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      ctx.strokeStyle = f.intensity > 4 ? '#E85D75' : 'rgba(232, 93, 117, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const env = Math.sin((x / w) * Math.PI);
        const y =
          h / 2 +
          Math.sin(x * freq + phase) * amp * env +
          Math.cos(x * freq * 0.5 - phase * 0.7) * (amp * 0.25) * env;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  const ringScale = 1 + (frame.intensity / 100) * 0.22;
  const ringOpacity = 0.15 + (frame.intensity / 100) * 0.7;

  return (
    <aside className="rounded-3xl border border-white/[0.08] bg-[#16141A] p-5 sm:p-6">
      {/* 5-Edition Device Selector (PC, Android PC, iPad iOS 10.0+, iPhone, Android Phone) */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#A099A8]">Device Edition</span>
          <span className="text-[11px] text-[#E8C5A5]">5 Platforms Ready</span>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1 rounded-xl bg-[#0D0C0F] p-1 border border-white/[0.06]">
          {PLATFORM_EDITIONS.map((ed) => (
            <button
              key={ed.id}
              type="button"
              onClick={() => onChangePlatform(ed.id)}
              title={ed.osSpec}
              className={`rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors cursor-pointer whitespace-nowrap truncate ${
                platform === ed.id
                  ? 'bg-[#25212C] text-[#F5F2EE]'
                  : 'text-[#8F8898] hover:text-[#F5F2EE]'
              }`}
            >
              {ed.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Circular Smartwatch Tactile Dial */}
      <div className="my-6 flex flex-col items-center">
        <div className="relative flex h-44 w-44 items-center justify-center">
          <div
            className="absolute inset-0 rounded-full border border-[#E85D75]/50 transition-transform duration-75 will-change-transform"
            style={{
              transform: `scale(${ringScale})`,
              opacity: ringOpacity,
            }}
          />
          <div
            className="absolute inset-3 rounded-full border border-[#E8C5A5]/30 transition-transform duration-100 will-change-transform"
            style={{
              transform: `scale(${1 + (frame.intensity / 100) * 0.12})`,
              opacity: ringOpacity * 0.85,
            }}
          />

          <div className="relative flex h-36 w-36 flex-col items-center justify-center rounded-full border border-white/15 bg-[#0D0C0F] shadow-xl">
            <span className="text-[11px] font-medium text-[#A099A8]">
              {frame.intensity > 2 ? frame.pattern : 'Standby'}
            </span>
            <span className="font-mono-tabular mt-1 text-3xl font-semibold text-[#F5F2EE]">
              {frame.intensity}%
            </span>
            <span className="font-mono-tabular mt-1 text-xs text-[#E8C5A5]">
              {frame.frequencyHz} Hz
            </span>
          </div>
        </div>

        <div className="mt-4 w-full overflow-hidden rounded-xl border border-white/[0.06] bg-[#0D0C0F] px-2 py-1.5">
          <canvas ref={canvasRef} width={320} height={48} className="h-12 w-full" />
        </div>
      </div>

      {/* Unboxed Tabular Metrics */}
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs text-[#A099A8]">
        <span className="font-mono-tabular">Sub-bass {frame.subBassEnergy}%</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono-tabular">Mid {frame.midEnergy}%</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono-tabular">Mode {frame.sourceMode}</span>
      </div>

      {/* Dual Simultaneous Output Controls: Smartwatch (Vibration Only) + Earbuds (Audio Only) */}
      <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-medium text-[#F5F2EE]">
              <Watch className="h-4 w-4 text-[#E85D75]" />
              <span className="truncate max-w-[175px]">{watch.name}</span>
            </span>
            <span className="font-mono-tabular text-[#A099A8]">{watchIntensityScale}%</span>
          </div>
          <input
            aria-label="Smartwatch vibration intensity"
            type="range"
            min={0}
            max={100}
            value={watchIntensityScale}
            onChange={(e) => onChangeWatchIntensity(Number(e.target.value))}
            className="resona-slider w-full"
          />
          <p className="mt-1 text-[11px] text-[#8F8898]">
            Vibration only (no sound on watch) ·{' '}
            {watch.connected ? watch.firmwareNote : 'BLE GATT ready'}
            {watch.batteryLevel !== null ? ` · ${watch.batteryLevel}%` : ''}
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-medium text-[#F5F2EE]">
              <Headphones className="h-4 w-4 text-[#E8C5A5]" />
              <span className="truncate max-w-[175px]">{earbud.label}</span>
            </span>
            <span className="font-mono-tabular text-[#A099A8]">{earbudVolume}%</span>
          </div>
          <input
            aria-label="Earbud sounds and audio volume"
            type="range"
            min={0}
            max={100}
            value={earbudVolume}
            onChange={(e) => onChangeEarbudVolume(Number(e.target.value))}
            className="resona-slider w-full"
          />
          <p className="mt-1 text-[11px] text-[#8F8898]">
            Sounds &amp; audio only · Music, voice &amp; video audio route here
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={onTestWatchVibration}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#1E1B24] px-3 py-2 text-xs font-medium text-[#F5F2EE] transition-colors hover:bg-[#282430] cursor-pointer whitespace-nowrap"
          >
            <Waves className="h-4 w-4 text-[#E85D75]" />
            Watch Vibrate
          </button>
          <button
            type="button"
            onClick={onTestEarbudAudio}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#1E1B24] px-3 py-2 text-xs font-medium text-[#F5F2EE] transition-colors hover:bg-[#282430] cursor-pointer whitespace-nowrap"
          >
            <Headphones className="h-4 w-4 text-[#E8C5A5]" />
            Earbud Audio
          </button>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenWatchQr}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#E85D75] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#d94d66] cursor-pointer whitespace-nowrap"
            >
              <QrCode className="h-3.5 w-3.5" />
              Watch QR
            </button>
            <button
              type="button"
              onClick={onOpenDevices}
              className="flex min-h-[44px] items-center justify-center rounded-xl border border-[#E85D75]/40 bg-[#E85D75]/10 px-3 py-2 text-xs font-medium text-[#F5F2EE] transition-colors hover:bg-[#E85D75]/20 cursor-pointer whitespace-nowrap"
            >
              Device Bridge
            </button>
          </div>

          {!isInstalled && (
            <button
              type="button"
              onClick={onOpenInstall}
              className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0D0C0F] px-3 py-2 text-xs font-medium text-[#E8C5A5] transition-colors hover:bg-[#1E1922] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>
                {isInstallable
                  ? 'Install App (PC / Android / APK / iOS)'
                  : 'Install Guide: PC · iPad 10+ · iPhone · APK'}
              </span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
