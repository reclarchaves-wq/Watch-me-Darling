import { Download, Heart, QrCode, Radio, Watch } from 'lucide-react';
import { useState } from 'react';
import type { AppMode, PartnerMember, PlatformType } from '../types.ts';
import { getPlatformMeta } from '../utils/platform.ts';

interface CoupleHeroStripProps {
  activeMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  roomId: string;
  members: PartnerMember[];
  selfId: string | null;
  wsConnected: boolean;
  onSendQuickHeartbeat: () => void;
  platform: PlatformType;
  watchConnected: boolean;
  earbudConnected: boolean;
  onOpenQr: () => void;
  onOpenInstall: () => void;
}

const MODE_COPY: Record<AppMode, { kicker: string; title: string; subtitle: string }> = {
  solo: {
    kicker: 'Connected across distance',
    title: 'Feel every beat together',
    subtitle:
      'Turn music, voice, and cinema into synchronized smartwatch pulses while sharing warmth in your private room.',
  },
  control: {
    kicker: 'Live partner control',
    title: 'Touch across any distance',
    subtitle:
      'Glide across the sensory pad or stream your music rhythm straight to your partner’s wrist in real time.',
  },
  video: {
    kicker: 'Shared evening cinema',
    title: 'Watch and feel in sync',
    subtitle:
      'Route film soundtracks cleanly to your earbuds while bass swells pulse gently through both smartwatches.',
  },
  chats: {
    kicker: 'Private space for two',
    title: 'Notes you can feel',
    subtitle:
      'Send intimate messages with tactile heartbeat attachments or compose evening moods with the AI concierge.',
  },
  membership: {
    kicker: 'Shared couple membership',
    title: 'One plan for both partners',
    subtitle:
      'Unlock simultaneous earbud + smartwatch dual-link routing, video sync, and unlimited partner rooms.',
  },
};

