import { User, UserCheck } from 'lucide-react';
import type { AppMode } from '../types.ts';
import { DarlingWordmark } from './DarlingWordmark.tsx';

interface TopBarProps {
  activeMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  onOpenDevices: () => void;
  onOpenAccount: () => void;
  accountVerified: boolean;
  accountLabel?: string;
  dualLinkActive: boolean;
}

const NAV_ITEMS: { id: AppMode; label: string }[] = [
  { id: 'solo', label: 'Solo' },
  { id: 'control', label: 'Control' },
  { id: 'video', label: 'Video' },
  { id: 'chats', label: 'Chats' },
  { id: 'membership', label: 'Membership' },
];

export function TopBar({
  activeMode,
  onSelectMode,
  onOpenDevices,
  onOpenAccount,
  accountVerified,
  accountLabel,
  dualLinkActive,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0D0C0F]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Creative floral wordmark */}
        <button
          type="button"
          onClick={() => onSelectMode('solo')}
          aria-label="Watch me Darling (18+) Home"
          className="whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D75] rounded"
        >
          <DarlingWordmark variant="compact" />
        </button>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectMode(item.id)}
                className={`relative py-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D75] rounded ${
                  isActive
                    ? 'text-[#F5F2EE]'
                    : 'text-[#A099A8] hover:text-[#F5F2EE]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-[1px] h-[2px] bg-[#E85D75] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Account status + Primary Pair Devices CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenAccount}
            aria-label={accountVerified ? 'Verified Account' : 'Sign Up or Sign In'}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/10 bg-[#16141A] px-3 py-2 text-xs font-medium text-[#F5F2EE] transition-colors hover:bg-[#231F2B] cursor-pointer whitespace-nowrap"
          >
            {accountVerified ? (
              <UserCheck className="h-3.5 w-3.5 text-[#E8C5A5]" />
            ) : (
              <User className="h-3.5 w-3.5 text-[#A099A8]" />
            )}
            <span className="hidden sm:inline max-w-[100px] truncate">
              {accountVerified ? accountLabel || 'Account' : 'Sign Up'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenDevices}
            className="min-h-[40px] rounded-xl bg-[#E85D75] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#d94d66] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {dualLinkActive ? 'Dual-Link Active' : 'Pair Devices'}
          </button>
        </div>
      </div>
    </header>
  );
}
