import { useState } from 'react';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailOutput {
  subject?: string;
  recipients?: string[];
  body?: string;
}

interface Action {
  id: number;
  title: string;
  action_type: string;
  risk_level: 'low' | 'medium' | 'high';
  status: string;
  approval_reason?: string;
  generated_output?: Record<string, unknown>;
}

interface Props {
  action: Action;
  onStatusChange?: (updated: Action) => void;
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    high:   'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low:    'bg-green-100 text-green-700 border-green-200',
  };
  return (
    <span
      data-testid="risk-badge"
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[level] ?? styles.medium}`}
    >
      {level} risk
    </span>
  );
}

// ─── Email-specific details ───────────────────────────────────────────────────

function EmailDetails({ output }: { output: EmailOutput }) {
  const recipients = output.recipients ?? [];
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">To</p>
        <p data-testid="email-recipients" className="text-slate-700">
          {recipients.join(', ')}
        </p>
      </div>
      {output.subject && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Subject</p>
          <p data-testid="email-subject" className="text-slate-700">{output.subject}</p>
        </div>
      )}
      {output.body && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Body preview</p>
          <p className="line-clamp-3 text-slate-600">{output.body}</p>
        </div>
      )}
      <p
        data-testid="action-consequence"
        className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800"
      >
        ⚠ This email will be sent to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} upon execution.
      </p>
    </div>
  );
}

// ─── Reject flow ──────────────────────────────────────────────────────────────

function RejectPanel({
  onSubmit,
  onCancel,
  loading,
}: {
  onSubmit: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const handleSubmit = () => {
    setTouched(true);
    if (!reason.trim()) return;
    onSubmit(reason.trim());
  };

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for rejection…"
        rows={2}
        className={`w-full resize-none rounded-lg border px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 ${
          touched && !reason.trim() ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'
        }`}
      />
      {touched && !reason.trim() && (
        <p className="text-xs text-red-500">A reason is required to reject.</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading}
          aria-label="Confirm reject"
          className="flex-1 rounded-lg bg-red-600 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
        >
          {loading ? 'Rejecting…' : 'Confirm reject'}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          Back
        </button>
      </div>
    </div>
  );
}

// ─── ApprovalCardInline (main export) ────────────────────────────────────────

export default function ApprovalCardInline({ action: initialAction, onStatusChange }: Props) {
  const [action, setAction] = useState(initialAction);
  const [showReject, setShowReject] = useState(false);
  const [loading, setLoading] = useState(false);

  const isResolved = action.status === 'approved' || action.status === 'rejected';
  const isEmailDraft = action.action_type === 'email_draft' || action.action_type === 'email_send';
  const emailOutput = (action.generated_output ?? {}) as EmailOutput;

  const handleApprove = async () => {
    setLoading(true);
    try {
      const { data } = await api.patch<Action>(`/api/actions/${action.id}/approve/`, {});
      setAction(data);
      onStatusChange?.(data);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (reason: string) => {
    setLoading(true);
    try {
      const { data } = await api.patch<Action>(`/api/actions/${action.id}/reject/`, { reason });
      setAction(data);
      onStatusChange?.(data);
      setShowReject(false);
    } finally {
      setLoading(false);
    }
  };

  const borderColor =
    action.risk_level === 'high'
      ? 'border-red-200'
      : action.risk_level === 'medium'
      ? 'border-amber-200'
      : 'border-slate-200';

  return (
    <div className={`rounded-2xl border ${borderColor} bg-white p-4 shadow-sm`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">{action.title}</p>
          {action.approval_reason && (
            <p className="mt-0.5 text-xs text-slate-500">{action.approval_reason}</p>
          )}
        </div>
        <RiskBadge level={action.risk_level} />
      </div>

      {/* High-risk warning */}
      {action.risk_level === 'high' && (
        <div
          data-testid="high-risk-warning"
          className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd"/>
          </svg>
          High-risk action — review carefully before approving.
        </div>
      )}

      {/* Email-specific details */}
      {isEmailDraft && (emailOutput.recipients || emailOutput.subject) && (
        <EmailDetails output={emailOutput} />
      )}

      {/* Status or action buttons */}
      {isResolved ? (
        <div
          data-testid="approval-status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium capitalize ${
            action.status === 'approved'
              ? 'bg-green-50 text-green-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {action.status}
        </div>
      ) : showReject ? (
        <RejectPanel
          onSubmit={handleReject}
          onCancel={() => setShowReject(false)}
          loading={loading}
        />
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleApprove}
            disabled={loading}
            aria-label="Approve"
            className="flex-1 rounded-xl bg-slate-900 py-2 text-sm font-medium text-white shadow transition hover:bg-slate-700 disabled:opacity-40"
          >
            {loading ? 'Approving…' : `Approve ${action.action_type === 'email_draft' ? 'email draft' : action.action_type === 'email_send' ? 'and send email' : 'action'}`}
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={loading}
            aria-label="Reject"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
