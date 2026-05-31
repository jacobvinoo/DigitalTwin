import { useState } from 'react';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VoiceResponse {
  message: string;
  cards: Array<{ type: string; data?: Record<string, unknown> }>;
  requires_clarification: boolean;
  error?: string;
}

interface Props {
  sessionId: number;
  onResponse: (response: VoiceResponse) => void;
}

type PanelState = 'idle' | 'recording' | 'confirmed';

const LOW_CONFIDENCE_UI_THRESHOLD = 0.75;

// ─── TranscriptPreview ────────────────────────────────────────────────────────

function TranscriptPreview({ text, confidence }: { text: string; confidence: number }) {
  const isLow = confidence < LOW_CONFIDENCE_UI_THRESHOLD;
  return (
    <div
      data-testid="transcript-preview"
      className={`rounded-xl border p-3 text-sm ${
        isLow
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-slate-200 bg-slate-50 text-slate-800'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
        Transcript
      </p>
      <p className="leading-relaxed">{text}</p>
      <p className="mt-1 text-[10px] text-slate-400">
        Confidence: {Math.round(confidence * 100)}%
        {isLow && (
          <span className="ml-2 font-semibold text-amber-600">
            — low confidence, please review
          </span>
        )}
      </p>
    </div>
  );
}

// ─── VoiceConfirmationBar ─────────────────────────────────────────────────────

function VoiceConfirmationBar({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onConfirm}
        disabled={loading}
        aria-label="Confirm"
        className="flex-1 rounded-xl bg-slate-900 py-2 text-sm font-medium text-white shadow transition hover:bg-slate-700 disabled:opacity-40"
      >
        {loading ? 'Sending…' : 'Confirm'}
      </button>
      <button
        onClick={onCancel}
        disabled={loading}
        className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
      >
        Cancel
      </button>
    </div>
  );
}

// ─── VoiceInputPanel (main export) ───────────────────────────────────────────

export default function VoiceInputPanel({ sessionId, onResponse }: Props) {
  const [panelState, setPanelState] = useState<PanelState>('idle');
  const [transcriptText, setTranscriptText] = useState('');
  const [confidence, setConfidence] = useState(0.95);
  const [loading, setLoading] = useState(false);
  const [lowConfidenceWarning, setLowConfidenceWarning] = useState(false);

  const handleStart = () => {
    setTranscriptText('');
    setConfidence(0.95);
    setLowConfidenceWarning(false);
    setPanelState('recording');
  };

  const handleCancel = () => {
    setPanelState('idle');
    setTranscriptText('');
    setLowConfidenceWarning(false);
  };

  const handleConfirm = async () => {
    if (!transcriptText.trim()) return;
    setLoading(true);
    setLowConfidenceWarning(false);

    try {
      const { data } = await api.post<VoiceResponse>(
        `/api/conversations/${sessionId}/voice-transcript/`,
        {
          transcript_text: transcriptText.trim(),
          confidence,
        }
      );

      if (data.requires_clarification) {
        setLowConfidenceWarning(true);
      }

      onResponse(data);

      // Reset only on success / non-clarification
      if (!data.requires_clarification) {
        setPanelState('idle');
        setTranscriptText('');
      }
    } finally {
      setLoading(false);
      // Always reset to idle after API call so start button is available again
      setPanelState('idle');
    }
  };

  // ── Idle state ──────────────────────────────────────────────────────────────
  if (panelState === 'idle') {
    return (
      <div data-testid="voice-input-panel" className="flex flex-col gap-2">
        {lowConfidenceWarning && (
          <div
            data-testid="low-confidence-warning"
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            ⚠ Low confidence transcript — please review and try again.
          </div>
        )}
        <button
          onClick={handleStart}
          aria-label="Start voice note"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 text-slate-400"
          >
            <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
            <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.546A6.001 6.001 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" />
          </svg>
          Start voice note
        </button>
      </div>
    );
  }

  // ── Recording / transcript entry state ──────────────────────────────────────
  return (
    <div data-testid="voice-input-panel" className="flex flex-col gap-3">
      {/* Recording indicator */}
      <div
        data-testid="voice-recording-state"
        className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <p className="text-sm font-medium text-red-700">
          Recording — type your voice note below
        </p>
      </div>

      {/* Transcript textarea */}
      <textarea
        value={transcriptText}
        onChange={(e) => setTranscriptText(e.target.value)}
        placeholder="Enter transcript text…"
        rows={3}
        className="resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
      />

      {/* Hidden confidence input for test control */}
      <input
        data-testid="confidence-input"
        type="number"
        min={0}
        max={1}
        step={0.01}
        value={confidence}
        onChange={(e) => setConfidence(parseFloat(e.target.value))}
        className="hidden"
        aria-hidden="true"
      />

      {/* Transcript preview */}
      {transcriptText.trim() && (
        <TranscriptPreview text={transcriptText.trim()} confidence={confidence} />
      )}

      {/* Confirmation bar */}
      <VoiceConfirmationBar
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        loading={loading}
      />
    </div>
  );
}