export function CoupleHeroStrip({
  activeMode,
  onSelectMode,
  roomId,
  members,
  selfId,
  wsConnected,
  onSendQuickHeartbeat,
  platform,
  watchConnected,
  earbudConnected,
  onOpenQr,
  onOpenInstall,
}: CoupleHeroStripProps) {
  const [heroFailed, setHeroFailed] = useState(false);
  const [avatarAFailed, setAvatarAFailed] = useState(false);
  const [avatarBFailed, setAvatarBFailed] = useState(false);

  const copy = MODE_COPY[activeMode];
  const remotePartner = members.find((m) => m.id !== selfId);

  return (
    <section className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
      {/* Left 8 cols: Editorial Couple Hero Card with flush full-height photography */}
      <div className="grid overflow-hidden rounded-3xl border border-white/[0.08] bg-[#16141A] sm:grid-cols-12 lg:col-span-8 lg:items-stretch">
        <div className="flex flex-col justify-between p-6 sm:col-span-7 sm:p-7">
          <div>
            <span className="text-xs font-medium text-[#E8C5A5]">{copy.kicker}</span>
            <h1 className="font-display mt-2 text-3xl font-medium tracking-tight text-[#F5F2EE] text-balance">
              {copy.title}
            </h1>
            <p className="mt-2.5 text-sm text-[#A099A8] leading-relaxed">
              {copy.subtitle}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSendQuickHeartbeat}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E85D75] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#d94d66] active:scale-[0.98] cursor-pointer whitespace-nowrap"
            >
              <Heart className="h-4 w-4" />
              Send Heartbeat
            </button>

            {activeMode !== 'control' && (
              <button
                type="button"
                onClick={() => onSelectMode('control')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-[#0D0C0F] px-4 py-2.5 text-xs font-medium text-[#F5F2EE] transition-colors hover:bg-[#221E29] cursor-pointer whitespace-nowrap"
              >
                <Radio className="h-4 w-4 text-[#E8C5A5]" />
                Partner Control
              </button>
            )}
          </div>
        </div>

        <div className="relative min-h-[210px] bg-[#0D0C0F] sm:col-span-5">
          {!heroFailed ? (
            <img
              src="/src/assets/images/couple_distance_hero_1795443282892.jpg"
              alt="Wrist wearing a smartwatch in warm evening light"
              referrerPolicy="no-referrer"
              onError={() => setHeroFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2B1B26] to-[#0D0C0F]">
              <Watch className="h-9 w-9 text-[#E8C5A5]" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#16141A]/75 via-transparent to-transparent sm:bg-gradient-to-r sm:from-[#16141A] sm:via-transparent sm:to-transparent" />
        </div>
      </div>

      {/* Right 4 cols: Couple Portrait Connection Card aligned flush with hero */}
      <div className="flex flex-col justify-between rounded-3xl border border-white/[0.08] bg-[#16141A] p-6 lg:col-span-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[#F5F2EE]">Couple Bridge</span>
          <span className="font-mono-tabular text-xs text-[#E8C5A5]">
            Room {roomId}
          </span>
        </div>

        {/* Paired Portraits */}
        <div className="my-5 flex items-center justify-between gap-3">
          <div className="flex flex-col items-center text-center">
            <div className="h-20 w-20 overflow-hidden rounded-2xl border border-[#E85D75]/50 bg-[#0D0C0F]">
              {!avatarAFailed ? (
                <img
                  src="/src/assets/images/couple_partner_a_1795443282709.jpg"
                  alt="Your profile"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarAFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#F5F2EE]">
                  You
                </div>
              )}
            </div>
            <span className="mt-2 text-xs font-semibold text-[#F5F2EE]">You</span>
            <span className="text-[11px] text-[#8F8898]">
              {getPlatformMeta(platform).shortLabel} · {watchConnected ? 'Watch' : 'Sim'} &amp; {earbudConnected ? 'Buds' : 'Audio'}
            </span>
          </div>

          {/* Connecting Bridge Line */}
          <div className="flex flex-1 flex-col items-center justify-center px-1">
            <div className="flex w-full items-center gap-1">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-[#E85D75]/60 to-[#E8C5A5]/60" />
              <Heart className="h-4 w-4 shrink-0 text-[#E85D75]" />
              <div className="h-[1px] flex-1 bg-gradient-to-r from-[#E8C5A5]/60 to-[#E85D75]/60" />
            </div>
            <span className="mt-1.5 text-[11px] text-[#A099A8] whitespace-nowrap">
              {remotePartner
                ? 'Synced live'
                : wsConnected
                ? 'Ready to pair'
                : 'Connecting'}
            </span>
          </div>

          <div className="flex flex-col items-center text-center">
            <div
              className={`h-20 w-20 overflow-hidden rounded-2xl border bg-[#0D0C0F] ${
                remotePartner ? 'border-[#E8C5A5]/70' : 'border-white/10 opacity-75'
              }`}
            >
              {!avatarBFailed ? (
                <img
                  src="/src/assets/images/couple_partner_b_1795443282321.jpg"
                  alt={remotePartner ? remotePartner.name : 'Partner slot'}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarBFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#F5F2EE]">
                  {remotePartner ? remotePartner.name : 'Partner'}
                </div>
              )}
            </div>
            <span className="mt-2 text-xs font-semibold text-[#F5F2EE] max-w-[96px] truncate">
              {remotePartner ? remotePartner.name : 'Partner'}
            </span>
            <span className="text-[11px] text-[#8F8898]">
              {remotePartner
                ? `${getPlatformMeta(remotePartner.platform).shortLabel} · Online`
                : 'Share room code'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3.5 text-xs text-[#A099A8]">
          <button
            type="button"
            onClick={onOpenQr}
            className="inline-flex items-center gap-1.5 font-medium text-[#F5F2EE] hover:text-[#E8C5A5] cursor-pointer whitespace-nowrap"
          >
            <QrCode className="h-3.5 w-3.5 text-[#E85D75]" />
            QR Pair
          </button>
          <button
            type="button"
            onClick={onOpenInstall}
            className="inline-flex items-center gap-1 font-medium text-[#E8C5A5] hover:underline cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            App / APK
          </button>
          <button
            type="button"
            onClick={() => onSelectMode('chats')}
            className="font-medium text-[#E8C5A5] hover:underline cursor-pointer whitespace-nowrap"
          >
            Open Chat
          </button>
        </div>
      </div>
    </section>
  );
}
