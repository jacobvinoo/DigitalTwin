import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import VoiceInputPanel from './VoiceInputPanel';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConversationMessage {
  id: number;
  sender: 'user' | 'assistant' | 'executive' | 'system';
  channel: 'text' | 'voice';
  message_text: string;
  intent?: string;
  created_at: string;
}

interface ResponseCard {
  type: string;
  data?: Record<string, unknown>;
}

interface SessionData {
  id: number;
  title: string;
  active_entity: 'assistant' | 'executive';
  status: 'active' | 'archived';
  topic?: { id: number; title: string };
  messages: ConversationMessage[];
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'executive';
  text: string;
  cards?: ResponseCard[];
}

// ─── EntitySwitcher ─────────────────────────────────────────────────────────

export function EntitySwitcher({
  activeEntity,
  onSwitch,
}: {
  activeEntity: 'assistant' | 'executive';
  onSwitch: (entity: 'assistant' | 'executive') => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {(['assistant', 'executive'] as const).map((entity) => (
        <button
          key={entity}
          data-testid={`entity-btn-${entity}`}
          onClick={() => onSwitch(entity)}
          className={
            activeEntity === entity
              ? 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-all'
              : 'rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-all hover:text-slate-800'
          }
        >
          {entity === 'assistant' ? 'Assistant' : 'Executive'}
        </button>
      ))}
    </div>
  );
}

// ─── ResponseCardRenderer ───────────────────────────────────────────────────

function ApprovalCard({ data }: { data: Record<string, unknown> }) {
  const riskColor =
    data.risk_level === 'high'
      ? 'border-l-red-500 bg-red-50'
      : data.risk_level === 'medium'
      ? 'border-l-amber-500 bg-amber-50'
      : 'border-l-green-500 bg-green-50';

  return (
    <div className={`mt-2 rounded-lg border-l-4 p-3 ${riskColor}`}>
      <p className="text-sm font-semibold text-slate-800">{String(data.title ?? 'Action')}</p>
      <p className="text-xs text-slate-500 capitalize">Risk: {String(data.risk_level ?? 'unknown')}</p>
    </div>
  );
}

function TaskStatusCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">{String(data.title ?? 'Task')}</p>
      <p className="text-xs text-slate-400 capitalize">{String(data.status ?? '')}</p>
    </div>
  );
}

function OutputReviewCard({ data }: { data: Record<string, unknown> }) {
  const quality = typeof data.quality === 'number' ? Math.round(data.quality * 100) : null;
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">{String(data.title ?? 'Output')}</p>
      {quality !== null && (
        <p className="text-xs text-slate-400">Quality: {quality}%</p>
      )}
    </div>
  );
}

function StatusCard() {
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wider">Status Summary</p>
    </div>
  );
}

function ExecutiveCritiqueCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div
      data-testid="executive-critique-card"
      className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm space-y-2"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400">Executive Review</p>
      {!!data.critique && (
        <p className="text-slate-800 font-medium">{String(data.critique)}</p>
      )}
      {!!data.risk && (
        <p className="text-xs text-red-700 border border-red-100 bg-red-50 rounded px-2 py-1">
          ⚠ {String(data.risk)}
        </p>
      )}
      {!!data.recommendation && (
        <p className="text-xs text-indigo-700">
          → {String(data.recommendation)}
        </p>
      )}
    </div>
  );
}



function ActionApprovedCard() {
  return (
    <div
      data-testid="action-approved-card"
      className="mt-2 rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-green-600">Action Approved</p>
      <p className="text-sm font-semibold text-slate-800 mt-1">Action Approved</p>
    </div>
  );
}

function ActionExecutedCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div
      className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Action Executed</p>
      <p className="text-sm font-semibold text-slate-800 mt-1">Action Executed Successfully</p>
      {!!data?.message_id && (
        <p className="text-xs text-slate-500 mt-1 font-mono">ID: {String(data.message_id)}</p>
      )}
    </div>
  );
}



function PendingApprovalsCard({ data }: { data: Record<string, unknown> }) {
  const actionsList = (data.actions as any[]) || [];
  return (
    <div className="space-y-3 mt-2">
      {actionsList.map((act: any, idx: number) => (
        <InlineApprovalCard key={idx} action={act} />
      ))}
    </div>
  );
}

