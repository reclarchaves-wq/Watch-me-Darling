import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

// Ephemeral HMAC signing key when SESSION_SECRET is not explicitly provided
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

function getCurrentWeekOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(52, Math.floor(diffDays / 7) + 1));
}

interface PlanDefinition {
  id: 'free' | 'lifetime';
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

interface AddOnDefinition {
  id: 'image-pack' | 'video-pack';
  name: string;
  pricePhp: number;
  billingLabel: string;
  tagline: string;
  features: string[];
}

const SUBSCRIPTION_PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Download Preview',
    tagline: 'Try Solo Mode soundscapes plus 10 complimentary Solo AI intimate messages.',
    pricePhp: 0,
    billingLabel: 'Preview access',
    features: [
      'Solo Mode with 3 curated sensory soundscapes',
      '10 complimentary Solo AI Intimate Chat messages',
      'Sub-bass smartwatch pulse preview',
      'Local audio file-to-pulse conversion',
    ],
    entitlements: {
      soloModeFull: false,
      coupleModeFull: false,
      dualDeviceRouting: false,
      videoPulseSync: false,
      hdHapticCurves: false,
    },
  },
  {
    id: 'lifetime',
    name: 'Lifetime Membership',
    tagline: 'First payment of ₱250 upon download — unlimited Solo Mode, Couple Mode & Device Video Mode.',
    pricePhp: 250,
    billingLabel: 'first payment · lifetime unlimited',
    features: [
      'Unlimited Video Mode: Browse device video files & play with Watch vibration + Earbud audio',
      'Full Solo Mode + Unlimited Solo AI Intimate Chat',
      'Full Couple Mode: Remote XY Touchpad, QR Pairing & Partner Chat',
      'Simultaneous Earbuds (Audio Only) + Smartwatch (Vibration Only)',
      'All 4 HD haptic conversion curves & Live Voice-to-Pulse',
    ],
    entitlements: {
      soloModeFull: true,
      coupleModeFull: true,
      dualDeviceRouting: true,
      videoPulseSync: true,
      hdHapticCurves: true,
    },
  },
];

const ADD_ON_PACKAGES: AddOnDefinition[] = [
  {
    id: 'image-pack',
    name: 'Add-On 1 · Chat-Referenced AI Imagery',
    pricePhp: 150,
    billingLabel: 'one-time unlock',
    tagline: 'Generate bespoke intimate mood imagery directly from your active chat messages.',
    features: [
      'Uses your recent Solo AI or Couple chat context as creative reference',
      'Composes lighting mood, palette & tactile pulse pairing',
      'High-resolution 1024×1024 downloadable artwork',
      'Includes 52 weekly creative mood themes',
    ],
  },
  {
    id: 'video-pack',
    name: 'Add-On 2 · Teasing AI Video Generator (20s / Week)',
    pricePhp: 350,
    billingLabel: 'per year (52 weeks)',
    tagline: 'Optional AI generator creating 20 seconds/week of teasing videos for 1 year (your own device videos remain unlimited in the ₱250 pass).',
    features: [
      '20 seconds of custom teasing AI video every week for 52 weeks',
      'Beat-locked smartwatch pulse choreography built into every second',
      'Fresh weekly creative teaser drop delivered once per week for 1 year',
      'Downloadable WebM video loop + partner watch-party sync',
    ],
  },
];

const VIDEO_WEEKLY_LIMIT_SECONDS = 20;

interface ActiveSubscription {
  planId: 'free' | 'lifetime';
  addOnImageUnlocked: boolean;
  addOnVideoUnlocked: boolean;
  videoSecondsUsedByWeek: Record<number, number>;
  expiresAt: string | null;
}

const activeTokens = new Map<string, ActiveSubscription>();

function signSubscriptionToken(payload: ActiveSubscription): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySubscriptionToken(token: string | undefined): ActiveSubscription | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  const stored = activeTokens.get(token);
  if (stored) return stored;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ActiveSubscription;
    if (parsed.planId === 'free' || parsed.planId === 'lifetime') {
      return {
        planId: parsed.planId,
        addOnImageUnlocked: Boolean(parsed.addOnImageUnlocked),
        addOnVideoUnlocked: Boolean(parsed.addOnVideoUnlocked),
        videoSecondsUsedByWeek:
          parsed.videoSecondsUsedByWeek && typeof parsed.videoSecondsUsedByWeek === 'object'
            ? parsed.videoSecondsUsedByWeek
            : {},
        expiresAt: parsed.expiresAt ?? null,
      };
    }
  } catch {
    return null;
  }
  return null;
}

