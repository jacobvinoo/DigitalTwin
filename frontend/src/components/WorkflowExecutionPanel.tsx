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

export function PausedApprovalCard({ onApprove, disabled }: { onApprove: () => void, disabled?: boolean }) {
  return (
    <div data-testid="paused-approval-card" className="bg-amber-50 p-4 border border-amber-200 rounded-xl mt-6">
      <h4 className="font-semibold text-amber-900 mb-2">Requires Approval</h4>
      <p className="text-sm text-amber-800 mb-4">Task requires approval to proceed due to risk constraints.</p>
      <button 
        disabled={disabled}
        onClick={onApprove} 
        className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
      >
        {disabled ? 'Approving...' : 'Approve Task'}
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

export function WorkflowTaskDetailsCard({ task }: { task: any }) {
  if (!task) return null;

  const hasDoc = task.outputs?.generated_document_name;

  return (
    <div data-testid="workflow-task-card" className="bg-white border rounded-xl p-5 mt-6 shadow-sm space-y-4">
      <div className="border-b pb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current / Active Task</span>
        <h4 className="font-semibold text-slate-800 text-base mt-0.5">{task.title}</h4>
        <div className="flex gap-2 mt-2">
          <span className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-600 font-mono capitalize">{task.task_type}</span>
          <span className={`px-2 py-0.5 text-xs rounded font-medium ${
            task.status === 'completed' ? 'bg-green-50 text-green-700 border border-green-200' :
            task.status === 'blocked' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
            task.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse' :
            'bg-slate-50 text-slate-700 border border-slate-200'
          }`}>{task.status}</span>
        </div>
      </div>

      {task.status === 'completed' && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg">
            ✓ Task executed successfully!
          </div>
          
          {hasDoc && (
            <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg flex justify-between items-center text-xs">
              <div className="min-w-0 flex-1 mr-2">
                <span className="font-semibold text-indigo-900 block">Generated Document:</span>
                <span className="text-indigo-700 font-mono text-[10px] block truncate">{task.outputs.generated_document_name}</span>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(task.outputs.generated_document_path)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-2 py-1 rounded transition text-center shadow-xs whitespace-nowrap cursor-pointer"
                title="Copy file path to clipboard"
              >
                Copy Path
              </button>
            </div>
          )}

          {task.outputs?.agent_output?.product_recommendation && (
            <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded border">
              <span className="font-bold text-slate-800 block mb-1">Recommendation Preview:</span>
              <p className="line-clamp-3 italic">"{task.outputs.agent_output.product_recommendation}"</p>
            </div>
          )}

          {task.outputs?.agent_output?.recommended_position && (
            <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded border">
              <span className="font-bold text-slate-800 block mb-1">Position Preview:</span>
              <p className="line-clamp-3 italic">"{task.outputs.agent_output.recommended_position}"</p>
            </div>
          )}
        </div>
      )}

      {task.status === 'blocked' && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
            ⚠️ Revision required by Executive Reviewer
          </div>
          {task.outputs?.executive_review?.required_revisions && (
            <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded border space-y-1">
              <span className="font-bold text-slate-800 block">Requested Revisions:</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                {task.outputs.executive_review.required_revisions.map((rev: string, i: number) => (
                  <li key={i}>{rev}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {task.status !== 'completed' && task.status !== 'blocked' && (
        <p className="text-xs text-slate-400 italic">No output generated yet. The agent is analyzing objectives and building context.</p>
      )}
    </div>
  );
}

export function WorkflowTasksList({ 
  tasks, 
  selectedTaskId, 
  onSelectTask 
}: { 
  tasks: any[], 
  selectedTaskId: number | null, 
  onSelectTask: (taskId: number) => void 
}) {
  if (!tasks || tasks.length === 0) return null;

  return (
    <div data-testid="workflow-tasks-list" className="bg-slate-50 p-5 rounded-xl border border-slate-200 mt-6 shadow-sm">
      <h4 className="font-semibold text-slate-800 text-sm mb-3">Tasks in this Run</h4>
      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
        {tasks.map(task => {
          const isSelected = selectedTaskId === task.id;
          const statusColors: Record<string, string> = {
            completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            blocked: 'bg-amber-50 text-amber-700 border-amber-200',
            in_progress: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse',
            failed: 'bg-rose-50 text-rose-700 border-rose-200',
            proposed: 'bg-slate-50 text-slate-600 border-slate-200',
          };
          const badgeClass = statusColors[task.status] || 'bg-slate-50 text-slate-600 border-slate-200';

          return (
            <button
              key={task.id}
              onClick={() => onSelectTask(task.id)}
              className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex justify-between items-center ${
                isSelected 
                  ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100/50 shadow-xs' 
                  : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="min-w-0 flex-1 mr-3">
                <span className="font-medium text-slate-800 block truncate">{task.title}</span>
                <div className="flex items-center space-x-1.5 mt-1 text-[10px] text-slate-400">
                  <span className="capitalize">{task.task_type.replace('_', ' ')}</span>
                  <span>•</span>
                  <span className="capitalize">{task.risk_level} risk</span>
                </div>
              </div>
              <span className={`px-2 py-0.5 text-[10px] rounded border font-medium whitespace-nowrap ${badgeClass}`}>
                {task.status === 'blocked' ? 'Revision Required' : task.status.replace('_', ' ')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ExecutionControlPanel({ 
  onStart, 
  onResume, 
  isPaused, 
  hasStarted,
  isResuming
}: { 
  onStart: () => void, 
  onResume: () => void, 
  isPaused: boolean, 
  hasStarted: boolean,
  isResuming?: boolean
}) {
  return (
    <div className="mt-8 flex space-x-4 border-t pt-6">
      {!hasStarted && (
        <button onClick={onStart} className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors shadow-sm">
          Start Workflow
        </button>
      )}
      {hasStarted && isPaused && (
        <button 
          disabled={isResuming}
          onClick={onResume} 
          className="bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md font-medium transition-colors shadow-sm"
        >
          {isResuming ? 'Resuming...' : 'Resume Workflow'}
        </button>
      )}
    </div>
  );
}

export default function WorkflowExecutionPanel({ workflowRunId = 1, onClose, autoStart = false }: { workflowRunId?: number | null, onClose?: () => void, autoStart?: boolean }) {
  const runId = workflowRunId || 1;
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [taskApproved, setTaskApproved] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null);
  const [stats, setStats] = useState({ loopCount: 0, executionTime: 0, tokenCount: 0, apiCost: 0 });
  
  const [nodes, setNodes] = useState([
    { id: 'load_plan', status: 'pending' },
    { id: 'risk_router', status: 'pending' },
    { id: 'execute_low_risk_task', status: 'pending' },
    { id: 'pause_for_task_approval', status: 'pending' },
  ]);
  
  const [currentNode, setCurrentNode] = useState('');
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isApprovingTask, setIsApprovingTask] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  const fetchWorkflowStatus = async () => {
    try {
      const res = await fetch(`/api/workflows/${runId}/`);
      if (res.ok) {
        const data = await res.json();
        setIsPaused(data.status === 'paused');
        setCurrentNode(data.current_node || 'pause_for_task_approval');
        setCurrentTaskId(data.current_task_id);
        setTasks(data.tasks || []);
        setStats({ loopCount: 1, executionTime: 120, tokenCount: 0, apiCost: 0 });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchWorkflowStatus();
  }, [runId]);

  // Handle auto-start behavior
  useEffect(() => {
    if (autoStart && !hasStarted) {
      handleStart();
    }
  }, [autoStart, hasStarted]);

  // Sync selectedTaskId when currentTaskId or tasks list changes
  useEffect(() => {
    if (currentTaskId) {
      setSelectedTaskId(currentTaskId);
    } else if (tasks && tasks.length > 0) {
      const candidate = tasks.find(t => ['completed', 'blocked', 'failed', 'in_progress'].includes(t.status)) || tasks[0];
      setSelectedTaskId(candidate.id);
    } else {
      setSelectedTaskId(null);
    }
  }, [currentTaskId, tasks]);

  // Fetch detailed info of the selected task
  useEffect(() => {
    if (selectedTaskId) {
      fetch(`/api/tasks/${selectedTaskId}/`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error("Failed to fetch task");
        })
        .then(data => setSelectedTask(data))
        .catch(err => console.error(err));
    } else {
      setSelectedTask(null);
    }
  }, [selectedTaskId]);

  const handleStart = async () => {
    setHasStarted(true);
    setCurrentNode('load_plan');
    try {
      const res = await fetch(`/api/workflows/${runId}/start/`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setIsPaused(data.status === 'paused');
        setCurrentTaskId(data.current_task_id);
        setTasks(data.tasks || []);
        setStats({ loopCount: 1, executionTime: 120, tokenCount: 0, apiCost: 0 });
        
        if (data.status === 'paused') {
          setNodes([
            { id: 'load_plan', status: 'completed' },
            { id: 'risk_router', status: 'completed' },
            { id: 'execute_low_risk_task', status: 'completed' },
            { id: 'pause_for_task_approval', status: 'paused' },
          ]);
          setCurrentNode('pause_for_task_approval');
        } else {
          setNodes([
            { id: 'load_plan', status: 'completed' },
            { id: 'risk_router', status: 'completed' },
            { id: 'execute_low_risk_task', status: 'completed' },
            { id: 'pause_for_task_approval', status: 'completed' },
            { id: 'execute_approved_task', status: 'completed' },
          ]);
          setCurrentNode('execute_approved_task');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveTask = async () => {
    if (isApprovingTask) return;
    setIsApprovingTask(true);
    const taskId = currentTaskId || 1;
    try {
      const res = await fetch(`/api/tasks/${taskId}/approve/`, { method: 'POST' });
      if (res.ok) {
        setTaskApproved(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsApprovingTask(false);
    }
  };

  const handleResume = async () => {
    if (!taskApproved || isResuming) return;
    setIsResuming(true);
    try {
      const res = await fetch(`/api/workflows/${runId}/resume/`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setIsPaused(data.status === 'paused');
        setCurrentTaskId(data.current_task_id);
        setTasks(data.tasks || []);
        
        if (data.status === 'paused') {
          setTaskApproved(false);
          setCurrentNode('pause_for_task_approval');
          setNodes([
            { id: 'load_plan', status: 'completed' },
            { id: 'risk_router', status: 'completed' },
            { id: 'execute_low_risk_task', status: 'completed' },
            { id: 'pause_for_task_approval', status: 'paused' },
          ]);
        } else {
          setNodes(prev => [
            ...prev.map(n => n.id === 'pause_for_task_approval' ? { ...n, status: 'completed' } : n),
            { id: 'execute_approved_task', status: 'completed' }
          ]);
          setCurrentNode('execute_approved_task');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsResuming(false);
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
              <PausedApprovalCard onApprove={handleApproveTask} disabled={isApprovingTask} />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-slate-800 mb-4">Telemetry</h3>
            <WorkflowTelemetryPanel stats={stats} />
            <WorkflowTasksList 
              tasks={tasks} 
              selectedTaskId={selectedTaskId} 
              onSelectTask={setSelectedTaskId} 
            />
            <WorkflowTaskDetailsCard task={selectedTask} />
          </div>
        </div>
      )}

      <ExecutionControlPanel 
        onStart={handleStart} 
        onResume={handleResume} 
        isPaused={isPaused} 
        hasStarted={hasStarted} 
        isResuming={isResuming}
      />
    </div>
  );
}
