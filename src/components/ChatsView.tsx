import { Download, HeartHandshake, Image as ImageIcon, Lock, Send, Sparkles, Waves } from 'lucide-react';
import { useState } from 'react';
import { renderChatVisualToDataUrl } from '../engines/sensoryMediaRenderer.ts';
import type {
  AddOnId,
  AiChatMessage,
  PlanTierId,
  RoomChatMessage,
  SubscriptionSession,
  SuggestedPulse,
} from '../types.ts';

interface ChatsViewProps {
  roomId: string;
  selfId: string | null;
  roomMessages: RoomChatMessage[];
  onSendRoomMessage: (text: string, attachedPulse?: SuggestedPulse) => void;
  onPlayPulse: (pulse: SuggestedPulse) => void;
  partnerConnected: boolean;
  planId: PlanTierId;
  session: SubscriptionSession;
  onActivateAddOn: (addOnId: AddOnId) => Promise<void>;
  onOpenMembership: () => void;
}

const QUICK_PULSE_ATTACHMENTS: SuggestedPulse[] = [
  {
    label: 'Warm Heartbeat',
    baseHz: 54,
    intensity: 74,
    rhythmBpm: 68,
    pattern: 'heartbeat',
  },
  {
    label: 'Soft Whisper',
    baseHz: 72,
    intensity: 45,
    rhythmBpm: 58,
    pattern: 'whisper',
  },
  {
    label: 'Long Wave',
    baseHz: 88,
    intensity: 82,
    rhythmBpm: 76,
    pattern: 'wave',
  },
];

