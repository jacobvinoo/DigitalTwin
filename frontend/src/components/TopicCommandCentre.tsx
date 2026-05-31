import { useState, useEffect } from 'react';
import DailyPlanPanel from './DailyPlanPanel';
import WorkflowExecutionPanel from './WorkflowExecutionPanel';
import { AgentOutputPanel, ExecutiveReviewPanel, EvaluationScorePanel, AgentTelemetryPanel } from './AgentOutputs';
import { ActionInbox } from './ActionInbox';
import { ActionCreateDrawer } from './ActionCreateDrawer';
import { EmailDraftPreview, ActionApprovalPanel, ActionExecutionTimeline, ActionResultPanel, ActionAuditPanel, ActionRiskBadge } from './ActionComponents';
import ChatShell from './ChatShell';

export default function TopicCommandCentre({ topicId }: { topicId: string }) {
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbacks, setFeedbacks] = useState<{taskId: number, text: string}[]>([]);
  const [qualityScoreInput, setQualityScoreInput] = useState("");
  const [avgQualityScore, setAvgQualityScore] = useState<string | number>("Not scored");
  const [showDailyPlan, setShowDailyPlan] = useState(false);
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);

  const [activeTab, setActiveTab] = useState<'tasks' | 'actions' | 'conversation'>('tasks');
  const [actions, setActions] = useState<any[]>([]);
  const [showActionDrawer, setShowActionDrawer] = useState(false);
  const [selectedAction, setSelectedAction] = useState<any>(null);

  const [topic, setTopic] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [workstreams, setWorkstreams] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch('/api/actions/')
      .then(res => res.json())
      .then(data => setActions(data))
      .catch(console.error);

    fetch(`/api/topics/${topicId}/command-centre/`)
      .then(res => res.json())
      .then(data => {
        setPendingCount(data.pending_approval_count || 0);
        setAvgQualityScore(data.average_quality_score || "Not scored");
        // Simulated workstreams for now since backend doesn't aggregate them yet
        setWorkstreams([
          { title: "Competitive Analysis", count: 2 },
          { title: "Market Metrics", count: 1 },
          { title: "Algolia Implementation Plan", count: 1 },
          { title: "Risk Analysis", count: 1 },
          { title: "Product Strategy", count: 1 },
          { title: "Roadmap", count: 1 },
          { title: "Execution Tracking", count: 1 }
        ]);
      })
      .catch(console.error);

    fetch(`/api/topics/${topicId}/`)
      .then(res => res.json())
      .then(data => setTopic(data))
      .catch(console.error);

    fetch(`/api/tasks/?topic=${topicId}`)
      .then(res => res.json())
      .then(data => setTasks(data))
      .catch(console.error);
  }, [topicId]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleApprove = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/approve/`, { method: 'POST' });
      if (res.ok) {
        const updated = tasks.map((t: any) => t.id === taskId ? { ...t, status: 'approved' } : t);
        setTasks(updated);
        if (selectedTask?.id === taskId) {
          setSelectedTask({ ...selectedTask, status: 'approved' });
        }
        showToast("Task approved");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/reject/`, { method: 'POST', body: JSON.stringify({ reason: "rejected manually" }), headers: { 'Content-Type': 'application/json' } });
      if (res.ok) {
        const updated = tasks.map((t: any) => t.id === taskId ? { ...t, status: 'rejected' } : t);
        setTasks(updated);
        if (selectedTask?.id === taskId) {
          setSelectedTask({ ...selectedTask, status: 'rejected' });
        }
        showToast("Task rejected");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const acceptRevision = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/accept-revision/`, { method: 'POST' });
      if (res.ok) {
        const updated = tasks.map((t: any) => t.id === taskId ? { ...t, governance: { ...t.governance, revision_required: false } } : t);
        setTasks(updated);
        if (selectedTask?.id === taskId) {
          setSelectedTask({ ...selectedTask, governance: { ...selectedTask.governance, revision_required: false } });
        }
        showToast("Revision accepted");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const rerunAgent = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/rerun-agent/`, { method: 'POST' });
      if (res.ok) {
        const updated = tasks.map((t: any) => t.id === taskId ? { ...t, status: 'in_progress' } : t);
        setTasks(updated);
        if (selectedTask?.id === taskId) {
          setSelectedTask({ ...selectedTask, status: 'in_progress' });
        }
        showToast("Rerun scheduled");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const submitFeedback = async (taskId: number) => {
    if (!feedbackText) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/feedback/`, { method: 'POST', body: JSON.stringify({ raw_feedback: feedbackText }), headers: { 'Content-Type': 'application/json' } });
      if (res.ok) {
        const updatedFeedbacks = [...feedbacks, { taskId, text: feedbackText }];
        setFeedbacks(updatedFeedbacks);
        setFeedbackText("");
        showToast("Feedback submitted");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveScorecard = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/score/`, { method: 'POST', body: JSON.stringify({ quality: qualityScoreInput }), headers: { 'Content-Type': 'application/json' } });
      if (res.ok) {
        setAvgQualityScore(qualityScoreInput);
        setQualityScoreInput("");
        showToast("Scorecard saved");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateAction = async (payload: any) => {
    try {
      const res = await fetch('/api/actions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setActions([...actions, data]);
        showToast("Action request created");
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!topic) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      
      {/* Top Area */}
      <header className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border mb-6">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-semibold">{topic.title}</h1>
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">{topic.status}</span>
          </div>
          <p className="mt-2 text-slate-600 max-w-2xl">Objective: {topic.objective}</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <button onClick={() => setShowDailyPlan(true)} className="px-4 py-2 bg-white text-slate-700 rounded-md border shadow-sm hover:bg-slate-50 text-sm font-medium">
            Create daily plan
          </button>
          <button onClick={() => showToast("Topic-level feedback not yet implemented")} className="px-4 py-2 bg-white text-slate-700 rounded-md border shadow-sm hover:bg-slate-50 text-sm font-medium">
            Add feedback
          </button>
          <button disabled className="px-4 py-2 bg-slate-100 text-slate-400 rounded-md border text-sm font-medium cursor-not-allowed" onClick={() => showToast("Export brief not yet implemented")}>
            Export brief
          </button>
        </div>
      </header>

      <div className="flex border-b mb-6">
        <button 
          onClick={() => setActiveTab('tasks')} 
          className={`px-4 py-2 font-medium ${activeTab === 'tasks' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Tasks
        </button>
        <button 
          onClick={() => setActiveTab('actions')} 
          className={`px-4 py-2 font-medium ${activeTab === 'actions' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Actions
        </button>
        <button 
          role="tab"
          onClick={() => setActiveTab('conversation')} 
          className={`px-4 py-2 font-medium ${activeTab === 'conversation' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Conversation
        </button>
      </div>

      {activeTab === 'tasks' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-slate-500">Active tasks</h3>
          <p className="text-2xl font-semibold mt-1">8</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-slate-500">Completed tasks</h3>
          <p className="text-2xl font-semibold mt-1">0</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-slate-500">Pending approvals</h3>
          <p className="text-2xl font-semibold mt-1" data-testid="pending-count">{pendingCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-slate-500">Average quality score</h3>
          <p className="text-lg font-medium mt-1 text-slate-400">{avgQualityScore}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left: WorkstreamBoard */}
        <section className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border">
          <h2 className="text-lg font-semibold mb-4 border-b pb-2">Workstreams</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workstreams.map(ws => (
              <div key={ws.title} className="p-3 border rounded-lg hover:shadow-md transition bg-slate-50">
                <h3 className="font-medium text-slate-800">{ws.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{ws.count} tasks</p>
              </div>
            ))}
          </div>
        </section>

        {/* Right: ApprovalQueue & NextActionsPanel */}
        <div className="flex flex-col space-y-6">
          <section className="bg-white p-6 rounded-2xl shadow-sm border" data-testid="approval-queue">
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">Pending Approvals</h2>
            <ul className="space-y-3">
              {tasks.filter(t => t.approval === "required" && t.status === "proposed").map(t => (
                <li key={t.id} className="text-sm p-3 bg-amber-50 text-amber-900 rounded-md border border-amber-200 flex justify-between items-center">
                  <div>
                    <span className="font-medium block">{t.title}</span>
                    <span className="text-xs text-amber-700">Risk: {t.risk}</span>
                  </div>
                  <button 
                    onClick={() => setSelectedTask(t)}
                    className="ml-4 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold rounded-md border border-amber-300 transition-colors"
                  >
                    Review
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">Next Actions</h2>
            <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
              <li>Review proposed tasks</li>
              <li>Approve Algolia implementation plan</li>
            </ul>
          </section>
        </div>
      </div>

      {/* Bottom: TaskLedgerTable */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Task Ledger</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm whitespace-nowrap" aria-label="Task Ledger">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium rounded-tl-md">Task</th>
                <th className="px-4 py-3 font-medium">Workstream</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Approval</th>
                <th className="px-4 py-3 font-medium rounded-tr-md">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => {
                  setSelectedTask(t);
                  fetch(`/api/tasks/${t.id}/`)
                    .then(res => res.json())
                    .then(data => {
                      setSelectedTask(data);
                      setTasks(prev => prev.map((task: any) => task.id === data.id ? data : task));
                    })
                    .catch(err => console.error(err));
                }}>
                  <td className="px-4 py-3 font-medium text-slate-800">{t.title}</td>
                  <td className="px-4 py-3 text-slate-600">{t.workstream}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${t.risk === 'high' ? 'bg-red-100 text-red-800' : t.risk === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                      {t.risk}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.status}</td>
                  <td className="px-4 py-3 text-slate-600">{t.approval}</td>
                  <td className="px-4 py-3 text-slate-400">{t.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </>
      )}

      {activeTab === 'actions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Actions</h2>
              <button onClick={() => setShowActionDrawer(true)} className="px-3 py-1 bg-black text-white text-sm rounded-md shadow hover:bg-slate-800">
                Propose New Action
              </button>
            </div>
            <ActionInbox actions={actions} onSelectAction={setSelectedAction} />
          </div>
          
          <div className="lg:col-span-2">
            {selectedAction ? (
              <div className="bg-white p-6 rounded-2xl shadow-sm border">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <div>
                    <h2 className="text-xl font-bold">{selectedAction.title}</h2>
                    <p className="text-sm text-slate-500 capitalize">{selectedAction.action_type}</p>
                  </div>
                  <ActionRiskBadge riskLevel={selectedAction.risk_level} />
                </div>
                
                <ActionExecutionTimeline status={selectedAction.status} />
                
                {selectedAction.generated_output && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-2">Draft Preview</h3>
                    <EmailDraftPreview payload={selectedAction.generated_output} />
                  </div>
                )}
                
                <ActionApprovalPanel 
                  status={selectedAction.status} 
                  payload={selectedAction.generated_output}
                  onApprove={() => {
                    const updated = actions.map(a => a.id === selectedAction.id ? { ...a, status: 'approved' } : a);
                    setActions(updated);
                    setSelectedAction({ ...selectedAction, status: 'approved' });
                  }} 
                  onReject={() => {
                    const updated = actions.map(a => a.id === selectedAction.id ? { ...a, status: 'rejected' } : a);
                    setActions(updated);
                    setSelectedAction({ ...selectedAction, status: 'rejected' });
                  }} 
                  onExecute={() => {
                    // Mock execute
                    fetch(`/api/actions/${selectedAction.id}/execute/`, { method: 'POST' })
                      .then(res => res.json())
                      .then(data => {
                        const updated = actions.map(a => a.id === selectedAction.id ? data : a);
                        setActions(updated);
                        setSelectedAction(data);
                        showToast("Action executed");
                      });
                  }}
                />
                
                {selectedAction.execution_result && (
                  <ActionResultPanel executionResult={selectedAction.execution_result} />
                )}
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl shadow-sm border text-center text-slate-500 py-20">
                Select an action to view details
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'conversation' && (
        <div className="-mx-8 -mb-8">
          <ChatShell sessionId={Number(topicId) || 1} />
        </div>
      )}

      <ActionCreateDrawer 
        topicId={topicId} 
        isOpen={showActionDrawer} 
        onClose={() => setShowActionDrawer(false)} 
        onSubmit={handleCreateAction} 
      />

      {/* Detail Drawers */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setSelectedTask(null)}>
          <div 
            className="w-full max-w-lg bg-white h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Task Detail"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-slate-800">Task Detail</h2>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            
            <h3 className="font-medium text-lg mb-2">{selectedTask.title}</h3>
            
            <div className="space-y-6 mt-6">
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Overview</h4>
                <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-md border">
                  <div><span className="text-slate-500">Status:</span> {selectedTask.status}</div>
                  <div><span className="text-slate-500">Risk Level:</span> {selectedTask.risk}</div>
                  <div><span className="text-slate-500">Approval Required:</span> {selectedTask.approval}</div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Execution Lineage</h4>
                <div className="text-sm bg-slate-50 p-4 rounded-md border font-mono text-slate-600">
                  {"{ \"source\": \"template\" }"}
                </div>
              </div>

              {selectedTask.governance?.revision_required && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-md mt-4">
                  <h4 className="text-amber-800 font-medium flex items-center">
                    <span className="mr-2">⚠️</span> Revision required
                  </h4>
                  <p className="text-sm text-amber-700 mt-2 mb-3">
                    The executive reviewer has halted this task and requested the following revisions:
                  </p>
                  <ul className="list-disc list-inside text-sm text-amber-800 mb-4 space-y-1">
                    {selectedTask.outputs?.executive_review?.required_revisions?.map((rev: string, i: number) => (
                      <li key={i}>{rev}</li>
                    ))}
                  </ul>
                  <div className="flex space-x-3">
                    <button 
                      onClick={() => acceptRevision(selectedTask.id)}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                    >
                      Accept revision request
                    </button>
                    <button 
                      onClick={() => rerunAgent(selectedTask.id)}
                      className="bg-white hover:bg-amber-100 text-amber-700 border border-amber-300 px-3 py-1.5 rounded text-sm font-medium transition-colors"
                    >
                      Rerun task
                    </button>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Governance</h4>
                <div className="text-sm text-slate-600 bg-white border p-3 rounded-md">
                  <p>Policy compliant</p>
                  {selectedTask.approval === "required" && (
                    <p className="mt-2 text-amber-700 font-medium">Approval Reason: Requires manual sign-off for execution due to {selectedTask.risk} risk level.</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Inputs</h4>
                <div className="text-sm text-slate-600 bg-white border p-3 rounded-md">
                  <details open>
                    <summary className="cursor-pointer font-medium text-slate-700 hover:text-blue-600">View raw JSON</summary>
                    <pre className="mt-2 p-2 bg-slate-50 text-xs overflow-x-auto rounded border border-slate-200">
                      {JSON.stringify({ "status": "None provided" }, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Outputs</h4>
                <AgentOutputPanel task={selectedTask} />
              </div>

              {selectedTask.actions && selectedTask.actions.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Actions</h4>
                  <div className="space-y-3">
                    {selectedTask.actions.map((action: any) => (
                      <div key={action.id} className="bg-white border p-4 rounded-md shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <h5 className="font-medium text-slate-800">{action.title}</h5>
                          <span className={`px-2 py-1 text-xs rounded-full ${action.status === 'executed' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                            {action.status}
                          </span>
                        </div>
                        {action.execution_result && (
                          <div className="mt-3 bg-slate-50 p-3 rounded text-xs font-mono text-slate-600 border border-slate-100">
                            <strong>Execution Result:</strong>
                            <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(action.execution_result, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}


              {selectedTask.outputs?.output_versions?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Version History</h4>
                  <div className="space-y-3">
                    {selectedTask.outputs.output_versions.map((ver: any, i: number) => (
                      <div key={i} className="text-sm text-slate-600 bg-white border p-3 rounded-md opacity-75">
                        <details>
                          <summary className="cursor-pointer font-medium text-slate-700">View v{i + 1} JSON</summary>
                          <pre className="mt-2 p-2 bg-slate-50 text-xs overflow-x-auto rounded border border-slate-200">
                            {JSON.stringify(ver, null, 2)}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Executive Review</h4>
                <ExecutiveReviewPanel review={selectedTask.outputs?.executive_review} />
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Evaluation</h4>
                <EvaluationScorePanel evaluation={selectedTask.evaluation} />
                <div className="text-sm text-slate-600 bg-white border p-3 rounded-md space-y-3 mt-4">
                  <p>Manual Score Override (Optional)</p>
                  <div>
                    <label htmlFor={`quality-${selectedTask.id}`} className="block text-xs font-medium text-slate-700">Quality Score</label>
                    <input 
                      id={`quality-${selectedTask.id}`}
                      type="number"
                      value={qualityScoreInput}
                      onChange={(e) => setQualityScoreInput(e.target.value)}
                      className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                      aria-label="Quality Score"
                    />
                  </div>
                  <button 
                    onClick={() => saveScorecard(selectedTask.id)}
                    className="bg-slate-800 text-white px-3 py-1.5 rounded-md text-xs font-medium"
                  >
                    Save Scorecard
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Feedback</h4>
                <div className="text-sm text-slate-600 bg-white border p-3 rounded-md space-y-4">
                  {feedbacks.filter(f => f.taskId === selectedTask.id).map((f, i) => (
                    <div key={i} className="bg-slate-50 p-3 rounded border">
                      <p className="text-slate-800">{f.text}</p>
                      <p className="text-xs text-slate-400 mt-2">Not yet approved for reusable memory</p>
                    </div>
                  ))}
                  
                  <div className="border-t pt-3 mt-3">
                    <h5 className="font-medium mb-2 text-slate-800">Add Feedback</h5>
                    <textarea 
                      placeholder="Enter your feedback"
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="w-full border rounded-md p-2 text-sm"
                      rows={3}
                    />
                    <button 
                      onClick={() => submitFeedback(selectedTask.id)}
                      className="mt-2 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-100"
                    >
                      Submit Feedback
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Traceability</h4>
                <div className="text-sm text-slate-600 bg-white border p-4 rounded-md space-y-4">
                  <div className="grid grid-cols-2 gap-4 border-b pb-4">
                    <div>
                      <span className="block text-xs font-medium text-slate-400 uppercase tracking-wide">parent_plan_id</span>
                      <span className="text-slate-800 font-mono mt-1 block">plan_abc123</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-slate-400 uppercase tracking-wide">prompt_version</span>
                      <span className="text-slate-800 font-mono mt-1 block">v1.2.0</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-slate-400 uppercase tracking-wide">model_version</span>
                      <span className="text-slate-800 font-mono mt-1 block">gpt-4o-2024-05-13</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-slate-400 uppercase tracking-wide">source documents</span>
                      <span className="text-slate-800 mt-1 block">0 documents</span>
                    </div>
                  </div>
                  
                  <AgentTelemetryPanel telemetry={selectedTask.telemetry} />
                </div>
              </div>
            </div>

            {selectedTask.status === 'proposed' && selectedTask.approval === 'required' && (
              <div className="mt-8 pt-6 border-t flex space-x-3">
                <button 
                  onClick={() => handleApprove(selectedTask.id)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md shadow-sm transition-colors"
                >
                  Approve
                </button>
                <button 
                  onClick={() => handleReject(selectedTask.id)}
                  className="flex-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 font-medium py-2 rounded-md transition-colors"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-6 py-3 rounded-md shadow-lg font-medium animate-in slide-in-from-bottom z-50">
          {toastMessage}
        </div>
      )}

      {showDailyPlan && (
        <DailyPlanPanel 
          onClose={() => setShowDailyPlan(false)} 
          onStart={() => {
            setShowDailyPlan(false);
            setShowExecutionPanel(true);
          }}
        />
      )}

      {showExecutionPanel && (
        <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/20 p-8" onClick={() => setShowExecutionPanel(false)}>
           <div onClick={e => e.stopPropagation()} className="w-full max-w-5xl">
             <WorkflowExecutionPanel 
               onClose={() => setShowExecutionPanel(false)} 
               autoStart={true} 
             />
           </div>
        </div>
      )}
    </div>
  );
}
