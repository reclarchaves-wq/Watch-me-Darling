import type { WeeklyOffer } from '../types.ts';

const WEEKLY_THEMES: Array<{
  title: string;
  hook: string;
  teasePrompt: string;
  bonusPerk: string;
  recommendedAddOn: 'image-pack' | 'video-pack';
}> = [
  {
    title: 'Velvet Midnight Tease',
    hook: 'Turn tonight’s flirty chat into candlelit silk artwork or a 20-second slow-burn teaser.',
    teasePrompt: 'Slow satin shimmer in warm amber candlelight with a rising wrist pulse',
    bonusPerk: 'Includes matching 58 Hz Velvet Pulse',
    recommendedAddOn: 'video-pack',
  },
  {
    title: 'Rain-Kissed Window Silhouette',
    hook: 'Let rainy midnight longing materialize into bespoke visual art from your own words.',
    teasePrompt: 'Golden bokeh through rain droplets with soft silhouette warmth',
    bonusPerk: 'Free Raindrop Whisper haptic sync',
    recommendedAddOn: 'image-pack',
  },
  {
    title: 'Slow Burn Crescendo',
    hook: '20 seconds of teasing visual tension engineered to peak right alongside your smartwatch.',
    teasePrompt: 'Crimson ember drift building from quiet whisper to rhythmic swell',
    bonusPerk: 'Includes 82 BPM Crescendo curve',
    recommendedAddOn: 'video-pack',
  },
  {
    title: 'Champagne Dusk Portrait',
    hook: 'Capture the exact mood of your late-night chat as a private keepsake artwork.',
    teasePrompt: 'Champagne rose dusk light over flowing velvet fabric folds',
    bonusPerk: 'High-res 1024px export unlocked',
    recommendedAddOn: 'image-pack',
  },
  {
    title: 'Breathless Whisper Loop',
    hook: 'Unlock this week’s 20-second hypnotic teaser before Sunday’s drop resets.',
    teasePrompt: 'Soft focus amber rings breathing in sync with slow vocal warmth',
    bonusPerk: 'Pair with Earbud Whisper audio',
    recommendedAddOn: 'video-pack',
  },
  {
    title: 'After-Hours Rooftop Glow',
    hook: 'Bring distant city nights closer with custom imagery pulled straight from your chat.',
    teasePrompt: 'Midnight terrace string lights reflecting warm rose gold shadows',
    bonusPerk: 'Includes Dual-Wrist couple share',
    recommendedAddOn: 'image-pack',
  },
  {
    title: 'Heartbeat Eclipse Teaser',
    hook: 'Feel every second of a 20-second eclipse buildup locked to your watch motor.',
    teasePrompt: 'Dark obsidian eclipse rimmed with warm amber pulse flares',
    bonusPerk: 'Synced double-heartbeat cadence',
    recommendedAddOn: 'video-pack',
  },
  {
    title: 'Silk & Ember Moodboard',
    hook: 'One tap turns your most suggestive Solo chat lines into a custom visual scene.',
    teasePrompt: 'Deep burgundy silk ripples illuminated by low ember glow',
    bonusPerk: 'Instant chat-to-art rendering',
    recommendedAddOn: 'image-pack',
  },
  {
    title: 'Midnight Velvet Curtain',
    hook: 'A fresh 20-second teasing video drop waiting for your weekly quota.',
    teasePrompt: 'Slow parted velvet drapes revealing warm rose-amber shimmer',
    bonusPerk: '20s weekly quota refreshes every Monday',
    recommendedAddOn: 'video-pack',
  },
  {
    title: 'Golden Collarbone Shadow',
    hook: 'Immortalize the tension of your favorite chat moment in warm editorial art.',
    teasePrompt: 'Dusk window shadows sweeping across warm linen and obsidian',
    bonusPerk: 'Saves directly to your device',
    recommendedAddOn: 'image-pack',
  },
  {
    title: 'Warm Tide Anticipation',
    hook: 'Don’t let this week’s 20-second teasing wave expire unused—claim your weekly drop.',
    teasePrompt: 'Slow rising rose tide ripples accelerating over 20 seconds',
    bonusPerk: 'Sub-bass 48 Hz tactile lock',
    recommendedAddOn: 'video-pack',
  },
  {
    title: 'Secret Note Keepsake',
    hook: 'Send a custom chat-generated picture alongside a silent watch pulse.',
    teasePrompt: 'Intimate twilight lamp glow over folded linen and rose petals',
    bonusPerk: 'Shareable in Partner Room Chat',
    recommendedAddOn: 'image-pack',
  },
  {
    title: 'Quarter-Year Noir Tease',
    hook: 'Special Week 13 collector teaser: 20 seconds of slow noir tension and rhythmic heat.',
    teasePrompt: 'Film noir venetian blind shadows drifting in golden amber light',
    bonusPerk: 'Exclusive Week 13 pulse cadence',
    recommendedAddOn: 'video-pack',
  },
];

// Expand cleanly to all 52 distinct weekly offers for a full 1-year calendar
const SEASONAL_TITLES = [
  'Afterglow Satin Study',
  'Warm Pulse Drift',
  'Dusk Horizon Tease',
  'Soft Rain & Silk',
  'Candlelit Temptation',
  'Obsidian Rose Bloom',
  'Lingering Touch Loop',
  'Starlight Terrace Whisper',
  'Amber Mist Silhouette',
  'Velvet Tempo Swell',
  'Midnight Heartbeat Study',
  'Golden Hour Confession',
  'Mid-Year Tease Finale',
  'Summer Night Heatwave',
  'Breeze Through Linen',
  'Moonlit Glass Reflections',
  'Slow Motion Desire',
  'Rose Gold Horizon',
  'Quiet Tension Prelude',
  'Crimson Silk Encore',
  'Twilight Ember Dance',
  'Echoes Across Cities',
  'Satin Ribbon Drift',
  'After Midnight Pulse',
  'Autumn Dusk Warmth',
  'Rainy Balcony Reverie',
  'Obsidian Spark Tease',
  'Soft Breath Cadence',
  'Velvet Lantern Glow',
  'Close-Range Whisper',
  'Long-Distance Longing',
  'Warm Shadow Play',
  'Deep Bass Embrace',
  'Champagne Mist Loop',
  'Candlelight Crescendo',
  'Winter Silk Sanctuary',
  'Frost & Amber Contrast',
  'Year-End Midnight Tease',
  'Golden Anniversary Encore',
];

export const WEEKLY_OFFERS: WeeklyOffer[] = Array.from({ length: 52 }, (_, idx) => {
  const week = idx + 1;
  if (idx < WEEKLY_THEMES.length) {
    return {
      week,
      ...WEEKLY_THEMES[idx],
    };
  }
  const title = SEASONAL_TITLES[(idx - WEEKLY_THEMES.length) % SEASONAL_TITLES.length];
  const isVideoWeek = week % 2 === 1;
  return {
    week,
    title,
    hook: isVideoWeek
      ? `Week ${week} Drop: Unlock 20 seconds of teasing sensory video crafted for your smartwatch rhythm.`
      : `Week ${week} Drop: Turn your flirtatious chat lines into custom visual artwork for ₱150 lifetime.`,
    teasePrompt: `${title} in warm rose-amber lighting with deep sub-bass haptic pacing`,
    bonusPerk: isVideoWeek
      ? '20s/week for 52 weeks included (₱350/yr)'
      : 'Unlimited chat-referenced visuals (₱150)',
    recommendedAddOn: isVideoWeek ? 'video-pack' : 'image-pack',
  };
});

export function getCurrentWeekOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(52, Math.floor(diffDays / 7) + 1));
}