function InlineApprovalCard({ action }: { action: any }) {
  const [status, setStatus] = useState(action.status || 'awaiting_approval');
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await api.post(`/api/actions/${action.id}/approve/`);
      setStatus('approved');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const riskColor =
    action.risk_level === 'high'
      ? 'border-l-red-500 bg-red-50'
      : action.risk_level === 'medium'
      ? 'border-l-amber-500 bg-amber-50'
      : 'border-l-green-500 bg-green-50';

  return (
    <div data-testid="approval-card" className={`rounded-xl border-l-4 border-y border-r border-slate-200 p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center ${riskColor}`}>
      <div>
        <p className="text-sm font-semibold text-slate-800">{action.title || 'Action Request'}</p>
        <p className="text-xs text-slate-500 mt-1">
          Risk: <span className="font-semibold capitalize">{action.risk_level || 'medium'}</span>
        </p>
        <p data-testid="approval-status" className="text-xs font-semibold text-slate-600 mt-1">
          Status: <span className="capitalize">{status}</span>
        </p>
      </div>
      {(status === 'awaiting_approval' || status === 'drafted' || status === 'proposed') && (
        <button
          onClick={handleApprove}
          disabled={loading}
          className="mt-3 md:mt-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Approving...' : 'Approve'}
        </button>
      )}
    </div>
  );
}

export function ResponseCardRenderer({ cards }: { cards: ResponseCard[] }) {
  if (!cards || cards.length === 0) return null;
  return (
    <div className="mt-1 space-y-1">
      {cards.map((card, i) => {
        if (card.type === 'approval_card')
          return <ApprovalCard key={i} data={card.data ?? {}} />;
        if (card.type === 'task_status_card')
          return <TaskStatusCard key={i} data={card.data ?? {}} />;
        if (card.type === 'output_review_card')
          return <OutputReviewCard key={i} data={card.data ?? {}} />;
        if (card.type === 'StatusCard')
          return <StatusCard key={i} />;
        if (card.type === 'executive_critique_card' || card.type === 'ExecutiveReviewCard')
          return <ExecutiveCritiqueCard key={i} data={card.data ?? {}} />;
        if (card.type === 'ActionDraftCard')
          return <InlineApprovalCard key={i} action={card.data ?? {}} />;
        if (card.type === 'ActionApprovedCard')
          return <ActionApprovedCard key={i} />;
        if (card.type === 'ActionExecutedCard')
          return <ActionExecutedCard key={i} data={card.data ?? {}} />;
        if (card.type === 'PendingApprovalsCard')
          return <PendingApprovalsCard key={i} data={card.data ?? {}} />;
        return null;
      })}
    </div>
  );
}

// ─── MessageThread ───────────────────────────────────────────────────────────

