import React from 'react';
import { ActionRiskBadge } from './ActionComponents';

export const ActionInbox = ({ actions, onSelectAction }: { actions: any[], onSelectAction: (action: any) => void }) => {
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
              <h3 className="font-semibold">{action.title}</h3>
              <p className="text-sm text-slate-500">{action.action_type}</p>
            </div>
            <ActionRiskBadge riskLevel={action.risk_level || 'low'} />
          </div>

          <div className="mt-3 text-sm">
            Status: <span className="font-medium capitalize">{action.status.replace('_', ' ')}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
