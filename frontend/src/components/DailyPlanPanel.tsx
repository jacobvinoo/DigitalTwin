import React, { useState, useEffect } from 'react';

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

export function PlanDiffView({ diff, planItems }: { diff?: any, planItems?: any[] }) {
  if (!diff || diff.first_plan) {
    return (
      <div className="bg-slate-50 p-4 border rounded-xl" data-testid="plan-diff-view">
        <p className="text-sm font-medium text-slate-700">First plan for this topic</p>
      </div>
    );
  }

  const getTaskTitle = (id: string) => {
    const item = planItems?.find(i => String(i.task_id) === id || String(i.id) === id);
    return item ? item.title : `Task #${id}`;
  };

  return (
    <div className="bg-slate-50 p-4 border rounded-xl space-y-3" data-testid="plan-diff-view">
      {diff.added && diff.added.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">Added ({diff.added.length})</h5>
          <ul className="text-xs text-slate-600 space-y-1 pl-3 list-disc">
            {diff.added.map((id: string) => (
              <li key={id}>{getTaskTitle(id)}</li>
            ))}
          </ul>
        </div>
      )}
      {diff.removed && diff.removed.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-rose-700 uppercase tracking-wider mb-1">Removed ({diff.removed.length})</h5>
          <ul className="text-xs text-slate-600 space-y-1 pl-3 list-disc">
            {diff.removed.map((id: string) => (
              <li key={id}>Task #{id}</li>
            ))}
          </ul>
        </div>
      )}
      {diff.added?.length === 0 && diff.removed?.length === 0 && (
        <p className="text-xs text-slate-500 italic">No tasks added or removed since yesterday</p>
      )}
    </div>
  );
}

export default function DailyPlanPanel({ topicId, onClose, onStart }: { topicId: string, onClose: () => void, onStart: (workflowRunId: number) => void }) {
  const [status, setStatus] = useState('Draft');
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    fetch(`/api/topics/${topicId}/daily-plan/`, { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to create daily plan');
        return res.json();
      })
      .then(data => {
        setPlan(data);
        setStatus(data.status || 'Proposed');
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [topicId]);

  const handleApprove = () => {
    if (!plan || approving || status.toLowerCase() === 'approved') return;
    setApproving(true);
    fetch(`/api/daily-plans/${plan.id}/approve/`, { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to approve daily plan');
        return res.json();
      })
      .then(() => {
        setStatus('Approved');
        if (plan) {
          setPlan({ ...plan, status: 'approved' });
        }
      })
      .catch(console.error)
      .finally(() => {
        setApproving(false);
      });
  };

  const getRiskSummary = () => {
    if (!plan || !plan.plan_items) return { low: 0, medium: 0, high: 0 };
    const items = plan.plan_items;
    return {
      low: items.filter((i: any) => i.risk_level === 'low').length,
      medium: items.filter((i: any) => i.risk_level === 'medium').length,
      high: items.filter((i: any) => i.risk_level === 'high').length,
    };
  };

  const summary = getRiskSummary();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose} data-testid="daily-plan-panel">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-slate-800">Review today's proposed work</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading plan...</div>
        ) : (
          <>
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

            {plan && plan.plan_items && (
              <div className="mb-6 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Auto-execute (Low risk)</h4>
                  <div className="space-y-1.5">
                    {plan.plan_items.filter((i: any) => i.risk_level === 'low').length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-2 rounded border border-dashed">No auto-execute tasks proposed</p>
                    ) : (
                      plan.plan_items.filter((i: any) => i.risk_level === 'low').map((item: any) => (
                        <div key={item.task_id} className="text-sm border bg-white rounded-lg p-2.5 shadow-xs flex justify-between items-center">
                          <span className="text-slate-700 font-medium">{item.title}</span>
                          {item.workstream && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{item.workstream}</span>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Approval needed (Medium risk)</h4>
                  <div className="space-y-1.5">
                    {plan.plan_items.filter((i: any) => i.risk_level === 'medium').length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-2 rounded border border-dashed">No approval needed tasks proposed</p>
                    ) : (
                      plan.plan_items.filter((i: any) => i.risk_level === 'medium').map((item: any) => (
                        <div key={item.task_id} className="text-sm border border-amber-100 bg-amber-50/30 rounded-lg p-2.5 shadow-xs flex justify-between items-center">
                          <span className="text-slate-700 font-medium">{item.title}</span>
                          {item.workstream && <span className="text-[10px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">{item.workstream}</span>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Hard stop (High risk)</h4>
                  <div className="space-y-1.5">
                    {plan.plan_items.filter((i: any) => i.risk_level === 'high').length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-2 rounded border border-dashed">No hard stop tasks proposed</p>
                    ) : (
                      plan.plan_items.filter((i: any) => i.risk_level === 'high').map((item: any) => (
                        <div key={item.task_id} className="text-sm border border-rose-100 bg-rose-50/30 rounded-lg p-2.5 shadow-xs flex justify-between items-center animate-pulse">
                          <span className="text-slate-700 font-medium">{item.title}</span>
                          {item.workstream && <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">{item.workstream}</span>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <h3 className="font-semibold mb-2">What changed</h3>
            <PlanDiffView diff={plan?.diff_from_previous} planItems={plan?.plan_items} />

            <div className="mt-8 space-y-3">
              <button 
                disabled={status.toLowerCase() === 'approved' || approving}
                onClick={handleApprove}
                className="w-full py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                {approving ? 'Approving...' : status.toLowerCase() === 'approved' ? 'Plan Approved' : 'Approve Plan'}
              </button>
              
              <button 
                disabled={status.toLowerCase() !== 'approved'}
                onClick={() => plan && onStart(plan.workflow_run_id)}
                className="w-full py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                Start Workflow
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
