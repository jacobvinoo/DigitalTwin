import React from 'react';
import { ActionRiskBadge } from './ActionComponents';

export const ActionInbox = ({ 
  actions, 
  onSelectAction, 
  onDeleteAction 
}: { 
  actions: any[], 
  onSelectAction: (action: any) => void, 
  onDeleteAction?: (actionId: number) => void 
}) => {
  if (!actions || actions.length === 0) {
    return <div className="text-gray-500 p-4 text-center border rounded-2xl bg-white">No actions found.</div>;
  }

  return (
    <div className="space-y-4">
      {actions.map(action => (
        <div 
          key={action.id} 
          className="rounded-2xl border bg-white p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onSelectAction(action)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold">{action.title}</h3>
                <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-50 text-emerald-700 rounded border border-emerald-200 uppercase tracking-wider shrink-0">
                  Execution
                </span>
              </div>
              <p className="text-sm text-slate-500 capitalize mt-0.5">{action.action_type?.replace('_', ' ') || ''}</p>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <ActionRiskBadge riskLevel={action.risk_level || 'low'} />
              {onDeleteAction && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteAction(action.id);
                  }}
                  className="text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  title="Delete Action"
                  data-testid={`delete-action-btn-${action.id}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 text-sm">
            Status: <span className="font-medium capitalize">{action.status.replace('_', ' ')}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
