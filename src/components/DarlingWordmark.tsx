interface DarlingWordmarkProps {
  variant?: 'compact' | 'hero';
}

export function DarlingWordmark({ variant = 'compact' }: DarlingWordmarkProps) {
  if (variant === 'hero') {
    return (
      <div className="relative inline-flex flex-col items-center select-none">
        <div className="relative px-5 py-3">
          {/* Botanical vines weaving behind letters */}
          <svg
            aria-hidden="true"
            viewBox="0 0 360 92"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            fill="none"
          >
            {/* Flowing golden-rose vine stem threading across letters */}
            <path
              d="M14 58 C 52 14, 108 82, 168 44 C 222 10, 286 78, 344 28"
              stroke="#6F9A84"
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.72"
            />
            <path
              d="M28 24 C 82 70, 152 16, 214 58 C 268 88, 314 34, 348 54"
              stroke="#E8C5A5"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeDasharray="3 4"
              opacity="0.5"
            />
            {/* Delicate tangled leaves */}
            <path
              d="M52 34 C 40 20, 58 10, 66 28 Z"
              fill="#5D8772"
              opacity="0.82"
            />
            <path
              d="M142 54 C 134 72, 156 76, 158 58 Z"
              fill="#5D8772"
              opacity="0.78"
            />
            <path
              d="M258 34 C 254 14, 276 16, 272 34 Z"
              fill="#5D8772"
              opacity="0.82"
            />
            <path
              d="M318 46 C 330 34, 346 46, 330 58 Z"
              fill="#5D8772"
              opacity="0.85"
            />
          </svg>

          {/* Creative interleaved typography */}
          <div className="relative z-10 flex flex-wrap items-baseline justify-center gap-x-2">
            <span className="font-display text-2xl sm:text-3xl font-medium italic tracking-tight text-[#F5F2EE]">
              <span className="text-[#E8C5A5]">W</span>atch
            </span>
            <span className="font-display text-xl sm:text-2xl italic font-normal text-[#E8C5A5]/90">
              me
            </span>
            <span className="font-display text-3xl sm:text-4xl font-semibold italic tracking-tight text-[#E85D75] drop-shadow-[0_2px_12px_rgba(232,93,117,0.35)]">
              Darling
            </span>
          </div>

          {/* Foreground intertwined blossoms sitting over letter curves */}
          <svg
            aria-hidden="true"
            viewBox="0 0 360 92"
            className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
            fill="none"
          >
            {/* Left Rose Bloom hugging 'W' */}
            <g transform="translate(22, 26)">
              <circle cx="0" cy="-6" r="5" fill="#E85D75" />
              <circle cx="6" cy="-1" r="5" fill="#F07389" />
              <circle cx="3" cy="6" r="5" fill="#D4465F" />
              <circle cx="-4" cy="5" r="5" fill="#E85D75" />
              <circle cx="-6" cy="-2" r="5" fill="#F07389" />
              <circle cx="0" cy="0" r="3" fill="#E8C5A5" />
            </g>

            {/* Center Delicate Blossom tangled between 'me' and 'Darling' */}
            <g transform="translate(178, 56)">
              <circle cx="0" cy="-4.5" r="3.8" fill="#E8C5A5" />
              <circle cx="4.5" cy="0" r="3.8" fill="#F2D7BD" />
              <circle cx="0" cy="4.5" r="3.8" fill="#E8C5A5" />
              <circle cx="-4.5" cy="0" r="3.8" fill="#F2D7BD" />
              <circle cx="0" cy="0" r="2.2" fill="#E85D75" />
            </g>

            {/* Right Rose Blossom blooming off 'g' */}
            <g transform="translate(332, 22)">
              <circle cx="0" cy="-6.5" r="5.5" fill="#E85D75" />
              <circle cx="6.5" cy="-1" r="5.5" fill="#F47A8F" />
              <circle cx="3.5" cy="6" r="5.5" fill="#C93E56" />
              <circle cx="-4" cy="5.5" r="5.5" fill="#E85D75" />
              <circle cx="-6" cy="-2" r="5.5" fill="#F47A8F" />
              <circle cx="0" cy="0" r="3.2" fill="#E8C5A5" />
            </g>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <span className="relative inline-flex items-center gap-2 select-none">
      {/* Tangled vine & rose icon woven into compact brand mark */}
      <svg
        aria-hidden="true"
        viewBox="0 0 36 32"
        className="h-7 w-7 shrink-0 overflow-visible"
        fill="none"
      >
        <path
          d="M3 24 C 10 8, 22 26, 32 7"
          stroke="#6F9A84"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M9 14 C 5 8, 12 4, 14 12 Z" fill="#5D8772" />
        <path d="M23 20 C 26 26, 32 22, 28 16 Z" fill="#5D8772" />
        <g transform="translate(23, 11)">
          <circle cx="0" cy="-4.5" r="4" fill="#E85D75" />
          <circle cx="4.5" cy="-1" r="4" fill="#F47A8F" />
          <circle cx="2.5" cy="4.2" r="4" fill="#D4465F" />
          <circle cx="-3" cy="3.8" r="4" fill="#E85D75" />
          <circle cx="-4.2" cy="-1.5" r="4" fill="#F47A8F" />
          <circle cx="0" cy="0" r="2.4" fill="#E8C5A5" />
        </g>
      </svg>

      <span className="relative inline-flex items-baseline gap-1">
        <span className="font-display text-lg sm:text-xl font-medium italic tracking-tight text-[#F5F2EE]">
          <span className="text-[#E8C5A5]">W</span>atch
        </span>
        <span className="font-display text-sm sm:text-base italic text-[#D3CDD9]">me</span>
        <span className="font-display text-xl sm:text-2xl font-semibold italic tracking-tight text-[#E85D75]">
          Darling
        </span>
      </span>
    </span>
  );
}
