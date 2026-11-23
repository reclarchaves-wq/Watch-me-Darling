export type AppMode = 'solo' | 'control' | 'video' | 'chats' | 'membership';

export type PlatformType = 'pc' | 'android-pc' | 'ipad' | 'iphone' | 'android-phone';

export type ConversionCurve =
  | 'sub-bass'
  | 'heartbeat'
  | 'melodic-wave'
  | 'transient-spark';

export type PulsePattern =
  | 'wave'
  | 'heartbeat'
  | 'crescendo'
  | 'whisper'
  | 'rhythmic';

export interface HapticFrame {
  intensity: number; // 0..100
  frequencyHz: number; // 20..220
  subBassEnergy: number; // 0..100
  midEnergy: number; // 0..100
  pattern: PulsePattern;
  sourceMode: 'solo' | 'control' | 'video' | 'chat';
  timestamp: number;
}

export interface WatchDeviceState {
  connected: boolean;
  name: string;
  platformBridge: 'ble-gatt' | 'qr-watch-link' | 'mobile-vibrate' | 'virtual-wrist';
  batteryLevel: number | null;
  firmwareNote: string;
  watchPairCode?: string;
}

export interface EarbudDeviceState {
  connected: boolean;
  deviceId: string;
  label: string;
  volume: number; // 0..100
  balance: number; // -1..1
}

export interface AudioOutputOption {
  deviceId: string;
  label: string;
}

export interface SoundscapeTrack {
  id: string;
  title: string;
  subtitle: string;
  durationLabel: string;
  bpm: number;
  baseHz: number;
  coverImage: string;
  synthPreset: 'velvet' | 'rain' | 'pulse';
}

export interface PartnerMember {
  id: string;
  name: string;
  platform: PlatformType;
  watchConnected: boolean;
  earbudConnected: boolean;
  watchName: string;
  earbudName: string;
}

export interface SuggestedPulse {
  label: string;
  baseHz: number;
  intensity: number;
  rhythmBpm: number;
  pattern: PulsePattern;
}

export interface RoomChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  attachedPulse?: SuggestedPulse;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  suggestedPulse?: SuggestedPulse;
  generatedImage?: GeneratedChatVisual;
  error?: boolean;
}

export interface GeneratedChatVisual {
  id: string;
  title: string;
  caption: string;
  motif: 'silk' | 'candle' | 'rain' | 'silhouette' | 'eclipse';
  palette: [string, string, string, string];
  lightingMood: string;
  dataUrl: string;
  createdAt: number;
}

export interface TeasingVideoScene {
  secondStart: number;
  secondEnd: number;
  caption: string;
  motionStyle: 'swell' | 'shimmer' | 'ripple' | 'ember';
  intensity: number;
  frequencyHz: number;
}

export interface GeneratedTeaseVideo {
  id: string;
  title: string;
  weekNumber: number;
  durationSeconds: number; // 20s
  palette: [string, string, string];
  scenes: TeasingVideoScene[];
  createdAt: number;
}

export type PlanTierId = 'free' | 'lifetime';
export type AddOnId = 'image-pack' | 'video-pack';

export interface SubscriptionPlan {
  id: PlanTierId;
  name: string;
  tagline: string;
  pricePhp: number;
  billingLabel: string;
  features: string[];
  entitlements: {
    soloModeFull: boolean;
    coupleModeFull: boolean;
    dualDeviceRouting: boolean;
    videoPulseSync: boolean;
    hdHapticCurves: boolean;
  };
}

export interface AddOnPackage {
  id: AddOnId;
  name: string;
  pricePhp: number;
  billingLabel: string;
  tagline: string;
  features: string[];
}

export interface SubscriptionSession {
  planId: PlanTierId;
  active: boolean;
  addOnImageUnlocked: boolean;
  addOnVideoUnlocked: boolean;
  videoSecondsUsedThisWeek: number;
  videoSecondsWeeklyLimit: number;
  currentWeekNumber: number;
  expiresAt: string | null;
  token: string | null;
}

export interface WeeklyOffer {
  week: number;
  title: string;
  hook: string;
  teasePrompt: string;
  bonusPerk: string;
  recommendedAddOn: AddOnId;
}
