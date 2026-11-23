import type { PlatformType } from '../types.ts';

export interface PlatformEditionMeta {
  id: PlatformType;
  label: string;
  shortLabel: string;
  osSpec: string;
  distribution: string;
  hapticPath: string;
  earbudPath: string;
  installSteps: string[];
}

export const PLATFORM_EDITIONS: PlatformEditionMeta[] = [
  {
    id: 'pc',
    label: 'PC Edition',
    shortLabel: 'PC',
    osSpec: 'Windows 10/11 · macOS · Linux Desktop',
    distribution: 'Installable Desktop App (Chrome / Edge PWA)',
    hapticPath: 'Web Bluetooth GATT smartwatch direct link (Vibration Only)',
    earbudPath: 'Desktop USB/Bluetooth stereo audio sink routing',
    installSteps: [
      'Click "Install PC App" below (or the install icon in Chrome/Edge address bar).',
      'Pin Watch me Darling (18+) to your Taskbar or Dock for standalone window mode.',
      'Use Pair Devices -> Pair BLE Smartwatch while your earbuds handle system audio.',
    ],
  },
  {
    id: 'android-pc',
    label: 'Android PC',
    shortLabel: 'And-PC',
    osSpec: 'Chromebook · Windows WSA · Android Desktop / DeX',
    distribution: 'Installable Android Desktop WebAPK + TWA Manifest',
    hapticPath: 'BLE GATT Smartwatch + Android Desk Haptic Bridge',
    earbudPath: 'A2DP Bluetooth / USB-C Earbud audio output',
    installSteps: [
      'Click "Install Android PC App" to add Watch me Darling (18+) to your Chromebook or DeX app drawer.',
      'Pair your smartwatch via BLE GATT for silent wrist pulses.',
      'Keep wireless earbuds connected for music, voice, and video sound.',
    ],
  },
  {
    id: 'ipad',
    label: 'Apple iPad (iOS 10.0+)',
    shortLabel: 'iPad 10+',
    osSpec: 'Apple iPad · iOS 10.0 through iPadOS 18',
    distribution: 'Safari Standalone Home Screen App (152px iPad Icon)',
    hapticPath: 'Partner Room Sync + CoreHaptics / BLE Companion Bridge',
    earbudPath: 'AirPods / MFi Audio Output via iPad WebAudio',
    installSteps: [
      'Open this page in Apple Safari on your iPad (iOS 10.0 or newer).',
      'Tap the Share icon (square with upward arrow) at the top-right toolbar.',
      'Tap "Add to Home Screen" — Watch me Darling launches full-screen as a native 18+ iPad app.',
    ],
  },
  {
    id: 'iphone',
    label: 'iPhone (iOS)',
    shortLabel: 'iPhone',
    osSpec: 'Apple iPhone · iOS 10.0 – iOS 18 Safari',
    distribution: 'Safari Standalone Home Screen App (180px Icon)',
    hapticPath: 'Wrist Pulse Telemetry + Companion BLE / WebSocket Bridge',
    earbudPath: 'AirPods / Lightning / USB-C Earbuds Exclusive Audio',
    installSteps: [
      'Open this page in Apple Safari on your iPhone.',
      'Tap the Share button at the bottom of Safari.',
      'Scroll down and tap "Add to Home Screen" to launch full-screen.',
    ],
  },
  {
    id: 'android-phone',
    label: 'Android Phone / APK',
    shortLabel: 'Android',
    osSpec: 'Android 7.0+ (API 24+) · WearOS & Generic BLE Watches',
    distribution: '1-Tap Chrome WebAPK + Android APK (TWA) Manifest',
    hapticPath: 'BLE Smartwatch Vibration + Native Android navigator.vibrate',
    earbudPath: 'Bluetooth Earbuds A2DP Exclusive Audio Output',
    installSteps: [
      'Tap "Download Debug APK (.apk)" below to install Watch me Darling (18+) directly on Android 7.0+ phones, or use "Install App (WebAPK)".',
      'Enable "Install unknown apps" if prompted when opening watch-me-darling-debug.apk on your Android device.',
      'Allow Camera, Microphone, Bluetooth & Vibration permissions when launched.',
    ],
  },
];

export function getPlatformMeta(id: PlatformType): PlatformEditionMeta {
  return PLATFORM_EDITIONS.find((p) => p.id === id) || PLATFORM_EDITIONS[0];
}

export function detectInitialPlatform(): PlatformType {
  if (typeof navigator === 'undefined') return 'pc';
  const ua = navigator.userAgent.toLowerCase();
  const maxTouch = typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0;

  // Apple iPad (covers iOS 10.0-12 "iPad" UA as well as iPadOS 13+ "Macintosh" + touch)
  if (/ipad/.test(ua) || (/macintosh/.test(ua) && maxTouch > 1)) {
    return 'ipad';
  }
  if (/iphone|ipod/.test(ua)) {
    return 'iphone';
  }
  if (/cros/.test(ua)) {
    return 'android-pc';
  }
  if (/android/.test(ua)) {
    const isLargeOrDesktop =
      !/mobile/.test(ua) ||
      (typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) >= 720);
    return isLargeOrDesktop ? 'android-pc' : 'android-phone';
  }
  return 'pc';
}

export function generateClientId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const rand = Math.random().toString(16).slice(2, 10);
  const ts = Date.now().toString(16);
  return `${prefix}-${ts}-${rand}`;
}
