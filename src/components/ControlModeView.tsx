import { Check, Copy, Lock, QrCode, Radio, RefreshCw, Users } from 'lucide-react';
import { useState } from 'react';
import type { PartnerMember, PlanTierId, PulsePattern } from '../types.ts';
import { getPlatformMeta } from '../utils/platform.ts';

interface ControlModeViewProps {
  roomId: string;
  onJoinRoom: (roomId: string, userName: string) => void;
  userName: string;
  wsConnected: boolean;
  members: PartnerMember[];
  selfId: string | null;
  broadcastAudioToPartner: boolean;
  onToggleBroadcastAudio: (val: boolean) => void;
  onSendPartnerPulse: (intensity: number, frequencyHz: number, pattern: PulsePattern) => void;
  lastReceivedNote: string | null;
  planId: PlanTierId;
  onOpenMembership: () => void;
  onOpenQr: () => void;
}

const PRESET_GESTURES: {
  label: string;
  intensity: number;
  frequencyHz: number;
  pattern: PulsePattern;
}[] = [
  { label: 'Soft Tap', intensity: 42, frequencyHz: 60, pattern: 'whisper' },
  { label: 'Heartbeat', intensity: 76, frequencyHz: 54, pattern: 'heartbeat' },
  { label: 'Warm Wave', intensity: 68, frequencyHz: 78, pattern: 'wave' },
  { label: 'Crescendo', intensity: 92, frequencyHz: 118, pattern: 'crescendo' },
];

