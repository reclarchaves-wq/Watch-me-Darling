import {
  CheckCircle2,
  Download,
  FileCode2,
  Laptop,
  MonitorSmartphone,
  ShieldAlert,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import type { PlatformType } from '../types.ts';
import { getPlatformMeta, PLATFORM_EDITIONS } from '../utils/platform.ts';

interface InstallAppModalProps {
  open: boolean;
  onClose: () => void;
  selectedPlatform: PlatformType;
  onSelectPlatform: (p: PlatformType) => void;
  ageVerified18Plus: boolean;
  onRequireAgeGate: () => void;
}

function getEditionIcon(id: PlatformType) {
  switch (id) {
    case 'pc':
      return Laptop;
    case 'android-pc':
      return MonitorSmartphone;
    case 'ipad':
      return Tablet;
    case 'iphone':
    case 'android-phone':
    default:
      return Smartphone;
  }
}

export function InstallAppModal({
  open,
  onClose,
  selectedPlatform,
  onSelectPlatform,
  ageVerified18Plus,
  onRequireAgeGate,
}: InstallAppModalProps) {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<PlatformType>(selectedPlatform);
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);

  if (!open) return null;

  const edition = getPlatformMeta(activeTab);

  const handleTriggerInstall = async () => {
    if (!ageVerified18Plus) {
      onRequireAgeGate();
      return;
    }
    setInstallFeedback(null);
    if (isInstallable) {
      const ok = await install();
      setInstallFeedback(
        ok
          ? 'Watch me Darling installed to your device home screen / app launcher.'
          : 'Installation dismissed — follow the manual steps below anytime.'
      );
      return;
    }
    if (activeTab === 'ipad' || activeTab === 'iphone') {
      setInstallFeedback(
        'In Apple Safari, tap the Share button and choose "Add to Home Screen" to install.'
      );
    } else {
      setInstallFeedback(
        'Use your Chrome / Edge browser menu ("Install Watch me Darling" or "Add to Home Screen") to install this edition.'
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Install Watch me Darling App & Device Editions (18+)"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#16141A] p-6 sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-medium text-[#E8C5A5]">
              18+ Adults Only · Cross-Platform Install &amp; APK Packaging
            </span>
            <h2 className="font-display mt-1 text-2xl font-medium text-[#F5F2EE]">
              Install Watch me Darling on Every Device
            </h2>
            <p className="mt-1 text-xs text-[#A099A8]">
              Ready for PC, Android PC, Apple iPad (iOS 10.0+), iPhone, and Android Phone (WebAPK &amp; Android TWA APK). Strictly 18+ to download.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close install hub"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0D0C0F] text-[#A099A8] hover:text-[#F5F2EE] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 5 Edition Switcher */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {PLATFORM_EDITIONS.map((item) => {
            const Icon = getEditionIcon(item.id);
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  onSelectPlatform(item.id);
                  setInstallFeedback(null);
                }}
                className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition-colors cursor-pointer ${
                  active
                    ? 'border-[#E85D75] bg-[#E85D75]/15 text-[#F5F2EE]'
                    : 'border-white/[0.08] bg-[#0D0C0F] text-[#A099A8] hover:border-white/20 hover:text-[#F5F2EE]'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-[#E85D75]' : 'text-[#E8C5A5]'}`} />
                <span className="text-[11px] font-semibold leading-tight">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Active Edition Detail Card */}
        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#0D0C0F] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#F5F2EE]">{edition.label}</h3>
              <p className="mt-0.5 text-xs text-[#E8C5A5]">{edition.osSpec}</p>
            </div>
            <span className="text-xs text-[#8F8898]">{edition.distribution}</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] bg-[#16141A] p-3">
              <div className="text-[11px] font-medium text-[#8F8898]">Smartwatch Haptic Channel</div>
              <div className="mt-1 text-xs text-[#F5F2EE]">{edition.hapticPath}</div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-[#16141A] p-3">
              <div className="text-[11px] font-medium text-[#8F8898]">Earbud Audio Channel</div>
              <div className="mt-1 text-xs text-[#F5F2EE]">{edition.earbudPath}</div>
            </div>
          </div>

          <ol className="mt-4 space-y-2 border-t border-white/[0.06] pt-4 text-xs text-[#D3CDD9]">
            {edition.installSteps.map((step, idx) => (
              <li key={step} className="flex items-start gap-2.5">
                <span className="font-mono-tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1E1A22] text-[11px] font-semibold text-[#E8C5A5]">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>

          {!ageVerified18Plus && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F47286]/40 bg-[#251319] p-3.5 text-xs">
              <div className="flex items-center gap-2 text-[#F5F2EE]">
                <ShieldAlert className="h-4 w-4 shrink-0 text-[#E85D75]" />
                <span>Only adults aged 18+ are permitted to download or install this app.</span>
              </div>
              <button
                type="button"
                onClick={onRequireAgeGate}
                className="rounded-lg bg-[#E85D75] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
              >
                Verify Age 18+
              </button>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!ageVerified18Plus ? (
              <button
                type="button"
                onClick={onRequireAgeGate}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E85D75]/50 bg-[#251319] px-4 py-2 text-xs font-semibold text-[#F5F2EE] hover:bg-[#321922] cursor-pointer"
              >
                <ShieldAlert className="h-4 w-4 text-[#E85D75]" />
                <span>18+ Verification Required to Download</span>
              </button>
            ) : isInstalled ? (
              <div className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E8C5A5]/40 bg-[#1B1720] px-4 py-2 text-xs font-semibold text-[#E8C5A5]">
                <CheckCircle2 className="h-4 w-4" />
                Running in Installed App Mode
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleTriggerInstall()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E85D75] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>
                  {isInstallable
                    ? `Install ${edition.label} Now`
                    : `Install Guide · ${edition.shortLabel}`}
                </span>
              </button>
            )}

            {ageVerified18Plus && (activeTab === 'android-phone' || activeTab === 'android-pc') && (
              <>
                <a
                  href="/downloads/watch-me-darling-debug.apk"
                  download="watch-me-darling-debug.apk"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E85D75]/50 bg-[#E85D75]/15 px-4 py-2 text-xs font-semibold text-[#F5F2EE] hover:bg-[#E85D75]/25"
                >
                  <Download className="h-4 w-4 text-[#E85D75]" />
                  <span>Download Debug APK (.apk)</span>
                </a>
                <a
                  href="/android-twa-manifest.json"
                  download="watch-me-darling-android-twa-manifest.json"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-[#16141A] px-4 py-2 text-xs font-medium text-[#E8C5A5] hover:bg-[#221D28]"
                >
                  <FileCode2 className="h-4 w-4" />
                  <span>APK TWA Manifest</span>
                </a>
              </>
            )}
          </div>

          {installFeedback && (
            <p className="mt-3 text-xs text-[#E8C5A5]">{installFeedback}</p>
          )}
        </div>
      </div>
    </div>
  );
}