function MessageThread({
  messages,
  activeEntity,
}: {
  messages: ChatMessage[];
  activeEntity: 'assistant' | 'executive';
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bottomRef.current && typeof bottomRef.current.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div className="space-y-4">
      {messages.map((msg) => {
        const isUser = msg.sender === 'user';
        return (
          <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                isUser
                  ? 'bg-slate-900 text-white'
                  : activeEntity === 'executive'
                  ? 'border border-indigo-200 bg-indigo-50 text-slate-800'
                  : 'border border-slate-200 bg-white text-slate-800'
              }`}
            >
              {!isUser && (
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {msg.sender}
                </p>
              )}
              <p
                data-testid={
                  msg.text === 'Drafting action.'
                    ? 'action-draft-card'
                    : msg.text === 'Action executed.'
                    ? 'action-executed-card'
                    : undefined
                }
                className="leading-relaxed"
              >
                {msg.text}
              </p>
              {msg.cards && <ResponseCardRenderer cards={msg.cards} />}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── CommandSuggestionBar ────────────────────────────────────────────────────

const ASSISTANT_SUGGESTIONS = [
  "Prepare today's plan",
  'What needs my approval?',
  'What did you complete today?',
  'Ask the executive to challenge this',
];

const EXECUTIVE_SUGGESTIONS = [
  'Challenge this strategy',
  'Find weak assumptions',
  'What evidence is missing?',
  'Is this executive-ready?',
];

function CommandSuggestionBar({
  onSelect,
  activeEntity,
  hasMessages,
}: {
  onSelect: (text: string) => void;
  activeEntity: 'assistant' | 'executive';
  hasMessages: boolean;
}) {
  const suggestions = activeEntity === 'executive' ? EXECUTIVE_SUGGESTIONS : ASSISTANT_SUGGESTIONS;
  return (
    <div data-testid="empty-state-suggestions" className={`space-y-2 px-2 text-center ${hasMessages ? 'py-3 border-t border-slate-100 mt-4' : 'py-6'}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {activeEntity === 'executive' ? 'Ask the Executive Reviewer' : 'Quick Actions'}
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 cursor-pointer"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── MessageComposer ─────────────────────────────────────────────────────────

function MessageComposer({
  onSend,
  loading,
}: {
  onSend: (text: string) => void;
  loading: boolean;
}) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setText('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2 px-4 py-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Type a message…"
        rows={1}
        className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
      <button
        onClick={handleSend}
        disabled={loading || !text.trim()}
        aria-label="Send"
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow transition hover:bg-slate-700 disabled:opacity-40"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M3.105 3.105a.75.75 0 0 1 .897-.12l14 7a.75.75 0 0 1 0 1.03l-14 7a.75.75 0 0 1-1.013-.93L4.747 10 2.99 4.015a.75.75 0 0 1 .115-.91Z" />
        </svg>
      </button>
    </div>
  );
}

// ─── ConversationContextPanel ────────────────────────────────────────────────

function ConversationContextPanel({ session }: { session: SessionData | null }) {
  if (!session) return null;
  return (
    <aside className="flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Context</h3>

      {session.topic && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Topic</p>
          <p className="text-sm font-medium text-slate-800">{session.topic.title}</p>
        </div>
      )}

      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Session</p>
        <p className="text-sm text-slate-600">{session.title || 'Untitled'}</p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Active Entity</p>
        <p className="text-sm font-semibold capitalize text-slate-800">{session.active_entity}</p>
      </div>
    </aside>
  );
}

// ─── ChatShell (main export) ─────────────────────────────────────────────────

export default function ChatShell({ sessionId }: { sessionId: number }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeEntity, setActiveEntity] = useState<'assistant' | 'executive'>('assistant');

  // Load session
  useEffect(() => {
    api.get<SessionData>(`/api/conversations/${sessionId}/`).then(({ data }) => {
      setSession(data);
      setActiveEntity(data.active_entity);
      // Hydrate existing messages
      setMessages(
        data.messages.map((m) => ({
          id: String(m.id),
          sender: m.sender as 'user' | 'assistant' | 'executive',
          text: m.message_text,
        }))
      );
    });
  }, [sessionId]);

  const handleSend = async (text: string) => {
    // Optimistically show user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data } = await api.post<{
        message: string;
        cards: ResponseCard[];
        requires_clarification: boolean;
      }>(`/api/conversations/${sessionId}/messages/`, { text });

      const reply: ChatMessage = {
        id: `resp-${Date.now()}`,
        sender: activeEntity,
        text: data.message,
        cards: data.cards,
      };
      setMessages((prev) => [...prev, reply]);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchEntity = async (entity: 'assistant' | 'executive') => {
    await api.post(`/api/conversations/${sessionId}/switch-entity/`, { entity });
    setActiveEntity(entity);
  };

  const handleVoiceResponse = (data: { message: string; cards: ResponseCard[]; requires_clarification: boolean }) => {
    const reply: ChatMessage = {
      id: `resp-${Date.now()}`,
      sender: activeEntity,
      text: data.message,
      cards: data.cards,
    };
    setMessages((prev) => [...prev, reply]);
  };

  return (
    <div data-testid="chat-shell" className="flex h-full min-h-screen flex-col bg-slate-50 lg:flex-row">
      {/* ── Left: Chat ── */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            {session && (
              <>
                <EntitySwitcher activeEntity={activeEntity} onSwitch={handleSwitchEntity} />
                <span
                  data-testid="active-entity-label"
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-600"
                >
                  {activeEntity}
                </span>
              </>
            )}
          </div>
          {session?.topic && (
            <span className="text-sm text-slate-400">
              Topic: <strong className="text-slate-700">{session.topic.title}</strong>
            </span>
          )}
        </header>

        {/* Message area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length > 0 && <MessageThread messages={messages} activeEntity={activeEntity} />}
          <CommandSuggestionBar onSelect={handleSend} activeEntity={activeEntity} hasMessages={messages.length > 0} />

          {loading && (
            <div
              data-testid="chat-loading-indicator"
              className="mt-4 flex items-center gap-2 text-sm text-slate-400"
            >
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
            </div>
          )}
        </div>

        {/* Composer and Voice Input */}
        <div className="flex flex-col border-t border-slate-200 bg-white">
          <MessageComposer onSend={handleSend} loading={loading} />
          <div className="px-4 pb-4">
            <VoiceInputPanel sessionId={sessionId} onResponse={handleVoiceResponse} />
          </div>
        </div>
      </div>

      {/* ── Right: Context panel ── */}
      <div className="w-full border-t border-slate-200 p-4 lg:w-72 lg:border-l lg:border-t-0 lg:p-5">
        <ConversationContextPanel session={session} />
      </div>
    </div>
  );
}
