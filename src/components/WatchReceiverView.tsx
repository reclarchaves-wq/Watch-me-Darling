import { ArrowLeft, CheckCircle2, Vibrate, Watch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DarlingWordmark } from './DarlingWordmark.tsx';

interface WatchReceiverViewProps {
  watchCode: string;
  wsConnected: boolean;
  lastPulse: { intensity: number; frequencyHz: number; timestamp: number } | null;
  onExitReceiverMode: () => void;
}

export function WatchReceiverView({
  watchCode,
  wsConnected,
  lastPulse,
  onExitReceiverMode,
}: WatchReceiverViewProps) {
  const [motorEnabled, setMotorEnabled] = useState(false);

  useEffect(() => {
    if (!lastPulse || !motorEnabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      if (lastPulse.intensity > 8) {
        const ms = Math.max(18, Math.min(90, Math.round((lastPulse.intensity / 100) * 85)));
        navigator.vibrate(ms);
      }
    }
  }, [lastPulse, motorEnabled]);

  const handleEnableMotor = () => {
    setMotorEnabled(true);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([45, 40, 75]);
    }
  };

  const intensity = lastPulse?.intensity ?? 0;
  const hz = lastPulse?.frequencyHz ?? 54;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#09080B] px-4 py-8 text-center text-[#F5F2EE]">
      <DarlingWordmark variant="compact" />

      <div className="mt-6 w-full max-w-sm rounded-3xl border border-[#E85D75]/40 bg-[#16141A] p-6 shadow-2xl">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E8C5A5]">
          <Watch className="h-4 w-4 text-[#E85D75]" />
          <span>SMARTWATCH WRIST RECEIVER · VIBRATION ONLY</span>
        </div>

        <div className="my-6 flex flex-col items-center">
          <div
            className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-2 border-[#E85D75] bg-[#0D0C0F] transition-transform duration-75"
            style={{
              transform: `scale(${1 + (intensity / 100) * 0.16})`,
            }}
          >
            <span className="font-mono-tabular text-3xl font-semibold text-[#F5F2EE]">
              {intensity}%
            </span>
            <span className="font-mono-tabular mt-1 text-xs text-[#E8C5A5]">{hz} Hz</span>
            <span className="mt-1 text-[10px] text-[#8F8898]">Zero Watch Audio</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-[#D3CDD9]">
          <CheckCircle2 className="h-4 w-4 text-[#E8C5A5]" />
          <span>
            {wsConnected
              ? `Paired via QR (${watchCode})`
              : 'Connecting watch channel...'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleEnableMotor}
          className={`mt-5 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
            motorEnabled
              ? 'border border-[#E8C5A5]/45 bg-[#0D0C0F] text-[#E8C5A5]'
              : 'bg-[#E85D75] text-white hover:bg-[#d94d66]'
          }`}
        >
          <Vibrate className="h-4 w-4" />
          <span>
            {motorEnabled ? 'Watch Vibration Motor Active' : 'Tap to Activate Watch Vibration'}
          </span>
        </button>

        <button
          type="button"
          onClick={onExitReceiverMode}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#8F8898] hover:text-[#F5F2EE] cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Open Full Watch me Darling App
        </button>
      </div>
    </div>
  );
}
