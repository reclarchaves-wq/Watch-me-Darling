import { Calendar, Check, Copy, Crown, Download, Film, Image as ImageIcon, ShieldCheck, Sparkles, Store } from 'lucide-react';
import { useState } from 'react';
import { STORE_LISTINGS } from '../data/storeListing.ts';
import { WEEKLY_OFFERS, getCurrentWeekOfYear } from '../data/weeklyOffers.ts';
import type {
  AddOnId,
  AddOnPackage,
  PlanTierId,
  SubscriptionPlan,
  SubscriptionSession,
} from '../types.ts';

interface MembershipViewProps {
  plans: SubscriptionPlan[];
  addOns: AddOnPackage[];
  session: SubscriptionSession;
  onActivatePlan: (planId: PlanTierId) => Promise<void>;
  onActivateAddOn: (addOnId: AddOnId) => Promise<void>;
  onOpenInstall: () => void;
}

export function MembershipView({
  plans,
  addOns,
  session,
  onActivatePlan,
  onActivateAddOn,
  onOpenInstall,
}: MembershipViewProps) {
  const [activatingKey, setActivatingKey] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [selectedStore, setSelectedStore] = useState<'playstore' | 'appstore'>('playstore');
  const [copiedStore, setCopiedStore] = useState(false);

  const currentWeek = session.currentWeekNumber || getCurrentWeekOfYear();
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek);
  const activeOffer = WEEKLY_OFFERS[selectedWeek - 1] || WEEKLY_OFFERS[0];
  const storeCopy = STORE_LISTINGS[selectedStore];

  const handleCopyStoreListing = async () => {
    const formatted = `${storeCopy.appTitle}\n${storeCopy.subtitleOrShort}\n\n${storeCopy.promoLine}\n\n${storeCopy.fullDescription}\n\nWhat's New:\n${storeCopy.whatsNew}`;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedStore(true);
      setTimeout(() => setCopiedStore(false), 2000);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  const handleSelectPlan = async (id: PlanTierId) => {
    setActivatingKey(id);
    try {
      await onActivatePlan(id);
    } finally {
      setActivatingKey(null);
    }
  };

  const handleSelectAddOn = async (id: AddOnId) => {
    setActivatingKey(id);
    try {
      await onActivateAddOn(id);
    } finally {
      setActivatingKey(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hardware & Lifetime Membership Hero */}
      <section className="grid overflow-hidden rounded-3xl border border-white/[0.08] bg-[#16141A] lg:grid-cols-12 lg:items-stretch">
        <div className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-7">
          <div>
            <span className="text-xs font-medium text-[#E8C5A5]">
              Watch me Darling · Strictly 18+ Adults Only · Lifetime Download Access
            </span>
            <h2 className="font-display mt-2 text-2xl font-medium tracking-tight text-[#F5F2EE] text-balance">
              ₱250 First Payment: Unlimited Solo, Couple &amp; Video Mode
            </h2>
            <p className="mt-2.5 text-sm text-[#A099A8] leading-relaxed">
              Keep earbuds tuned to audio while your smartwatch translates every beat into silent vibration pulses—unlock unlimited Solo Mode, Couple Mode, and device Video File playback upon download, then optionally add AI chat imagery or weekly teasing AI clips.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-5 text-xs text-[#A099A8]">
            <div>
              Status:{' '}
              <span className="font-semibold text-[#F5F2EE]">
                {session.planId === 'lifetime' ? '₱250 Lifetime Unlocked' : 'Download Preview (10 Free Solo AI msgs)'}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenInstall}
              className="inline-flex items-center gap-1.5 font-medium text-[#E8C5A5] hover:underline cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>PC · Android PC · iPad iOS 10+ · iPhone · APK</span>
            </button>
          </div>
        </div>

        <div className="relative min-h-[220px] bg-[#0D0C0F] lg:col-span-5">
          {!heroImgFailed ? (
            <img
              src="/src/assets/images/hardware_duo_hero_1795442376770.jpg"
              alt="Matte obsidian smartwatch and wireless earbud hardware pairing"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#231820] to-[#0D0C0F] p-6">
              <Crown className="h-10 w-10 text-[#E8C5A5]" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#16141A] via-transparent to-transparent lg:block hidden" />
        </div>
      </section>

      {/* Core Membership Plans: Preview (₱0) & Lifetime (₱250) */}
      <section className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = session.planId === plan.id;
          const highlighted = plan.id === 'lifetime';

          return (
            <div
              key={plan.id}
              className={`flex flex-col justify-between rounded-3xl border p-6 transition-colors ${
                highlighted
                  ? 'border-[#E85D75]/60 bg-[#1B1721]'
                  : 'border-white/[0.08] bg-[#16141A]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-[#F5F2EE]">{plan.name}</h2>
                  {isCurrent && (
                    <span className="text-xs font-medium text-[#E8C5A5]">Active</span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-[#A099A8] leading-relaxed">{plan.tagline}</p>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-mono-tabular text-3xl font-semibold text-[#F5F2EE]">
                    ₱{plan.pricePhp}
                  </span>
                  <span className="text-xs text-[#8F8898]">{plan.billingLabel}</span>
                </div>

                <ul className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-5">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-xs text-[#D3CDD9]">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E85D75]" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                disabled={activatingKey === plan.id}
                onClick={() => void handleSelectPlan(plan.id)}
                className={`mt-6 flex min-h-[44px] w-full items-center justify-center rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                  isCurrent
                    ? 'border border-white/15 bg-[#0D0C0F] text-[#F5F2EE]'
                    : highlighted
                    ? 'bg-[#E85D75] text-white hover:bg-[#d94d66]'
                    : 'bg-[#24202B] text-[#F5F2EE] hover:bg-[#2F2A38]'
                }`}
              >
                {activatingKey === plan.id
                  ? 'Updating...'
                  : isCurrent
                  ? 'Active Membership'
                  : plan.id === 'free'
                  ? 'Switch to Preview'
                  : 'Unlock Lifetime Pass · ₱250'}
              </button>
            </div>
          );
        })}
      </section>

      {/* Add-On 1 (₱150) & Add-On 2 (₱350/yr) */}
      <section aria-labelledby="addons-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="addons-heading" className="text-base font-semibold text-[#F5F2EE]">
            Sensory AI Add-On Packages
          </h3>
          <span className="text-xs text-[#8F8898]">
            Pair with your ₱250 Lifetime Membership anytime
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {addOns.map((addon) => {
            const unlocked =
              addon.id === 'image-pack'
                ? session.addOnImageUnlocked
                : session.addOnVideoUnlocked;

            return (
              <div
                key={addon.id}
                className={`flex flex-col justify-between rounded-3xl border p-6 ${
                  unlocked
                    ? 'border-[#E8C5A5]/60 bg-[#1B1720]'
                    : 'border-white/[0.08] bg-[#16141A]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {addon.id === 'image-pack' ? (
                        <ImageIcon className="h-4 w-4 text-[#E8C5A5]" />
                      ) : (
                        <Film className="h-4 w-4 text-[#E85D75]" />
                      )}
                      <h4 className="text-base font-semibold text-[#F5F2EE]">{addon.name}</h4>
                    </div>
                    {unlocked && (
                      <span className="text-xs font-medium text-[#E8C5A5]">Unlocked</span>
                    )}
                  </div>

                  <p className="mt-1.5 text-xs text-[#A099A8] leading-relaxed">{addon.tagline}</p>

                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="font-mono-tabular text-2xl font-semibold text-[#E8C5A5]">
                      ₱{addon.pricePhp}
                    </span>
                    <span className="text-xs text-[#8F8898]">{addon.billingLabel}</span>
                  </div>

                  <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
                    {addon.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-xs text-[#D3CDD9]">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E8C5A5]" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={unlocked || activatingKey === addon.id}
                  onClick={() => void handleSelectAddOn(addon.id)}
                  className={`mt-6 flex min-h-[44px] w-full items-center justify-center rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                    unlocked
                      ? 'border border-[#E8C5A5]/40 bg-[#0D0C0F] text-[#E8C5A5]'
                      : 'bg-[#E85D75] text-white hover:bg-[#d94d66]'
                  }`}
                >
                  {activatingKey === addon.id
                    ? 'Unlocking...'
                    : unlocked
                    ? 'Add-On Active'
                    : `Unlock for ₱${addon.pricePhp}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Weekly Creative Drop & Add-On Offer Calendar (52 Weeks / 1 Year) */}
      <section className="rounded-3xl border border-[#E8C5A5]/25 bg-[#16141A] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#E8C5A5]" />
            <h3 className="text-base font-semibold text-[#F5F2EE]">
              52-Week Creative Tease &amp; Add-On Offers (1 Year)
            </h3>
          </div>
          <span className="font-mono-tabular text-xs text-[#E8C5A5]">
            1 new offer every week for 52 weeks
          </span>
        </div>

        {/* Highlighted Week Card */}
        <div className="mt-4 rounded-2xl border border-[#E85D75]/40 bg-[#0D0C0F] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-[#E8C5A5]">
                <Sparkles className="h-3.5 w-3.5" />
                <span>
                  Week {activeOffer.week} Drop {activeOffer.week === currentWeek ? '(Live This Week)' : '(Preview)'}
                </span>
              </div>
              <h4 className="font-display mt-1.5 text-xl font-medium text-[#F5F2EE]">
                {activeOffer.title}
              </h4>
              <p className="mt-1.5 text-xs text-[#A099A8] leading-relaxed">
                {activeOffer.hook}
              </p>
              <div className="mt-2.5 text-[11px] text-[#8F8898]">
                Teaser Prompt: <span className="text-[#D3CDD9]">{activeOffer.teasePrompt}</span> · {activeOffer.bonusPerk}
              </div>
            </div>

            <button
              type="button"
              disabled={activatingKey !== null}
              onClick={() => void handleSelectAddOn(activeOffer.recommendedAddOn)}
              className="min-h-[44px] rounded-xl bg-[#E85D75] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer whitespace-nowrap"
            >
              {activeOffer.recommendedAddOn === 'video-pack'
                ? session.addOnVideoUnlocked
                  ? 'Add-On 2 Active (20s/wk)'
                  : 'Claim with Add-On 2 · ₱350/yr'
                : session.addOnImageUnlocked
                ? 'Add-On 1 Active'
                : 'Claim with Add-On 1 · ₱150'}
            </button>
          </div>
        </div>

        {/* Interactive 52-Week Calendar Strip */}
        <div className="mt-4">
          <div className="mb-2 text-xs text-[#8F8898]">
            Browse all 52 weekly drops across the year:
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8 md:grid-cols-13">
            {WEEKLY_OFFERS.map((offer) => {
              const selected = offer.week === selectedWeek;
              const isNow = offer.week === currentWeek;
              return (
                <button
                  key={offer.week}
                  type="button"
                  onClick={() => setSelectedWeek(offer.week)}
                  className={`font-mono-tabular rounded-lg border py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                    selected
                      ? 'border-[#E85D75] bg-[#E85D75] text-white'
                      : isNow
                      ? 'border-[#E8C5A5]/60 bg-[#1E1922] text-[#E8C5A5]'
                      : 'border-white/[0.06] bg-[#0D0C0F] text-[#8F8898] hover:border-white/20 hover:text-[#F5F2EE]'
                  }`}
                >
                  W{offer.week}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* App Store & Google Play Store Pre-Download Product Description */}
      <section
        aria-labelledby="store-listing-heading"
        className="rounded-3xl border border-white/[0.08] bg-[#16141A] p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-[#E85D75]" />
              <h3 id="store-listing-heading" className="text-base font-semibold text-[#F5F2EE]">
                App Store &amp; Play Store Product Description
              </h3>
            </div>
            <p className="mt-1 text-xs text-[#A099A8]">
              Pre-download storefront copy highlighting Solo leisure, long-distance couple touch, and unlimited ₱250 core access.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#0D0C0F] p-1">
              <button
                type="button"
                onClick={() => setSelectedStore('playstore')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  selectedStore === 'playstore'
                    ? 'bg-[#E85D75] text-white'
                    : 'text-[#8F8898] hover:text-[#F5F2EE]'
                }`}
              >
                Play Store
              </button>
              <button
                type="button"
                onClick={() => setSelectedStore('appstore')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  selectedStore === 'appstore'
                    ? 'bg-[#E85D75] text-white'
                    : 'text-[#8F8898] hover:text-[#F5F2EE]'
                }`}
              >
                App Store
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleCopyStoreListing()}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/10 bg-[#0D0C0F] px-3.5 py-1.5 text-xs font-medium text-[#E8C5A5] hover:bg-[#221D28] cursor-pointer whitespace-nowrap"
            >
              {copiedStore ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedStore ? 'Copied Listing' : 'Copy Store Copy'}</span>
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-4 rounded-2xl border border-white/[0.06] bg-[#0D0C0F] p-5">
          <div className="border-b border-white/[0.06] pb-4">
            <div className="text-[11px] font-medium text-[#E8C5A5]">
              {storeCopy.storeLabel} · Title &amp; {selectedStore === 'playstore' ? 'Short Description' : 'Subtitle'}
            </div>
            <h4 className="font-display mt-1 text-xl font-medium text-[#F5F2EE]">
              {storeCopy.appTitle}
            </h4>
            <p className="mt-1 text-xs font-medium text-[#D3CDD9]">
              {storeCopy.subtitleOrShort}
            </p>
            <p className="mt-2 text-xs text-[#E8C5A5]/90 italic">
              &ldquo;{storeCopy.promoLine}&rdquo;
            </p>
          </div>

          <div className="whitespace-pre-line text-xs leading-relaxed text-[#C7C0CE]">
            {storeCopy.fullDescription}
          </div>

          <div className="border-t border-white/[0.06] pt-3.5 text-[11px] text-[#8F8898]">
            <span className="font-semibold text-[#D3CDD9]">What&apos;s New: </span>
            {storeCopy.whatsNew}
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 text-xs text-[#8F8898]">
        <ShieldCheck className="h-4 w-4 text-[#E8C5A5]" />
        <span>
          Strictly 18+ Adults Only · Membership &amp; add-on entitlements are verified on the server per session. One ₱250 Lifetime Pass covers Solo Mode, Couple Mode, and Unlimited Device Video Mode.
        </span>
      </div>
    </div>
  );
}
