import { Crown, Download, Flame, Image as ImageIcon, Send, Sparkles, Waves } from 'lucide-react';
import { useRef, useState } from 'react';
import { renderChatVisualToDataUrl } from '../engines/sensoryMediaRenderer.ts';
import { generateClientId } from '../utils/platform.ts';
import type {
  AddOnId,
  AiChatMessage,
  PlanTierId,
  SubscriptionSession,
  SuggestedPulse,
} from '../types.ts';

interface SoloAiChatProps {
  session: SubscriptionSession;
  onPlayPulse: (pulse: SuggestedPulse) => void;
  onActivatePlan: (planId: PlanTierId) => Promise<void>;
  onActivateAddOn: (addOnId: AddOnId) => Promise<void>;
  onOpenMembership: () => void;
}

const FREE_MESSAGE_LIMIT = 10;

const QUICK_PROMPTS = [
  'Tease me slowly',
  'Build a warm pulse',
  'Whispered tension',
  'Slow burn rhythm',
];

export function SoloAiChat({
  session,
  onPlayPulse,
  onActivatePlan,
  onActivateAddOn,
  onOpenMembership,
}: SoloAiChatProps) {
  const sessionKeyRef = useRef<string>(generateClientId('solo'));

  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'solo-ai-welcome',
      role: 'assistant',
      text: 'I am right here with you. Tell me how you want tonight to feel—slow and teasing, or deep and breathless—and I will send matching pulse waves straight to your wrist.',
      timestamp: Date.now(),
      suggestedPulse: {
        label: 'Velvet Tease',
        baseHz: 56,
        intensity: 62,
        rhythmBpm: 60,
        pattern: 'wave',
      },
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingImg, setGeneratingImg] = useState(false);
  const [usedCount, setUsedCount] = useState(0);
  const [serverLimitReached, setServerLimitReached] = useState(false);
  const [activatingKey, setActivatingKey] = useState<string | null>(null);
  const [showAddOnPrompt, setShowAddOnPrompt] = useState(false);

  const isPaid = session.planId === 'lifetime';
  const remaining = Math.max(0, FREE_MESSAGE_LIMIT - usedCount);
  const isPaywalled = !isPaid && (serverLimitReached || usedCount >= FREE_MESSAGE_LIMIT);

  const sendMessage = async (rawText: string) => {
    const prompt = rawText.trim();
    if (!prompt || loading || isPaywalled) return;

    const userMsg: AiChatMessage = {
      id: `solo-u-${Date.now()}`,
      role: 'user',
      text: prompt,
      timestamp: Date.now(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session.token) {
        headers.Authorization = `Bearer ${session.token}`;
      }

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: prompt,
          history: nextHistory.slice(-10).map((m) => ({ role: m.role, text: m.text })),
          currentMode: 'solo',
          persona: 'sensual-solo',
          partnerConnected: false,
          sessionKey: sessionKeyRef.current,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        suggestedPulse?: SuggestedPulse;
        remainingFreeMessages?: number | null;
        limitReached?: boolean;
        error?: string;
      };

      if (res.status === 402 || data.limitReached) {
        setServerLimitReached(true);
        if (typeof data.remainingFreeMessages === 'number') {
          setUsedCount(FREE_MESSAGE_LIMIT - data.remainingFreeMessages);
        }
      }

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `solo-err-${Date.now()}`,
            role: 'assistant',
            text: data.error || 'Could not reach the Solo AI companion right now.',
            timestamp: Date.now(),
            error: true,
          },
        ]);
      } else {
        const nextUsed =
          typeof data.remainingFreeMessages === 'number'
            ? FREE_MESSAGE_LIMIT - data.remainingFreeMessages
            : usedCount + 1;
        setUsedCount(nextUsed);
        if (data.suggestedPulse) {
          onPlayPulse(data.suggestedPulse);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `solo-a-${Date.now()}`,
            role: 'assistant',
            text: data.reply || 'Feel that slow wave settle across your wrist.',
            timestamp: Date.now(),
            suggestedPulse: data.suggestedPulse,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `solo-err-${Date.now()}`,
          role: 'assistant',
          text: 'Network interruption while reaching the Solo AI companion.',
          timestamp: Date.now(),
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateChatPicture = async () => {
    if (!session.addOnImageUnlocked) {
      setShowAddOnPrompt(true);
      return;
    }
    if (generatingImg) return;
    setGeneratingImg(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session.token) {
        headers.Authorization = `Bearer ${session.token}`;
      }
      const res = await fetch('/api/ai/generate-image-scene', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = (await res.json()) as {
        title?: string;
        caption?: string;
        motif?: 'silk' | 'candle' | 'rain' | 'silhouette' | 'eclipse';
        palette?: [string, string, string, string];
        lightingMood?: string;
        suggestedPulse?: SuggestedPulse;
        error?: string;
      };
      if (!res.ok || !data.title || !data.palette) {
        setMessages((prev) => [
          ...prev,
          {
            id: `solo-vis-err-${Date.now()}`,
            role: 'assistant',
            text: data.error || 'Could not generate a picture from this chat yet.',
            timestamp: Date.now(),
            error: true,
          },
        ]);
        return;
      }

      const rendered = renderChatVisualToDataUrl({
        title: data.title,
        caption: data.caption || 'Rendered directly from your private conversation.',
        motif: data.motif || 'silk',
        palette: data.palette,
        lightingMood: data.lightingMood || 'Candlelit Rose Amber',
      });

      if (data.suggestedPulse) {
        onPlayPulse(data.suggestedPulse);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `solo-vis-${Date.now()}`,
          role: 'assistant',
          text: `Generated artwork from your chat: "${rendered.title}"`,
          timestamp: Date.now(),
          generatedImage: rendered,
          suggestedPulse: data.suggestedPulse,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `solo-vis-err-${Date.now()}`,
          role: 'assistant',
          text: 'Network interruption while rendering chat artwork.',
          timestamp: Date.now(),
          error: true,
        },
      ]);
    } finally {
      setGeneratingImg(false);
    }
  };

  const handleQuickPlan = async (planId: PlanTierId) => {
    setActivatingKey(planId);
    try {
      await onActivatePlan(planId);
      setServerLimitReached(false);
    } finally {
      setActivatingKey(null);
    }
  };

  const handleQuickAddOn = async (addOnId: AddOnId) => {
    setActivatingKey(addOnId);
    try {
      await onActivateAddOn(addOnId);
      setShowAddOnPrompt(false);
    } finally {
      setActivatingKey(null);
    }
  };

  return (
    <section
      aria-labelledby="solo-ai-chat-heading"
      className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#16141A]"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-[#E85D75]" />
          <h3 id="solo-ai-chat-heading" className="text-sm font-semibold text-[#F5F2EE]">
            06. Solo AI Intimate Chat
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={generatingImg}
            onClick={() => void handleGenerateChatPicture()}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[#E8C5A5]/35 bg-[#1E1922] px-2.5 py-1 text-[11px] font-medium text-[#E8C5A5] hover:bg-[#2A2230] disabled:opacity-50 cursor-pointer"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>
              {generatingImg
                ? 'Rendering...'
                : session.addOnImageUnlocked
                ? 'Picture From Chat'
                : 'Add-On 1 · ₱150'}
            </span>
          </button>
          <span className="font-mono-tabular text-xs text-[#E8C5A5]">
            {isPaid
              ? 'Unlimited · Lifetime'
              : `${remaining} of ${FREE_MESSAGE_LIMIT} free`}
          </span>
        </div>
      </div>

      {/* Add-On 1 Inline Offer Banner when clicked while locked */}
      {showAddOnPrompt && !session.addOnImageUnlocked && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8C5A5]/25 bg-[#1D1720] px-5 py-3.5 text-xs">
          <div>
            <p className="font-semibold text-[#F5F2EE]">
              Add-On 1 · Chat-Referenced AI Image Generation (₱150 one-time)
            </p>
            <p className="mt-0.5 text-[#A099A8]">
              Turn any line from your conversation into downloadable 1024×1024 intimate mood art.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddOnPrompt(false)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[#A099A8] hover:text-[#F5F2EE] cursor-pointer"
            >
              Later
            </button>
            <button
              type="button"
              disabled={activatingKey !== null}
              onClick={() => void handleQuickAddOn('image-pack')}
              className="rounded-lg bg-[#E8C5A5] px-3.5 py-1.5 font-semibold text-[#141118] hover:bg-[#f0d2b6] disabled:opacity-60 cursor-pointer"
            >
              {activatingKey === 'image-pack' ? 'Unlocking...' : 'Unlock Add-On 1 · ₱150'}
            </button>
          </div>
        </div>
      )}

      {/* Conversation Thread */}
      <div className="max-h-96 space-y-3 overflow-y-auto p-5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#E85D75] text-white'
                  : msg.error
                  ? 'border border-[#F47286]/40 bg-[#2A141B] text-[#F5D0D6]'
                  : 'border border-white/[0.08] bg-[#0D0C0F] text-[#F5F2EE]'
              }`}
            >
              <p>{msg.text}</p>

              {msg.generatedImage && msg.generatedImage.dataUrl && (
                <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#141118]">
                  <img
                    src={msg.generatedImage.dataUrl}
                    alt={msg.generatedImage.title}
                    className="aspect-square w-full max-w-[280px] object-cover"
                  />
                  <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-[#A099A8]">
                    <span className="truncate">{msg.generatedImage.lightingMood}</span>
                    <a
                      href={msg.generatedImage.dataUrl}
                      download={`${msg.generatedImage.title.toLowerCase().replace(/\s+/g, '-')}.png`}
                      className="inline-flex items-center gap-1 font-medium text-[#E8C5A5] hover:underline"
                    >
                      <Download className="h-3 w-3" />
                      Save
                    </a>
                  </div>
                </div>
              )}

              {msg.suggestedPulse && (
                <button
                  type="button"
                  onClick={() => onPlayPulse(msg.suggestedPulse!)}
                  className="mt-2.5 flex w-full items-center justify-between gap-3 rounded-xl border border-[#E85D75]/40 bg-[#1B1620] px-3 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#251E2C] cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Waves className="h-3.5 w-3.5 text-[#E85D75]" />
                    <span>Feel &ldquo;{msg.suggestedPulse.label}&rdquo; on Watch</span>
                  </span>
                  <span className="font-mono-tabular text-[#E8C5A5]">
                    {msg.suggestedPulse.baseHz} Hz · {msg.suggestedPulse.intensity}%
                  </span>
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-[#8F8898]">Composing reply &amp; pulse...</div>}
      </div>

      {/* Inline Lifetime Membership + Add-Ons Offer after 10 free messages */}
      {isPaywalled ? (
        <div className="border-t border-[#E85D75]/30 bg-[#1D1620] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F2EE]">
                <Crown className="h-4 w-4 text-[#E8C5A5]" />
                <span>10 Free Messages Complete — Unlock Lifetime Membership (₱250)</span>
              </div>
              <p className="mt-1 text-xs text-[#A099A8]">
                Pay ₱250 once upon download for unlimited Solo Mode, Couple Mode &amp; Device Video playback, or pair with creative image &amp; teasing AI video add-ons.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenMembership}
              className="text-xs font-medium text-[#E8C5A5] hover:underline cursor-pointer whitespace-nowrap"
            >
              See Weekly Drops
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col justify-between rounded-2xl border border-[#E85D75]/60 bg-[#0D0C0F] p-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F5F2EE]">Lifetime Pass</span>
                  <span className="font-mono-tabular text-sm font-semibold text-[#E85D75]">
                    ₱250
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#8F8898]">
                  Unlocks unlimited Solo Mode, Couple Mode &amp; device Video Mode forever.
                </p>
              </div>
              <button
                type="button"
                disabled={activatingKey !== null}
                onClick={() => void handleQuickPlan('lifetime')}
                className="mt-3 min-h-[40px] w-full rounded-xl bg-[#E85D75] px-3 py-2 text-xs font-semibold text-white hover:bg-[#d94d66] disabled:opacity-60 cursor-pointer"
              >
                {activatingKey === 'lifetime' ? 'Activating...' : 'Unlock ₱250 Lifetime'}
              </button>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0D0C0F] p-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F5F2EE]">Add-On 1 · Imagery</span>
                  <span className="font-mono-tabular text-sm font-semibold text-[#E8C5A5]">
                    ₱150
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#8F8898]">
                  Generate custom pictures referencing your active chat lines.
                </p>
              </div>
              <button
                type="button"
                disabled={activatingKey !== null || session.addOnImageUnlocked}
                onClick={() => void handleQuickAddOn('image-pack')}
                className="mt-3 min-h-[40px] w-full rounded-xl bg-[#25212C] px-3 py-2 text-xs font-semibold text-[#F5F2EE] hover:bg-[#322C3B] disabled:opacity-60 cursor-pointer"
              >
                {session.addOnImageUnlocked
                  ? 'Add-On 1 Active'
                  : activatingKey === 'image-pack'
                  ? 'Activating...'
                  : 'Add Imagery · ₱150'}
              </button>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0D0C0F] p-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F5F2EE]">Add-On 2 · Tease Video</span>
                  <span className="font-mono-tabular text-sm font-semibold text-[#E8C5A5]">
                    ₱350/yr
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#8F8898]">
                  20s/week of teasing AI video synced to your watch for 1 year.
                </p>
              </div>
              <button
                type="button"
                disabled={activatingKey !== null || session.addOnVideoUnlocked}
                onClick={() => void handleQuickAddOn('video-pack')}
                className="mt-3 min-h-[40px] w-full rounded-xl bg-[#25212C] px-3 py-2 text-xs font-semibold text-[#F5F2EE] hover:bg-[#322C3B] disabled:opacity-60 cursor-pointer"
              >
                {session.addOnVideoUnlocked
                  ? 'Add-On 2 Active'
                  : activatingKey === 'video-pack'
                  ? 'Activating...'
                  : 'Add Video Pack · ₱350/yr'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
          className="border-t border-white/[0.06] bg-[#121015] p-4"
        >
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendMessage(q)}
                  className="rounded-lg border border-white/10 bg-[#0D0C0F] px-2.5 py-1 text-[11px] text-[#A099A8] hover:border-[#E85D75]/40 hover:text-[#F5F2EE] cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
            {session.addOnImageUnlocked && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#E8C5A5]">
                <Sparkles className="h-3 w-3" />
                Chat Imagery Active
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell me what mood or rhythm you crave tonight..."
              className="h-11 flex-1 rounded-xl border border-white/10 bg-[#0D0C0F] px-4 text-sm text-[#F5F2EE] placeholder:text-[#6E6778] focus:border-[#E85D75] focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              aria-label="Send solo chat message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E85D75] text-white hover:bg-[#d94d66] disabled:opacity-50 cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
