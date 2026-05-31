import React, { useState, useEffect } from 'react';

export function WorkflowStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    paused: 'bg-amber-100 text-amber-800',
    running: 'bg-blue-100 text-blue-800',
    pending: 'bg-slate-100 text-slate-800'
  };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || colors.pending}`}>
      {status}
    </span>
  );
}

export function WorkflowTimeline({ nodes, current }: { nodes: any[], current: string }) {
  return (
    <div data-testid="workflow-timeline" className="border-l-2 border-slate-200 ml-4 pl-4 py-2 space-y-4">
      {nodes.map(node => (
        <div key={node.id} data-testid={`node-${node.id}`} data-status={node.status} data-current={current === node.id ? 'true' : 'false'} className={`relative ${current === node.id ? 'ring-2 ring-blue-500 rounded p-2 bg-blue-50' : 'p-2'}`}>
          <div className="absolute -left-[21px] top-3 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white"></div>
          <div className="flex items-center space-x-3">
            <span className="font-mono text-sm font-semibold text-slate-700">{node.id}</span>
            <WorkflowStatusBadge status={node.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PausedApprovalCard({ onApprove }: { onApprove: () => void }) {
  return (
    <div data-testid="paused-approval-card" className="bg-amber-50 p-4 border border-amber-200 rounded-xl mt-6">
      <h4 className="font-semibold text-amber-900 mb-2">Requires Approval</h4>
      <p className="text-sm text-amber-800 mb-4">Task requires approval to proceed due to risk constraints.</p>
      <button onClick={onApprove} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
        Approve Task
      </button>
    </div>
  );
}

export function WorkflowTelemetryPanel({ stats }: { stats: any }) {
  return (
    <div data-testid="telemetry-panel" className="bg-slate-50 p-5 rounded-xl border grid grid-cols-2 gap-4 mt-2 text-sm shadow-sm">
      <div>
        <span className="text-slate-500 block mb-1">Loop Count</span>
        <span className="font-semibold text-slate-800 text-lg">{stats.loopCount}</span>
      </div>
      <div>
        <span className="text-slate-500 block mb-1">Execution Time</span>
        <span className="font-semibold text-slate-800 text-lg">{stats.executionTime}ms</span>
      </div>
      <div>
        <span className="text-slate-500 block mb-1">Token Count</span>
        <span className="font-semibold text-slate-800 text-lg">{stats.tokenCount}</span>
      </div>
      <div>
        <span className="text-slate-500 block mb-1">API Cost</span>
        <span className="font-semibold text-slate-800 text-lg">${stats.apiCost}</span>
      </div>
    </div>
  );
}

export function ExecutionControlPanel({ onStart, onResume, isPaused, hasStarted }: { onStart: () => void, onResume: () => void, isPaused: boolean, hasStarted: boolean }) {
  return (
    <div className="mt-8 flex space-x-4 border-t pt-6">
      {!hasStarted && (
        <button onClick={onStart} className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors shadow-sm">
          Start Workflow
        </button>
      )}
      {hasStarted && isPaused && (
        <button onClick={onResume} className="bg-green-600 text-white px-6 py-2 rounded-md font-medium hover:bg-green-700 transition-colors shadow-sm">
          Resume Workflow
        </button>
      )}
    </div>
  );
}

export default function WorkflowExecutionPanel({ onClose, autoStart = false }: { onClose?: () => void, autoStart?: boolean }) {
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [taskApproved, setTaskApproved] = useState(false);
  const [stats, setStats] = useState({ loopCount: 0, executionTime: 0, tokenCount: 0, apiCost: 0 });
  
  const [nodes, setNodes] = useState([
    { id: 'load_plan', status: 'pending' },
    { id: 'risk_router', status: 'pending' },
    { id: 'execute_low_risk_task', status: 'pending' },
    { id: 'pause_for_task_approval', status: 'pending' },
  ]);
  
  const [currentNode, setCurrentNode] = useState('');

  const fetchWorkflowStatus = async () => {
    try {
      const res = await fetch('/api/workflows/1/');
      if (res.ok) {
        const data = await res.json();
        setIsPaused(data.status === 'paused');
        setCurrentNode(data.current_node || 'pause_for_task_approval');
        setStats({ loopCount: 1, executionTime: 120, tokenCount: 0, apiCost: 0 });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStart = async () => {
    setHasStarted(true);
    setCurrentNode('load_plan');
    try {
      const res = await fetch('/api/workflows/1/start/', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setNodes([
          { id: 'load_plan', status: 'completed' },
          { id: 'risk_router', status: 'completed' },
          { id: 'execute_low_risk_task', status: 'completed' },
          { id: 'pause_for_task_approval', status: data.status === 'paused' ? 'paused' : 'pending' },
        ]);
        setCurrentNode('pause_for_task_approval');
        setIsPaused(data.status === 'paused');
        setStats({ loopCount: 1, executionTime: 120, tokenCount: 0, apiCost: 0 });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (autoStart && !hasStarted) {
      handleStart();
    }
  }, [autoStart, hasStarted]);

  const handleResume = async () => {
    if (!taskApproved) return;
    try {
      const res = await fetch('/api/workflows/1/resume/', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setIsPaused(data.status === 'paused');
        setNodes(prev => [
          ...prev.map(n => n.id === 'pause_for_task_approval' ? { ...n, status: 'completed' } : n),
          { id: 'execute_approved_task', status: 'completed' }
        ]);
        setCurrentNode('execute_approved_task');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-8 bg-white rounded-2xl border shadow-sm max-w-5xl mx-auto my-8 font-sans">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-slate-800">Execution Engine</h2>
        {onClose && (
          <button onClick={onClose} aria-label="Close Workflow" className="text-slate-400 hover:text-slate-600 font-medium text-sm">
            Close Workflow
          </button>
        )}
      </div>
      <p className="text-slate-500 mb-8 pb-6 border-b">Real-time workflow execution.</p>
      
      {!hasStarted ? (
        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100">
          <p className="font-medium">Workflow is ready to start.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <h3 className="font-semibold text-lg text-slate-800 mb-6">Execution Trace</h3>
            <WorkflowTimeline nodes={nodes} current={currentNode} />
            
            {isPaused && currentNode === 'pause_for_task_approval' && !taskApproved && (
              <PausedApprovalCard onApprove={() => setTaskApproved(true)} />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-slate-800 mb-4">Telemetry</h3>
            <WorkflowTelemetryPanel stats={stats} />
          </div>
        </div>
      )}

      <ExecutionControlPanel 
        onStart={handleStart} 
        onResume={handleResume} 
        isPaused={isPaused} 
        hasStarted={hasStarted} 
      />
    </div>
  );
}
