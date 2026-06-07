import React, { useState } from 'react';

export const ActionRiskBadge = ({ riskLevel }: { riskLevel: 'low' | 'medium' | 'high' }) => {
  const colors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800 font-bold'
  };
  return (
    <span className={`px-2 py-1 rounded text-xs ${colors[riskLevel]}`}>
      {riskLevel === 'high' ? 'High Risk' : riskLevel === 'medium' ? 'Medium Risk' : 'Low Risk'}
    </span>
  );
};

export const EmailDraftPreview = ({ payload }: { payload: any }) => {
  if (!payload) return null;
  return (
    <div className="border p-4 rounded bg-gray-50 mb-4">
      <div className="mb-2"><strong>To:</strong> {payload.recipients?.join(', ')}</div>
      <div className="mb-2"><strong>Subject:</strong> {payload.subject}</div>
      <hr className="my-2" />
      <div className="whitespace-pre-wrap">{payload.body}</div>
    </div>
  );
};

export const ActionApprovalPanel = ({ status, payload, approvalRequired, onApprove, onReject, onExecute }: { status: string, payload?: any, approvalRequired?: boolean, onApprove: () => void, onReject: (reason: string) => void, onExecute: () => void }) => {
  const [reason, setReason] = useState('');

  const isApproved = status === 'approved';
  const isAwaiting = status === 'awaiting_approval' || (status === 'proposed' && approvalRequired);
  const isDrafted = status === 'drafted' || (status === 'proposed' && !approvalRequired);

  if (!isAwaiting && !isApproved && !isDrafted) return null;

  return (
    <div className="border p-4 rounded bg-white shadow-sm mt-4">
      <h3 className="font-semibold mb-2">Executive Action Control</h3>
      
      {payload?.approval_summary && (
        <div className="bg-amber-50 text-amber-900 p-3 rounded text-sm mb-4 border border-amber-200">
          <span className="font-bold">Warning:</span> {payload.approval_summary}
        </div>
      )}
      
      {isAwaiting && (
        <div className="flex flex-col gap-2 mb-6 pb-6 border-b">
          <h4 className="text-sm font-medium mb-1">Approval Required</h4>
          <div className="flex gap-2">
            <button onClick={onApprove} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700">
              Approve Action
            </button>
            <div className="flex flex-1 gap-2">
              <input 
                type="text" 
                placeholder="Reason for rejection" 
                className="border p-2 rounded text-sm flex-1"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button onClick={() => onReject(reason)} className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700">
                Reject Action
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium mb-2">Execution</h4>
        <button 
          onClick={onExecute} 
          disabled={!isApproved && !isDrafted}
          className={`px-4 py-2 rounded text-sm font-medium text-white w-full ${(!isApproved && !isDrafted) ? 'bg-slate-300 cursor-not-allowed' : 'bg-black hover:bg-slate-800'}`}
        >
          Execute Action
        </button>
        {(!isApproved && !isDrafted) && (
          <p className="text-xs text-slate-500 mt-2 text-center">Action must be approved before execution.</p>
        )}
      </div>
    </div>
  );
};

export const ActionExecutionTimeline = ({ status }: { status: string }) => {
  const steps = ['proposed', 'drafted', 'awaiting_approval', 'approved', 'executed'];
  const currentIndex = steps.indexOf(status) !== -1 ? steps.indexOf(status) : 0;

  return (
    <div className="flex gap-4 items-center text-sm mb-4">
      {steps.map((step, idx) => (
        <div key={step} className="flex items-center gap-2" style={{ opacity: idx <= currentIndex ? '1' : '0.5' }}>
          <div className={`w-3 h-3 rounded-full ${idx <= currentIndex ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
          <span className="capitalize">{step.replace('_', ' ')}</span>
          {idx < steps.length - 1 && <div className="w-8 h-px bg-gray-300"></div>}
        </div>
      ))}
    </div>
  );
};

export const ActionResultPanel = ({ executionResult }: { executionResult: any }) => {
  if (!executionResult) return null;
  return (
    <div className="border p-4 rounded bg-blue-50 mt-4">
      <h3 className="font-semibold mb-2">Execution Result</h3>
      <pre className="text-xs overflow-auto">{JSON.stringify(executionResult, null, 2)}</pre>
    </div>
  );
};

export const ActionAuditPanel = ({ action }: { action: any }) => {
  return (
    <div className="border p-4 rounded bg-gray-50 mt-4 text-xs">
      <h3 className="font-semibold mb-2">Audit Log</h3>
      {action.approved_by_email && <div><strong>Approved By:</strong> {action.approved_by_email}</div>}
      {action.approved_at && <div><strong>Approved At:</strong> {action.approved_at}</div>}
      {action.rejected_reason && <div><strong>Rejected Reason:</strong> {action.rejected_reason}</div>}
    </div>
  );
};