export function ControlModeView({
  roomId,
  onJoinRoom,
  userName,
  wsConnected,
  members,
  selfId,
  broadcastAudioToPartner,
  onToggleBroadcastAudio,
  onSendPartnerPulse,
  lastReceivedNote,
  planId,
  onOpenMembership,
  onOpenQr,
}: ControlModeViewProps) {
  const [draftRoom, setDraftRoom] = useState(roomId);
  const [draftName, setDraftName] = useState(userName);
  const [copied, setCopied] = useState(false);
  const [padCoords, setPadCoords] = useState<{ x: number; y: number } | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<PulsePattern>('wave');

  const isLocked = planId !== 'lifetime';
  const remotePartners = members.filter((m) => m.id !== selfId);

  const handleGenerateRoom = () => {
    const code = `WMD-${Math.floor(1000 + Math.random() * 9000)}`;
    setDraftRoom(code);
    onJoinRoom(code, draftName);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    setPadCoords({ x, y });

    const hz = Math.round(35 + x * 165);
    const intensity = Math.round(15 + y * 85);
    onSendPartnerPulse(intensity, hz, selectedPattern);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[#F5F2EE]">
          01. Private Room Pairing &amp; Presence
        </h2>
        <div className="text-xs font-mono-tabular text-[#A099A8]">
          {wsConnected ? `Connected · Room ${roomId}` : 'Reconnecting relay...'}
        </div>
      </div>

      {/* Room Pairing & Presence Bar */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#16141A] p-5">
        <div className="grid gap-4 md:grid-cols-12 md:items-end">
          <div className="md:col-span-4">
            <label htmlFor="partner-name" className="block text-xs font-medium text-[#A099A8]">
              Your Display Name
            </label>
            <input
              id="partner-name"
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={24}
              className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-[#0D0C0F] px-3.5 text-sm text-[#F5F2EE] focus:border-[#E85D75] focus:outline-none"
            />
          </div>

          <div className="md:col-span-4">
            <label htmlFor="room-code" className="block text-xs font-medium text-[#A099A8]">
              Private Room Code
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="room-code"
                type="text"
                value={draftRoom}
                onChange={(e) => setDraftRoom(e.target.value.toUpperCase())}
                maxLength={14}
                className="font-mono-tabular h-11 w-full rounded-xl border border-white/10 bg-[#0D0C0F] px-3.5 text-sm uppercase text-[#F5F2EE] focus:border-[#E85D75] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyCode}
                aria-label="Copy room code"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0D0C0F] text-[#F5F2EE] hover:bg-[#221E29] cursor-pointer"
              >
                {copied ? <Check className="h-4 w-4 text-[#E8C5A5]" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 md:col-span-4">
            <button
              type="button"
              onClick={() => onJoinRoom(draftRoom, draftName)}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#E85D75] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer whitespace-nowrap"
            >
              Join
            </button>
            <button
              type="button"
              onClick={handleGenerateRoom}
              aria-label="New random room code"
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#201D27] px-3 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#2A2633] cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              New
            </button>
            <button
              type="button"
              onClick={onOpenQr}
              aria-label="Pair via QR code"
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#201D27] px-3 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#2A2633] cursor-pointer whitespace-nowrap"
            >
              <QrCode className="h-3.5 w-3.5 text-[#E8C5A5]" />
              QR
            </button>
          </div>
        </div>

        {/* Connected Partners List */}
        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[#A099A8]">
              <Users className="h-4 w-4 text-[#E8C5A5]" />
              <span>
                {remotePartners.length > 0
                  ? `${remotePartners.length} partner connected in ${roomId}`
                  : `Waiting for partner to join ${roomId} (open another tab with this code to test live sync)`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isLocked) {
                  onOpenMembership();
                } else {
                  onToggleBroadcastAudio(!broadcastAudioToPartner);
                }
              }}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                broadcastAudioToPartner
                  ? 'bg-[#E85D75] text-white'
                  : 'border border-white/10 bg-[#0D0C0F] text-[#F5F2EE] hover:bg-[#221E29]'
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              <span>
                {broadcastAudioToPartner ? 'Streaming Music Beats Live' : 'Stream My Audio to Partner'}
              </span>
            </button>
          </div>

          {members.length > 0 && (
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0D0C0F] px-3.5 py-2.5 text-xs"
                >
                  <img
                    src={
                      m.id === selfId
                        ? '/src/assets/images/couple_partner_a_1795443282709.jpg'
                        : '/src/assets/images/couple_partner_b_1795443282321.jpg'
                    }
                    alt={m.name}
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 shrink-0 rounded-lg object-cover border border-white/10"
                  />
                  <div className="min-w-0">
                    <span className="font-semibold text-[#F5F2EE] block truncate">
                      {m.name} {m.id === selfId ? '(You)' : ''}
                    </span>
                    <div className="mt-0.5 text-[11px] text-[#8F8898] truncate">
                      {getPlatformMeta(m.platform).shortLabel} · {m.watchConnected ? m.watchName : 'Virtual Watch'} ·{' '}
                      {m.earbudConnected ? m.earbudName : 'Audio Ready'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Interactive Partner Control Surface */}
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#16141A] p-5">
        {isLocked && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0D0C0F]/85 backdrop-blur-sm p-6 text-center">
            <Lock className="h-8 w-8 text-[#E8C5A5]" />
            <h2 className="font-display mt-3 text-xl font-medium text-[#F5F2EE]">
              Unlock Couple Mode · ₱250 Lifetime
            </h2>
            <p className="mt-1.5 max-w-md text-xs text-[#A099A8] leading-relaxed">
              Live long-distance partner touchpad control, multi-device pulse sync, and audio-beat streaming unlock permanently with the ₱250 Lifetime Membership.
            </p>
            <button
              type="button"
              onClick={onOpenMembership}
              className="mt-4 min-h-[44px] rounded-xl bg-[#E85D75] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
            >
              Unlock ₱250 Lifetime Pass
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#F5F2EE]">Remote Tactile Touchpad</h2>
            <p className="mt-0.5 text-xs text-[#A099A8]">
              {lastReceivedNote || 'Send continuous pulse pressure & frequency across distance.'}
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-[#0D0C0F] p-1 border border-white/[0.06]">
            {(['wave', 'heartbeat', 'whisper', 'crescendo'] as PulsePattern[]).map((pat) => (
              <button
                key={pat}
                type="button"
                onClick={() => setSelectedPattern(pat)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer whitespace-nowrap ${
                  selectedPattern === pat
                    ? 'bg-[#25212C] text-[#F5F2EE]'
                    : 'text-[#8F8898] hover:text-[#F5F2EE]'
                }`}
              >
                {pat}
              </button>
            ))}
          </div>
        </div>

        <div
          role="application"
          aria-label="Partner remote control touchpad"
          onPointerDown={handlePointer}
          onPointerMove={(e) => {
            if (e.buttons === 1) handlePointer(e);
          }}
          onPointerUp={() => setPadCoords(null)}
          onPointerLeave={() => setPadCoords(null)}
          className="relative mt-4 h-64 w-full touch-none select-none overflow-hidden rounded-2xl border border-white/10 bg-[#0D0C0F] cursor-crosshair"
        >
          {/* Subtle coordinate grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <span className="text-xs font-medium text-[#8F8898]">
              Press &amp; glide to control partner&apos;s smartwatch
            </span>
            {padCoords && (
              <span className="font-mono-tabular mt-1 text-xs text-[#E8C5A5]">
                {Math.round(35 + padCoords.x * 165)} Hz · {Math.round(15 + padCoords.y * 85)}% intensity
              </span>
            )}
          </div>

          {padCoords && (
            <div
              className="pointer-events-none absolute h-16 w-16 rounded-full border-2 border-[#E85D75] bg-[#E85D75]/25"
              style={{
                left: `${padCoords.x * 100}%`,
                bottom: `${padCoords.y * 100}%`,
                transform: 'translate(-50%, 50%)',
              }}
            />
          )}
        </div>

        {/* One-Tap Tactile Gestures */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {PRESET_GESTURES.map((g) => (
            <button
              key={g.label}
              type="button"
              onClick={() => onSendPartnerPulse(g.intensity, g.frequencyHz, g.pattern)}
              className="flex min-h-[48px] flex-col items-center justify-center rounded-xl border border-white/10 bg-[#0D0C0F] px-3 py-2 text-xs font-medium text-[#F5F2EE] transition-colors hover:border-[#E85D75]/50 hover:bg-[#1E1A22] active:scale-[0.98] cursor-pointer"
            >
              <span>{g.label}</span>
              <span className="font-mono-tabular mt-0.5 text-[11px] text-[#8F8898]">
                {g.frequencyHz} Hz · {g.intensity}%
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
