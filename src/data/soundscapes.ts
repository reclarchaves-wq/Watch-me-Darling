import type { SoundscapeTrack } from '../types.ts';

export const SOUNDSCAPES: SoundscapeTrack[] = [
  {
    id: 'midnight-velvet',
    title: 'Midnight Velvet',
    subtitle: 'Warm analog sub-bass · Slow swell',
    durationLabel: 'Continuous',
    bpm: 64,
    baseHz: 54,
    coverImage: '/src/assets/images/soundscape_velvet_1795442377041.jpg',
    synthPreset: 'velvet',
  },
  {
    id: 'rain-on-glass',
    title: 'Rain on Glass',
    subtitle: 'Soft droplet texture · Ambient shimmer',
    durationLabel: 'Continuous',
    bpm: 76,
    baseHz: 68,
    coverImage: '/src/assets/images/soundscape_rain_1795442377373.jpg',
    synthPreset: 'rain',
  },
  {
    id: 'slow-pulse',
    title: 'Slow Pulse',
    subtitle: 'Deep rhythmic cadence · Tactile lock',
    durationLabel: 'Continuous',
    bpm: 84,
    baseHz: 46,
    coverImage: '/src/assets/images/soundscape_pulse_1795442376911.jpg',
    synthPreset: 'pulse',
  },
];