export function ChatsView({
  roomId,
  selfId,
  roomMessages,
  onSendRoomMessage,
  onPlayPulse,
  partnerConnected,
  planId,
  session,
  onActivateAddOn,
  onOpenMembership,
}: ChatsViewProps) {
  const [channel, setChannel] = useState<'partner' | 'ai'>('partner');

  // Partner room chat state
  const [roomInput, setRoomInput] = useState('');
  const [attachedPulse, setAttachedPulse] = useState<SuggestedPulse | undefined>(undefined);

  // AI Concierge chat state
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([
    {
      id: 'ai-welcome',
      role: 'assistant',
      text: 'Tell me the mood you want to share tonight—slow vinyl warmth, rainstorm focus, or a playful distance rhythm—and I will compose a custom smartwatch pulse sequence.',
      timestamp: Date.now(),
      suggestedPulse: {
        label: 'Evening Ember',
        baseHz: 58,
        intensity: 64,
        rhythmBpm: 62,
        pattern: 'wave',
      },
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [generatingVisual, setGeneratingVisual] = useState(false);
  const [activatingImgPack, setActivatingImgPack] = useState(false);

  const isLifetimeUnlocked = planId === 'lifetime';

  const handleSendRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim() && !attachedPulse) return;
    onSendRoomMessage(roomInput.trim(), attachedPulse);
    setRoomInput('');
    setAttachedPulse(undefined);
  };

  const handleSendAi = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = aiInput.trim();
    if (!prompt || aiLoading) return;

    if (!isLifetimeUnlocked) {
      onOpenMembership();
      return;
    }

    const userMsg: AiChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: prompt,
      timestamp: Date.now(),
    };

    const nextHistory = [...aiMessages, userMsg];
    setAiMessages(nextHistory);
    setAiInput('');
    setAiLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session.token) {
        headers.Authorization = `Bearer ${session.token}`;
      }

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: prompt,
          history: nextHistory.slice(-8).map((m) => ({ role: m.role, text: m.text })),
          currentMode: 'chats',
          partnerConnected,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        suggestedPulse?: SuggestedPulse;
        error?: string;
      };

      if (!res.ok) {
        setAiMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            text: data.error || 'Could not reach AI Concierge right now.',
            timestamp: Date.now(),
            error: true,
          },
        ]);
      } else {
        setAiMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: data.reply || 'Here is a custom resonance profile for your session.',
            timestamp: Date.now(),
            suggestedPulse: data.suggestedPulse,
          },
        ]);
      }
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: 'Network interruption while reaching the AI Sensory Concierge.',
          timestamp: Date.now(),
          error: true,
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateVisualFromChat = async () => {
    if (!session.addOnImageUnlocked) {
      setActivatingImgPack(true);
      try {
        await onActivateAddOn('image-pack');
      } finally {
        setActivatingImgPack(false);
      }
      return;
    }
    if (generatingVisual) return;
    setGeneratingVisual(true);

    const historyRef =
      channel === 'partner' && roomMessages.length > 0
        ? roomMessages.slice(-6).map((m) => ({
            role: m.senderId === selfId ? 'user' : 'assistant',
            text: m.text || m.attachedPulse?.label || 'Pulse note',
          }))
        : aiMessages.slice(-6).map((m) => ({ role: m.role, text: m.text }));

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session.token) {
        headers.Authorization = `Bearer ${session.token}`;
      }
      const res = await fetch('/api/ai/generate-image-scene', {
        method: 'POST',
        headers,
        body: JSON.stringify({ history: historyRef }),
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
        setChannel('ai');
        setAiMessages((prev) => [
          ...prev,
          {
            id: `vis-e-${Date.now()}`,
            role: 'assistant',
            text: data.error || 'Could not generate artwork from chat yet.',
            timestamp: Date.now(),
            error: true,
          },
        ]);
        return;
      }

      const visual = renderChatVisualToDataUrl({
        title: data.title,
        caption: data.caption || 'Rendered directly from your couple chat.',
        motif: data.motif || 'silk',
        palette: data.palette,
        lightingMood: data.lightingMood || 'Candlelit Rose Amber',
      });
      if (data.suggestedPulse) {
        onPlayPulse(data.suggestedPulse);
      }

      setChannel('ai');
      setAiMessages((prev) => [
        ...prev,
        {
          id: `vis-a-${Date.now()}`,
          role: 'assistant',
          text: `Chat-referenced artwork created: "${visual.title}"`,
          timestamp: Date.now(),
          generatedImage: visual,
          suggestedPulse: data.suggestedPulse,
        },
      ]);
    } finally {
      setGeneratingVisual(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#F5F2EE]">
          01. Couple &amp; Concierge Channels
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={generatingVisual || activatingImgPack}
            onClick={() => void handleGenerateVisualFromChat()}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E8C5A5]/35 bg-[#1E1922] px-3 py-1.5 text-xs font-medium text-[#E8C5A5] hover:bg-[#2A2230] cursor-pointer whitespace-nowrap"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>
              {activatingImgPack
                ? 'Unlocking...'
                : generatingVisual
                ? 'Rendering...'
                : session.addOnImageUnlocked
                ? 'Generate Chat Picture'
                : 'Add-On 1 · ₱150'}
            </span>
          </button>

          {/* Segmented Channel Switcher */}
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#16141A] p-1">
            <button
              type="button"
              onClick={() => setChannel('partner')}
              className={`flex min-h-[38px] items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                channel === 'partner'
                  ? 'bg-[#E85D75] text-white'
                  : 'text-[#A099A8] hover:text-[#F5F2EE]'
              }`}
            >
              <HeartHandshake className="h-3.5 w-3.5" />
              Partner Room ({roomId})
            </button>
            <button
              type="button"
              onClick={() => setChannel('ai')}
              className={`flex min-h-[38px] items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                channel === 'ai'
                  ? 'bg-[#E85D75] text-white'
                  : 'text-[#A099A8] hover:text-[#F5F2EE]'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Concierge
            </button>
          </div>
        </div>
      </div>

      {channel === 'partner' ? (
        <section className="flex h-[520px] flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#16141A]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5 text-xs text-[#A099A8]">
            <div className="flex items-center gap-2.5">
              <div className="flex -space-x-2">
                <img
                  src="/src/assets/images/couple_partner_a_1795443282709.jpg"
                  alt="You"
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-full border border-[#16141A] object-cover"
                />
                <img
                  src="/src/assets/images/couple_partner_b_1795443282321.jpg"
                  alt="Partner"
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-full border border-[#16141A] object-cover"
                />
              </div>
              <span className="font-medium text-[#F5F2EE]">Room {roomId}</span>
            </div>
            <span>{partnerConnected ? 'Partner online' : 'Share room code to invite partner'}</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {roomMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-xs text-[#8F8898]">
                <Waves className="mb-2 h-7 w-7 text-[#E85D75]/70" />
                <p>No messages in {roomId} yet.</p>
                <p className="mt-1">Attach a pulse note below so your partner feels it on arrival.</p>
              </div>
            ) : (
              roomMessages.map((msg) => {
                const mine = msg.senderId === selfId;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                  >
                    <span className="mb-1 text-[11px] text-[#8F8898]">
                      {mine ? 'You' : msg.senderName}
                    </span>
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
                        mine
                          ? 'bg-[#E85D75] text-white'
                          : 'border border-white/[0.08] bg-[#0D0C0F] text-[#F5F2EE]'
                      }`}
                    >
                      {msg.text && <p className="leading-relaxed">{msg.text}</p>}
                      {msg.attachedPulse && (
                        <button
                          type="button"
                          onClick={() => onPlayPulse(msg.attachedPulse!)}
                          className={`mt-2 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                            mine
                              ? 'bg-black/20 text-white hover:bg-black/30'
                              : 'bg-[#1D1924] text-[#E8C5A5] hover:bg-[#272230]'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <Waves className="h-3.5 w-3.5" />
                            {msg.attachedPulse.label}
                          </span>
                          <span className="font-mono-tabular">
                            {msg.attachedPulse.baseHz} Hz · Replay
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pulse Note Attachment Picker + Message Composer */}
          <form onSubmit={handleSendRoom} className="border-t border-white/[0.06] bg-[#121015] p-4">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-[#8F8898]">Attach pulse:</span>
              {QUICK_PULSE_ATTACHMENTS.map((p) => {
                const selected = attachedPulse?.label === p.label;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setAttachedPulse(selected ? undefined : p)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#E85D75]/20 border border-[#E85D75] text-[#F5F2EE]'
                        : 'border border-white/10 bg-[#0D0C0F] text-[#A099A8] hover:text-[#F5F2EE]'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="Write a note to your partner..."
                className="h-11 flex-1 rounded-xl border border-white/10 bg-[#0D0C0F] px-4 text-sm text-[#F5F2EE] placeholder:text-[#6E6778] focus:border-[#E85D75] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Send partner message"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E85D75] text-white hover:bg-[#d94d66] cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="relative flex h-[520px] flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#16141A]">
          {!isLifetimeUnlocked && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0D0C0F]/88 backdrop-blur-sm p-6 text-center">
              <Lock className="h-8 w-8 text-[#E8C5A5]" />
              <h2 className="font-display mt-3 text-xl font-medium text-[#F5F2EE]">
                Couple AI Concierge · ₱250 Lifetime
              </h2>
              <p className="mt-1.5 max-w-md text-xs text-[#A099A8] leading-relaxed">
                Get personalized distant-lover conversation prompts and AI-composed smartwatch vibration patterns tailored to your music and mood.
              </p>
              <button
                type="button"
                onClick={onOpenMembership}
                className="mt-4 min-h-[44px] rounded-xl bg-[#E85D75] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
              >
                Unlock ₱250 Lifetime Pass
              </button>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5 text-xs text-[#A099A8]">
            <span>AI Vibe &amp; Pulse Composer</span>
            <span>Generates playable watch rhythms</span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {aiMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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
                        className="aspect-square w-full max-w-[260px] object-cover"
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
                      className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-[#E85D75]/40 bg-[#1B1620] px-3.5 py-2.5 text-xs font-medium text-[#F5F2EE] hover:bg-[#251E2C] cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Waves className="h-4 w-4 text-[#E85D75]" />
                        <span>Play &ldquo;{msg.suggestedPulse.label}&rdquo;</span>
                      </span>
                      <span className="font-mono-tabular text-[#E8C5A5]">
                        {msg.suggestedPulse.baseHz} Hz · {msg.suggestedPulse.intensity}%
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="text-xs text-[#8F8898]">Composing sensory rhythm...</div>
            )}
          </div>

          <form onSubmit={handleSendAi} className="border-t border-white/[0.06] bg-[#121015] p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask for a slow heartbeat pattern, rain mood, or date prompt..."
                className="h-11 flex-1 rounded-xl border border-white/10 bg-[#0D0C0F] px-4 text-sm text-[#F5F2EE] placeholder:text-[#6E6778] focus:border-[#E85D75] focus:outline-none"
              />
              <button
                type="submit"
                disabled={aiLoading}
                aria-label="Send message to AI concierge"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E85D75] text-white hover:bg-[#d94d66] disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