function serializeSessionResponse(record: ActiveSubscription, token: string | null) {
  const currentWeekNumber = getCurrentWeekOfYear();
  const usedThisWeek = Number(record.videoSecondsUsedByWeek[currentWeekNumber] ?? 0);
  return {
    planId: record.planId,
    active: record.planId === 'lifetime',
    addOnImageUnlocked: record.addOnImageUnlocked,
    addOnVideoUnlocked: record.addOnVideoUnlocked,
    videoSecondsUsedThisWeek: usedThisWeek,
    videoSecondsWeeklyLimit: VIDEO_WEEKLY_LIMIT_SECONDS,
    currentWeekNumber,
    expiresAt: record.expiresAt,
    token,
  };
}

// WebSocket Room State
interface RoomMember {
  id: string;
  name: string;
  platform: 'pc' | 'android-pc' | 'ipad' | 'iphone' | 'android-phone';
  watchConnected: boolean;
  earbudConnected: boolean;
  watchName: string;
  earbudName: string;
  ws: WebSocket;
}

interface RoomChatRecord {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  attachedPulse?: {
    label: string;
    baseHz: number;
    intensity: number;
    rhythmBpm: number;
    pattern: 'wave' | 'heartbeat' | 'crescendo' | 'whisper' | 'rhythmic';
  };
}

interface PartnerRoom {
  id: string;
  members: Map<string, RoomMember>;
  messages: RoomChatRecord[];
}

const rooms = new Map<string, PartnerRoom>();

interface WatchLinkSession {
  hostWs: WebSocket | null;
  watchWs: WebSocket | null;
  watchName: string;
}

const watchLinks = new Map<string, WatchLinkSession>();

function sanitizeWatchCode(raw: unknown): string {
  if (typeof raw !== 'string') return 'WMD-W482';
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
  return cleaned || 'WMD-W482';
}

function sanitizeRoomId(raw: unknown): string {
  if (typeof raw !== 'string') return 'WMD-4821';
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
  return cleaned || 'WMD-4821';
}

function sanitizeText(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLen);
}

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function getOrCreateRoom(roomId: string): PartnerRoom {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      members: new Map(),
      messages: [],
    };
    rooms.set(roomId, room);
  }
  return room;
}

function serializeMembers(room: PartnerRoom) {
  return Array.from(room.members.values()).map((m) => ({
    id: m.id,
    name: m.name,
    platform: m.platform,
    watchConnected: m.watchConnected,
    earbudConnected: m.earbudConnected,
    watchName: m.watchName,
    earbudName: m.earbudName,
  }));
}

