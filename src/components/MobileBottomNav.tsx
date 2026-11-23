import { Crown, Disc3, Hand, MessageCircleHeart, PlaySquare } from 'lucide-react';
import type { AppMode } from '../types.ts';

interface MobileBottomNavProps {
  activeMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
}

const MOBILE_TABS: { id: AppMode; label: string; Icon: typeof Disc3 }[] = [
  { id: 'solo', label: 'Solo', Icon: Disc3 },
  { id: 'control', label: 'Control', Icon: Hand },
  { id: 'video', label: 'Video', Icon: PlaySquare },
  { id: 'chats', label: 'Chats', Icon: MessageCircleHeart },
  { id: 'membership', label: 'Plan', Icon: Crown },
];

export function MobileBottomNav({ activeMode, onSelectMode }: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0D0C0F]/95 backdrop-blur-md md:hidden"
    >
      <div className="grid grid-cols-5 h-16 items-center px-1">
        {MOBILE_TABS.map(({ id, label, Icon }) => {
          const isActive = activeMode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectMode(id)}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                isActive ? 'text-[#E85D75]' : 'text-[#9A93A2] hover:text-[#F5F2EE]'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.75} />
              <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
