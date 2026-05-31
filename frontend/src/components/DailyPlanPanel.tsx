import React, { useState } from 'react';

export function RiskSummaryStrip({ summary }: { summary: { low: number, medium: number, high: number } }) {
  return (
    <div className="grid grid-cols-3 gap-3 my-4">
      <div className="rounded-xl border p-3">
        <div className="text-xs text-slate-500">Auto-execute</div>
        <div className="text-2xl font-semibold" data-testid="risk-low-count">{summary.low}</div>
      </div>
      <div className="rounded-xl border p-3">
        <div className="text-xs text-slate-500">Approval needed</div>
        <div className="text-2xl font-semibold" data-testid="risk-medium-count">{summary.medium}</div>
      </div>
      <div className="rounded-xl border p-3">
        <div className="text-xs text-slate-500">Hard stop</div>
        <div className="text-2xl font-semibold" data-testid="risk-high-count">{summary.high}</div>
      </div>
    </div>
  );
}

export function PlanDiffView() {
  return (
    <div className="bg-slate-50 p-4 border rounded-xl" data-testid="plan-diff-view">
      <p className="text-sm font-medium text-slate-700">First plan for this topic</p>
    </div>
  );
}

export default function DailyPlanPanel({ onClose, onStart }: { onClose: () => void, onStart: () => void }) {
  const [status, setStatus] = useState('Draft');

  const summary = { low: 4, medium: 2, high: 1 };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose} data-testid="daily-plan-panel">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-slate-800">Review today's proposed work</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <p className="text-sm text-slate-600 mb-2 font-medium">Status: {status}</p>
        
        <div data-testid="plan-summary" className="text-sm text-slate-700 bg-blue-50 p-3 rounded border border-blue-100">
          This is a micro-dose daily plan. It focuses only on the next immediate execution steps derived from the task ledger.
        </div>

        <RiskSummaryStrip summary={summary} />

        <div className="text-xs text-slate-500 space-y-1 mb-6">
          <p>Low-risk work can run automatically.</p>
          <p>Medium-risk work requires approval before execution.</p>
          <p>High-risk work will stop until explicitly approved.</p>
        </div>

        <h3 className="font-semibold mb-2">What changed</h3>
        <PlanDiffView />

        <div className="mt-8 space-y-3">
          <button 
            onClick={() => setStatus('Approved')}
            className="w-full py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors"
          >
            Approve Plan
          </button>
          
          <button 
            disabled={status !== 'Approved'}
            onClick={onStart}
            className="w-full py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            Start Workflow
          </button>
        </div>
      </div>
    </div>
  );
}