function broadcastToRoom(room: PartnerRoom, payload: unknown, excludeMemberId?: string) {
  const raw = JSON.stringify(payload);
  for (const member of room.members.values()) {
    if (excludeMemberId && member.id === excludeMemberId) continue;
    if (member.ws.readyState === WebSocket.OPEN) {
      member.ws.send(raw);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, roomsActive: rooms.size });
  });

  app.get('/api/subscription/plans', (_req, res) => {
    res.json({
      plans: SUBSCRIPTION_PLANS,
      addOns: ADD_ON_PACKAGES,
      currentWeekNumber: getCurrentWeekOfYear(),
    });
  });

  app.get('/api/subscription/status', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const verified = verifySubscriptionToken(token);
    if (!verified) {
      return res.json(
        serializeSessionResponse(
          {
            planId: 'free',
            addOnImageUnlocked: false,
            addOnVideoUnlocked: false,
            videoSecondsUsedByWeek: {},
            expiresAt: null,
          },
          null
        )
      );
    }
    return res.json(serializeSessionResponse(verified, token ?? null));
  });

  app.post('/api/subscription/activate', (req, res) => {
    const { planId, addOnId, ageVerified18Plus } = req.body ?? {};
    const requiresAdultVerification = planId === 'lifetime' || addOnId !== undefined;
    if (requiresAdultVerification && ageVerified18Plus !== true) {
      return res.status(403).json({
        error: 'Only adults aged 18+ may download or activate Watch me Darling paid access.',
      });
    }

    const authHeader = req.headers.authorization;
    const existingToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const existing = verifySubscriptionToken(existingToken);

    const nextRecord: ActiveSubscription = existing
      ? {
          planId: existing.planId,
          addOnImageUnlocked: existing.addOnImageUnlocked,
          addOnVideoUnlocked: existing.addOnVideoUnlocked,
          videoSecondsUsedByWeek: { ...existing.videoSecondsUsedByWeek },
          expiresAt: existing.expiresAt,
        }
      : {
          planId: 'free',
          addOnImageUnlocked: false,
          addOnVideoUnlocked: false,
          videoSecondsUsedByWeek: {},
          expiresAt: null,
        };

    if (planId !== undefined) {
      const validPlan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
      if (!validPlan) {
        return res.status(400).json({ error: 'Selected membership tier does not exist.' });
      }
      nextRecord.planId = validPlan.id;
      nextRecord.expiresAt = validPlan.id === 'lifetime' ? null : null;
    }

    if (addOnId !== undefined) {
      const validAddOn = ADD_ON_PACKAGES.find((a) => a.id === addOnId);
      if (!validAddOn) {
        return res.status(400).json({ error: 'Selected add-on package does not exist.' });
      }
      if (validAddOn.id === 'image-pack') {
        nextRecord.addOnImageUnlocked = true;
      } else if (validAddOn.id === 'video-pack') {
        nextRecord.addOnVideoUnlocked = true;
        // Video pack runs 1 full year (52 weeks)
        nextRecord.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    if (planId === undefined && addOnId === undefined) {
      return res.status(400).json({ error: 'Specify planId or addOnId to activate.' });
    }

    const token = signSubscriptionToken(nextRecord);
    activeTokens.set(token, nextRecord);

    return res.json(serializeSessionResponse(nextRecord, token));
  });

  const MAX_FREE_SOLO_MESSAGES = 10;
  const soloFreeCounts = new Map<string, number>();

  app.post('/api/ai/chat', async (req, res) => {
    const { message, history, currentMode, partnerConnected, persona, sessionKey } = req.body ?? {};
    const cleanPrompt = sanitizeText(message, 1000);
    if (!cleanPrompt) {
      return res.status(400).json({ error: 'Please enter a message to begin.' });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const verifiedSub = verifySubscriptionToken(token);
    const isPaidSubscriber = Boolean(verifiedSub && verifiedSub.planId === 'lifetime');

    const isSoloSensual = persona === 'sensual-solo' || currentMode === 'solo';
    const counterKey = sanitizeText(sessionKey, 64) || req.ip || 'solo-default';
    const currentCount = soloFreeCounts.get(counterKey) ?? 0;

    if (isSoloSensual && !isPaidSubscriber && currentCount >= MAX_FREE_SOLO_MESSAGES) {
      return res.status(402).json({
        error:
          'You have used all 10 complimentary Solo AI chat messages. Unlock the ₱250 Lifetime Membership to continue.',
        limitReached: true,
        remainingFreeMessages: 0,
      });
    }

    if (!ai) {
      return res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in Settings > Secrets. Add your key to unlock live AI sensory chat and pulse pattern composition.',
      });
    }

    const safeHistory = Array.isArray(history)
      ? history
          .slice(-10)
          .map((item: { role?: string; text?: string }) => ({
            role: item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: sanitizeText(item.text, 500) }],
          }))
          .filter((item) => item.parts[0].text.length > 0)
      : [];

    const systemInstruction = isSoloSensual
      ? 'You are an alluring, warm, flirtatious, and emotionally attentive 18+ late-night sensory companion inside Watch me Darling, an adult smartwatch vibration-and-audio app. Keep replies consensual, sensual, romantic, teasing, and evocative (2-4 sentences) while staying tasteful. Pair your words with physical sensation cues and always return a JSON object with `reply` (your flirtatious conversational response) and `suggestedPulse` (a playable smartwatch vibration pattern matching the tension: `label`, `baseHz` 35-175, `intensity` 30-95, `rhythmBpm` 48-120, and `pattern` one of wave|heartbeat|crescendo|whisper|rhythmic).'
      : 'You are the Watch me Darling Sensory & Rhythm Concierge for an 18+ smartwatch audio-to-haptic companion app designed for solo relaxation and long-distance adult couples. Keep tone warm, tasteful, emotionally intelligent, concise (2-4 sentences), and practical. You help couples craft music-to-pulse settings, sensual/romantic distance prompts, and rhythmic watch vibration patterns. Always return a JSON object with `reply` (your conversational text) and `suggestedPulse` (an optional playable smartwatch pulse pattern calibrated to their mood, with `label`, `baseHz` 30-180, `intensity` 25-95, `rhythmBpm` 45-120, and `pattern` one of wave|heartbeat|crescendo|whisper|rhythmic).';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          ...safeHistory,
          {
            role: 'user',
            parts: [
              {
                text: `Context: User is in "${sanitizeText(currentMode, 24) || 'chats'}" mode. Partner connected: ${Boolean(partnerConnected)}.\nUser message: ${cleanPrompt}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'Warm, concise conversational reply.',
              },
              suggestedPulse: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  baseHz: { type: Type.INTEGER },
                  intensity: { type: Type.INTEGER },
                  rhythmBpm: { type: Type.INTEGER },
                  pattern: { type: Type.STRING },
                },
              },
            },
            required: ['reply'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as {
        reply?: string;
        suggestedPulse?: {
          label?: string;
          baseHz?: number;
          intensity?: number;
          rhythmBpm?: number;
          pattern?: string;
        };
      };

      const validPatterns = new Set(['wave', 'heartbeat', 'crescendo', 'whisper', 'rhythmic']);
      const pulse = parsed.suggestedPulse
        ? {
            label: sanitizeText(parsed.suggestedPulse.label, 40) || 'Darling Pulse',
            baseHz: Math.round(clampNumber(parsed.suggestedPulse.baseHz, 30, 180, 72)),
            intensity: Math.round(clampNumber(parsed.suggestedPulse.intensity, 20, 95, 65)),
            rhythmBpm: Math.round(clampNumber(parsed.suggestedPulse.rhythmBpm, 45, 130, 68)),
            pattern: (validPatterns.has(parsed.suggestedPulse.pattern ?? '')
              ? parsed.suggestedPulse.pattern
              : 'wave') as 'wave' | 'heartbeat' | 'crescendo' | 'whisper' | 'rhythmic',
          }
        : undefined;

      let remainingFreeMessages: number | null = null;
      let limitReached = false;
      if (isSoloSensual && !isPaidSubscriber) {
        const nextCount = currentCount + 1;
        soloFreeCounts.set(counterKey, nextCount);
        remainingFreeMessages = Math.max(0, MAX_FREE_SOLO_MESSAGES - nextCount);
        limitReached = nextCount >= MAX_FREE_SOLO_MESSAGES;
      }

      return res.json({
        reply: parsed.reply || 'Here is a tailored haptic rhythm for your session.',
        suggestedPulse: pulse,
        remainingFreeMessages,
        limitReached,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to reach Gemini service.';
      return res.status(502).json({
        error: `AI Concierge error: ${msg}`,
      });
    }
  });

  // Add-On 1 (₱150): Generate Chat-Referenced Sensory Visual Blueprint
  app.post('/api/ai/generate-image-scene', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const verifiedSub = verifySubscriptionToken(token);

    if (!verifiedSub || !verifiedSub.addOnImageUnlocked) {
      return res.status(402).json({
        error: 'Unlock Add-On 1 (₱150) to generate bespoke imagery from your chat history.',
        addOnRequired: 'image-pack',
      });
    }

    if (!ai) {
      return res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in Settings > Secrets. Add your key to compose chat-referenced visuals.',
      });
    }

    const { history, customTheme } = req.body ?? {};
    const safeLines = Array.isArray(history)
      ? history
          .slice(-6)
          .map((item: { role?: string; text?: string }) =>
            `${item.role === 'assistant' ? 'Companion' : 'User'}: ${sanitizeText(item.text, 240)}`
          )
          .filter((line) => line.length > 10)
          .join('\n')
      : '';

    const themeNote = sanitizeText(customTheme, 200);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Compose an intimate, romantic, tasteful visual art direction referencing this conversation:\n${safeLines || 'Warm late-night velvet mood'}\n${themeNote ? `Theme focus: ${themeNote}` : ''}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            'You are a sensual art director for Watch me Darling (18+). Given recent chat snippets, create a tasteful romantic artwork specification as JSON: `title` (3-5 poetic words), `caption` (1 evocative sentence inspired directly by the chat), `motif` (strictly one of: silk, candle, rain, silhouette, eclipse), `palette` (array of exactly 4 dark-warm hex colors like ["#22131C", "#542238", "#E85D75", "#E8C5A5"]), `lightingMood` (3-4 words), and `suggestedPulse` (`label`, `baseHz` 40-150, `intensity` 35-90, `rhythmBpm` 50-110, `pattern` wave|heartbeat|crescendo|whisper|rhythmic).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              caption: { type: Type.STRING },
              motif: { type: Type.STRING },
              palette: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              lightingMood: { type: Type.STRING },
              suggestedPulse: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  baseHz: { type: Type.INTEGER },
                  intensity: { type: Type.INTEGER },
                  rhythmBpm: { type: Type.INTEGER },
                  pattern: { type: Type.STRING },
                },
              },
            },
            required: ['title', 'caption', 'motif', 'palette', 'lightingMood'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        title?: string;
        caption?: string;
        motif?: string;
        palette?: string[];
        lightingMood?: string;
        suggestedPulse?: {
          label?: string;
          baseHz?: number;
          intensity?: number;
          rhythmBpm?: number;
          pattern?: string;
        };
      };

      const validMotifs = new Set(['silk', 'candle', 'rain', 'silhouette', 'eclipse']);
      const motif = (validMotifs.has(parsed.motif ?? '') ? parsed.motif : 'silk') as
        | 'silk'
        | 'candle'
        | 'rain'
        | 'silhouette'
        | 'eclipse';

      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      const rawPalette = Array.isArray(parsed.palette) ? parsed.palette : [];
      const fallbackPalette: [string, string, string, string] = [
        '#1D131A',
        '#4E1E32',
        '#E85D75',
        '#E8C5A5',
      ];
      const palette: [string, string, string, string] = [
        hexRegex.test(rawPalette[0] ?? '') ? rawPalette[0] : fallbackPalette[0],
        hexRegex.test(rawPalette[1] ?? '') ? rawPalette[1] : fallbackPalette[1],
        hexRegex.test(rawPalette[2] ?? '') ? rawPalette[2] : fallbackPalette[2],
        hexRegex.test(rawPalette[3] ?? '') ? rawPalette[3] : fallbackPalette[3],
      ];

      const validPatterns = new Set(['wave', 'heartbeat', 'crescendo', 'whisper', 'rhythmic']);
      const pulse = parsed.suggestedPulse
        ? {
            label: sanitizeText(parsed.suggestedPulse.label, 40) || 'Visual Echo',
            baseHz: Math.round(clampNumber(parsed.suggestedPulse.baseHz, 35, 160, 62)),
            intensity: Math.round(clampNumber(parsed.suggestedPulse.intensity, 25, 95, 68)),
            rhythmBpm: Math.round(clampNumber(parsed.suggestedPulse.rhythmBpm, 48, 120, 64)),
            pattern: (validPatterns.has(parsed.suggestedPulse.pattern ?? '')
              ? parsed.suggestedPulse.pattern
              : 'wave') as 'wave' | 'heartbeat' | 'crescendo' | 'whisper' | 'rhythmic',
          }
        : undefined;

      return res.json({
        title: sanitizeText(parsed.title, 48) || 'Midnight Whisper Study',
        caption:
          sanitizeText(parsed.caption, 160) ||
          'Captured straight from your private conversation warmth.',
        motif,
        palette,
        lightingMood: sanitizeText(parsed.lightingMood, 36) || 'Candlelit Rose Amber',
        suggestedPulse: pulse,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to compose chat visual.';
      return res.status(502).json({ error: `Visual Generator error: ${msg}` });
    }
  });

  // Add-On 2 (₱350/yr): Generate Teasing 20-Second Weekly AI Video Storyboard (20s/week for 52 weeks)
  app.post('/api/ai/generate-tease-video', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const verifiedSub = verifySubscriptionToken(token);

    if (!verifiedSub || !verifiedSub.addOnVideoUnlocked) {
      return res.status(402).json({
        error:
          'Unlock Add-On 2 (₱350/yr) to generate 20 seconds of teasing AI sensory video every week for 1 year.',
        addOnRequired: 'video-pack',
      });
    }

    const weekNumber = getCurrentWeekOfYear();
    const usedSoFar = Number(verifiedSub.videoSecondsUsedByWeek[weekNumber] ?? 0);
    const remaining = Math.max(0, VIDEO_WEEKLY_LIMIT_SECONDS - usedSoFar);
    const requestedDuration = 20;

    if (remaining < requestedDuration) {
      return res.status(402).json({
        error: `You have used your ${VIDEO_WEEKLY_LIMIT_SECONDS}s teasing video quota for Week ${weekNumber} of 52. Your next 20s drop unlocks next week.`,
        quotaExhausted: true,
        videoSecondsUsedThisWeek: usedSoFar,
        videoSecondsWeeklyLimit: VIDEO_WEEKLY_LIMIT_SECONDS,
        currentWeekNumber: weekNumber,
      });
    }

    if (!ai) {
      return res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in Settings > Secrets. Add your key to generate teasing weekly AI videos.',
      });
    }

    const { prompt, chatContext } = req.body ?? {};
    const cleanPrompt = sanitizeText(prompt, 300) || 'Slow midnight velvet anticipation';
    const cleanContext = sanitizeText(chatContext, 300);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Create a 20-second (0..20s) teasing sensory video sequence for Week ${weekNumber} of 52.\nPrompt: ${cleanPrompt}\n${cleanContext ? `Chat mood context: ${cleanContext}` : ''}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            'You are a sensual choreography director for Watch me Darling (18+). Design a 20-second teasing visual loop (4 sequential 5-second scenes covering 0-5, 5-10, 10-15, 15-20s) synchronized to rising smartwatch vibration intensity. Keep captions evocative, teasing, flirtatious, and tasteful. Return JSON with `title` (3-6 words), `palette` (3 hex colors [dark, accent, highlight]), and `scenes` array of 4 items each with `secondStart`, `secondEnd`, `caption` (short poetic teasing line <=52 chars), `motionStyle` (strictly one of: swell, shimmer, ripple, ember), `intensity` (35-95 rising toward climax), `frequencyHz` (45-165).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              palette: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    secondStart: { type: Type.INTEGER },
                    secondEnd: { type: Type.INTEGER },
                    caption: { type: Type.STRING },
                    motionStyle: { type: Type.STRING },
                    intensity: { type: Type.INTEGER },
                    frequencyHz: { type: Type.INTEGER },
                  },
                  required: [
                    'secondStart',
                    'secondEnd',
                    'caption',
                    'motionStyle',
                    'intensity',
                    'frequencyHz',
                  ],
                },
              },
            },
            required: ['title', 'palette', 'scenes'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        title?: string;
        palette?: string[];
        scenes?: Array<{
          secondStart?: number;
          secondEnd?: number;
          caption?: string;
          motionStyle?: string;
          intensity?: number;
          frequencyHz?: number;
        }>;
      };

      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      const rawPalette = Array.isArray(parsed.palette) ? parsed.palette : [];
      const palette: [string, string, string] = [
        hexRegex.test(rawPalette[0] ?? '') ? rawPalette[0] : '#381625',
        hexRegex.test(rawPalette[1] ?? '') ? rawPalette[1] : '#E85D75',
        hexRegex.test(rawPalette[2] ?? '') ? rawPalette[2] : '#E8C5A5',
      ];

      const validMotion = new Set(['swell', 'shimmer', 'ripple', 'ember']);
      const defaultCaptions = [
        'Closer now… feel the room slow down.',
        'Every breath lingers on your wrist.',
        'Wait for the crest—don’t look away.',
        'Right at the edge of tonight.',
      ];

      const rawScenes = Array.isArray(parsed.scenes) ? parsed.scenes.slice(0, 4) : [];
      const scenes = [0, 1, 2, 3].map((idx) => {
        const s = rawScenes[idx];
        return {
          secondStart: idx * 5,
          secondEnd: (idx + 1) * 5,
          caption: sanitizeText(s?.caption, 60) || defaultCaptions[idx],
          motionStyle: (validMotion.has(s?.motionStyle ?? '')
            ? s?.motionStyle
            : idx % 2 === 0
            ? 'swell'
            : 'ember') as 'swell' | 'shimmer' | 'ripple' | 'ember',
          intensity: Math.round(clampNumber(s?.intensity, 35, 96, 48 + idx * 14)),
          frequencyHz: Math.round(clampNumber(s?.frequencyHz, 40, 175, 52 + idx * 24)),
        };
      });

      // Deduct the 20-second weekly quota and issue updated signed token
      const updatedRecord: ActiveSubscription = {
        ...verifiedSub,
        videoSecondsUsedByWeek: {
          ...verifiedSub.videoSecondsUsedByWeek,
          [weekNumber]: usedSoFar + requestedDuration,
        },
      };
      const updatedToken = signSubscriptionToken(updatedRecord);
      activeTokens.set(updatedToken, updatedRecord);

      return res.json({
        video: {
          id: `vid-${Date.now()}`,
          title: sanitizeText(parsed.title, 48) || `Week ${weekNumber} Tease`,
          weekNumber,
          durationSeconds: requestedDuration,
          palette,
          scenes,
          createdAt: Date.now(),
        },
        session: serializeSessionResponse(updatedRecord, updatedToken),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to generate teasing AI video.';
      return res.status(502).json({ error: `Video Generator error: ${msg}` });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let currentRoomId: string | null = null;
    const memberId: string = crypto.randomUUID();

    ws.on('message', (data) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = msg.type;

      if (type === 'watch:host') {
        const watchCode = sanitizeWatchCode(msg.watchCode);
        const existing = watchLinks.get(watchCode) ?? {
          hostWs: null,
          watchWs: null,
          watchName: 'QR Smartwatch',
        };
        existing.hostWs = ws;
        watchLinks.set(watchCode, existing);
        if (existing.watchWs && existing.watchWs.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'watch:paired',
              watchCode,
              watchName: existing.watchName,
            })
          );
        }
        return;
      }

      if (type === 'watch:join') {
        const watchCode = sanitizeWatchCode(msg.watchCode);
        const watchName = sanitizeText(msg.watchName, 36) || 'QR Paired Smartwatch';
        const existing = watchLinks.get(watchCode) ?? {
          hostWs: null,
          watchWs: null,
          watchName,
        };
        existing.watchWs = ws;
        existing.watchName = watchName;
        watchLinks.set(watchCode, existing);

        ws.send(
          JSON.stringify({
            type: 'watch:joined',
            watchCode,
            watchName,
          })
        );
        if (existing.hostWs && existing.hostWs.readyState === WebSocket.OPEN) {
          existing.hostWs.send(
            JSON.stringify({
              type: 'watch:paired',
              watchCode,
              watchName,
            })
          );
        }
        return;
      }

      if (type === 'watch:pulse') {
        const watchCode = sanitizeWatchCode(msg.watchCode);
        const link = watchLinks.get(watchCode);
        if (link?.watchWs && link.watchWs.readyState === WebSocket.OPEN) {
          link.watchWs.send(
            JSON.stringify({
              type: 'watch:pulse',
              intensity: Math.round(clampNumber(msg.intensity, 0, 100, 0)),
              frequencyHz: Math.round(clampNumber(msg.frequencyHz, 20, 220, 60)),
              timestamp: Date.now(),
            })
          );
        }
        return;
      }

      if (type === 'room:join') {
        const nextRoomId = sanitizeRoomId(msg.roomId);
        // Leave previous room if switching
        if (currentRoomId && rooms.has(currentRoomId)) {
          const prevRoom = rooms.get(currentRoomId)!;
          prevRoom.members.delete(memberId);
          broadcastToRoom(prevRoom, {
            type: 'room:presence',
            roomId: currentRoomId,
            members: serializeMembers(prevRoom),
          });
          if (prevRoom.members.size === 0 && prevRoom.messages.length === 0) {
            rooms.delete(currentRoomId);
          }
        }

        currentRoomId = nextRoomId;
        const room = getOrCreateRoom(nextRoomId);
        const rawPlatform = String(msg.platform || '');
        const validPlatforms = new Set(['pc', 'android-pc', 'ipad', 'iphone', 'android-phone']);
        const platform = (validPlatforms.has(rawPlatform)
          ? rawPlatform
          : 'pc') as 'pc' | 'android-pc' | 'ipad' | 'iphone' | 'android-phone';

        const member: RoomMember = {
          id: memberId,
          name: sanitizeText(msg.name, 28) || 'Partner',
          platform,
          watchConnected: Boolean(msg.watchConnected),
          earbudConnected: Boolean(msg.earbudConnected),
          watchName: sanitizeText(msg.watchName, 36) || 'Smartwatch',
          earbudName: sanitizeText(msg.earbudName, 36) || 'Earbuds',
          ws,
        };
        room.members.set(memberId, member);

        ws.send(
          JSON.stringify({
            type: 'room:joined',
            roomId: nextRoomId,
            selfId: memberId,
            members: serializeMembers(room),
            messages: room.messages,
          })
        );

        broadcastToRoom(
          room,
          {
            type: 'room:presence',
            roomId: nextRoomId,
            members: serializeMembers(room),
          },
          memberId
        );
        return;
      }

      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      if (type === 'device:status') {
        const member = room.members.get(memberId);
        if (!member) return;
        member.watchConnected = Boolean(msg.watchConnected);
        member.earbudConnected = Boolean(msg.earbudConnected);
        member.watchName = sanitizeText(msg.watchName, 36) || member.watchName;
        member.earbudName = sanitizeText(msg.earbudName, 36) || member.earbudName;
        broadcastToRoom(room, {
          type: 'room:presence',
          roomId: currentRoomId,
          members: serializeMembers(room),
        });
        return;
      }

      if (type === 'haptic:pulse') {
        const sender = room.members.get(memberId);
        const validPatterns = new Set(['wave', 'heartbeat', 'crescendo', 'whisper', 'rhythmic']);
        const pattern = validPatterns.has(String(msg.pattern)) ? String(msg.pattern) : 'wave';
        broadcastToRoom(
          room,
          {
            type: 'haptic:pulse',
            senderId: memberId,
            senderName: sender?.name || 'Partner',
            intensity: Math.round(clampNumber(msg.intensity, 0, 100, 0)),
            frequencyHz: Math.round(clampNumber(msg.frequencyHz, 20, 220, 60)),
            pattern,
            sourceMode: sanitizeText(msg.sourceMode, 16) || 'control',
            timestamp: Date.now(),
          },
          memberId
        );
        return;
      }

      if (type === 'chat:send') {
        const sender = room.members.get(memberId);
        const text = sanitizeText(msg.text, 600);
        const attached = msg.attachedPulse as
          | {
              label?: unknown;
              baseHz?: unknown;
              intensity?: unknown;
              rhythmBpm?: unknown;
              pattern?: unknown;
            }
          | undefined;

        if (!text && !attached) return;

        const validPatterns = new Set(['wave', 'heartbeat', 'crescendo', 'whisper', 'rhythmic']);
        const record: RoomChatRecord = {
          id: sanitizeText(msg.id, 64) || crypto.randomUUID(),
          senderId: memberId,
          senderName: sender?.name || 'Partner',
          text,
          timestamp: Date.now(),
          attachedPulse: attached
            ? {
                label: sanitizeText(attached.label, 40) || 'Pulse Note',
                baseHz: Math.round(clampNumber(attached.baseHz, 30, 180, 68)),
                intensity: Math.round(clampNumber(attached.intensity, 20, 100, 70)),
                rhythmBpm: Math.round(clampNumber(attached.rhythmBpm, 45, 130, 72)),
                pattern: (validPatterns.has(String(attached.pattern))
                  ? String(attached.pattern)
                  : 'heartbeat') as 'wave' | 'heartbeat' | 'crescendo' | 'whisper' | 'rhythmic',
              }
            : undefined,
        };

        if (!room.messages.some((m) => m.id === record.id)) {
          room.messages.push(record);
          if (room.messages.length > 100) {
            room.messages.shift();
          }
        }

        broadcastToRoom(room, {
          type: 'chat:message',
          message: record,
        });
        return;
      }

      if (type === 'video:sync') {
        const sender = room.members.get(memberId);
        broadcastToRoom(
          room,
          {
            type: 'video:sync',
            senderId: memberId,
            senderName: sender?.name || 'Partner',
            action: msg.action === 'play' || msg.action === 'pause' ? msg.action : 'seek',
            currentTime: clampNumber(msg.currentTime, 0, 86400, 0),
          },
          memberId
        );
      }
    });

    ws.on('close', () => {
      for (const [code, link] of watchLinks.entries()) {
        if (link.hostWs === ws) {
          link.hostWs = null;
        }
        if (link.watchWs === ws) {
          link.watchWs = null;
          if (link.hostWs && link.hostWs.readyState === WebSocket.OPEN) {
            link.hostWs.send(
              JSON.stringify({
                type: 'watch:disconnected',
                watchCode: code,
              })
            );
          }
        }
        if (!link.hostWs && !link.watchWs) {
          watchLinks.delete(code);
        }
      }

      if (currentRoomId && rooms.has(currentRoomId)) {
        const room = rooms.get(currentRoomId)!;
        room.members.delete(memberId);
        broadcastToRoom(room, {
          type: 'room:presence',
          roomId: currentRoomId,
          members: serializeMembers(room),
        });
        if (room.members.size === 0 && room.messages.length === 0) {
          rooms.delete(currentRoomId);
        }
      }
    });
  });

  const downloadsBaseDir = path.resolve(
    __dirname,
    IS_PROD && fs.existsSync(path.resolve(__dirname, 'dist/downloads')) ? 'dist/downloads' : 'public/downloads'
  );
  const debugApkPath = path.resolve(downloadsBaseDir, 'watch-me-darling-debug.apk');

  app.get('/downloads/watch-me-darling-debug.apk', (_req, res) => {
    if (
      !debugApkPath.startsWith(downloadsBaseDir + path.sep) ||
      !fs.existsSync(debugApkPath)
    ) {
      return res.status(404).json({ error: 'Debug APK build not found.' });
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="watch-me-darling-debug.apk"');
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(debugApkPath);
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Watch me Darling server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Watch me Darling server:', err);
  process.exit(1);
});
