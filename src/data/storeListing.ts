export interface StoreListingCopy {
  store: 'playstore' | 'appstore';
  storeLabel: string;
  appTitle: string;
  subtitleOrShort: string;
  promoLine: string;
  fullDescription: string;
  whatsNew: string;
  keywords: string;
}

export const STORE_LISTINGS: Record<'playstore' | 'appstore', StoreListingCopy> = {
  playstore: {
    store: 'playstore',
    storeLabel: 'Google Play Store',
    appTitle: 'Watch me Darling (18+): Watch Pulse & Couple Sync',
    subtitleOrShort:
      '18+ Adults Only · Turn music, voice & video into silent smartwatch pulses for lovers or solo nights.',
    promoLine:
      'Your earbuds hold the sound. Your smartwatch holds the touch. One ₱250 lifetime pass unlocks Solo, Couple & Unlimited Video Mode. Strictly 18+ to download.',
    fullDescription: `AGE NOTICE: Strictly for adults aged 18 years old and above only. You must confirm you are 18+ before downloading or accessing this app.

Stop settling for flat screens and silent calls. Watch me Darling turns the smartwatch and earbuds you already own into a private sensory bridge—built for a generation that refuses to let distance dull intimacy or let solo nights feel ordinary.

Whether you are miles apart in different cities or unwinding alone with headphones after midnight, Watch me Darling splits your senses in real time: pure music, voice, and cinema flow exclusively into your earbuds while deep basslines, heartbeats, and live touch translate into silent, rhythmic vibrations on your smartwatch.

TWO WORLDS IN ONE APP — CONNECT OR UNWIND SOLO

• COUPLE MODE — FEEL EACH OTHER ACROSS ANY DISTANCE
Pair with your partner in seconds using a private Room Code or instant QR Code scan. Glide your finger across the live XY Remote Touchpad to send pressure and frequency waves straight to your partner’s smartwatch wrist, stream the beat of your music live to theirs, watch local videos in sync, and drop playful tactile pulse notes inside private couple chat.

• SOLO MODE — NEXT-LEVEL LEISURE ON DEMAND
Turn any song on your device, live voice hum, or curated midnight soundscape into tailored wrist pulses. Sculpt your own rhythms on the Solo Touch Pad—and explore Solo AI Intimate Chat with 10 complimentary messages right out of the box.

• UNLIMITED DEVICE VIDEO MODE (INCLUDED IN ₱250 PASS)
Browse any video stored on your phone, tablet, or PC and play it without time limits. Audio routes cleanly to your earbuds while Watch me Darling’s real-time audio-to-haptic engine turns every swell and beat into calibrated smartwatch vibration.

• STRICT CHANNEL SEPARATION — DISCREET & IMMERSIVE
Earbuds = Sounds & Audio ONLY.
Smartwatch = Vibration ONLY.
No awkward speaker leaks. Just pure audio in your ears and pulse waves on your skin.

• WORKS WHEREVER YOU ARE
Built for Android Phone (WebAPK & Android APK ready), Android PC / Chromebook, Apple iPad (iOS 10.0+), iPhone, and Desktop PC.

SIMPLE PRE-DOWNLOAD PASS + OPTIONAL AI DROPS
• ₱250 First Payment (Lifetime Unlimited): Unlocks full Solo Mode, full Couple Mode, and Unlimited Device Video Mode forever—no recurring fee to stay connected.
• Optional Add-On 1 (₱150): Generate custom mood imagery directly from your active chat lines.
• Optional Add-On 2 (₱350/year): Weekly Teasing AI Video Pack delivering 20 seconds of custom watch-synced teasing clips every week for 52 weeks.

STRICTLY 18+ ADULTS ONLY TO DOWNLOAD & USE.`,
    whatsNew:
      'Now branded Watch me Darling (18+ Only) with floral wordmark, instant QR Code Partner Pairing, Unlimited Device Video Browser with Bluetooth latency sync, 5-edition support (PC, Android PC, iPad iOS 10.0+, iPhone & Android), and 52 weekly creative teaser drops.',
    keywords:
      'watch me darling, 18+ smartwatch vibration, couple distance app, audio to haptic, earbud watch sync, solo sensory leisure',
  },
  appstore: {
    store: 'appstore',
    storeLabel: 'Apple App Store',
    appTitle: 'Watch me Darling — 18+ Watch & Couple Sync',
    subtitleOrShort: '18+ Only · Feel music, video & touch',
    promoLine:
      'Strictly 18+ to download. Music in your AirPods, silent pulse waves on your wrist—the modern sensory companion for long-distance couples and solo relaxation.',
    fullDescription: `AGE RESTRICTION: Strictly 18 years old and above only. Underage users are not permitted to download or use Watch me Darling.

Some connections are meant to be felt, not just texted. Watch me Darling reimagines your smartwatch and AirPods or earbuds as an intimate, discreet sensory instrument designed for modern adult couples and effortless solo leisure.

Load your favorite tracks, browse videos right from your device, or connect with your partner across time zones. While crystal-clear audio stays private inside your earbuds, Watch me Darling converts every sub-bass swell, vocal inflection, and fingertip glide into silent physical pulses on your watch.

WHY THIS GENERATION CHOOSES WATCH ME DARLING

1. Effortless Solo Escape
• Synthesized late-night soundscapes (Velvet, Midnight Rain, Deep Pulse) paired with a live Audio-to-Pulse curve engine.
• Play any local audio file or hum into your mic to drive real-time vibration without speaker feedback.
• Includes 10 free Solo AI Intimate Chat messages to test personalized mood and pulse pairing before upgrading.

2. Real-Time Long-Distance Couple Bridge
• Pair instantly with a private Room Code or one-scan QR Code.
• Live Remote Tactile Touchpad: press and glide to send continuous pulse intensity and frequency straight to your partner’s smartwatch.
• Private Partner Chat with embedded playable heartbeat & whisper notes.

3. Unlimited Device Video Mode Included
• Included in your ₱250 download pass with zero time caps: select any video file on your iPhone, iPad (iOS 10.0+), Android, or PC and experience simultaneous earbud audio + calibrated watch vibration, complete with Bluetooth sync offset adjustment.

4. Transparent One-Time Core Access
• ₱250 First Payment unlocks unlimited Solo Mode, Couple Mode, and Device Video Playback for life.
• Optional creative upgrades: ₱150 Chat-Referenced AI Image Pack and ₱350/year Teasing AI Video Pack (20 seconds per week for 52 weeks).

Strictly 18+ Adults Only · Made for iPhone, Apple iPad (iOS 10.0+), PC, Android PC, and Android phones.`,
    whatsNew:
      'Watch me Darling (18+) release with floral branding, full iPad (iOS 10.0+) & iPhone Safari home-screen app support, unlimited local video-to-pulse player, instant QR partner pairing, and weekly teasing AI visual drops.',
    keywords:
      'watch me darling, 18+ couples distance, watch haptics, audio vibration, solo relaxation, smartwatch pulse, airpods watch sync',
  },
};
