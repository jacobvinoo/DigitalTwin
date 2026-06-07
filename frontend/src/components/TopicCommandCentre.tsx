import { useState, useEffect } from 'react';
import DailyPlanPanel from './DailyPlanPanel';
import WorkflowExecutionPanel from './WorkflowExecutionPanel';
import { AgentOutputPanel, ExecutiveReviewPanel, EvaluationScorePanel, AgentTelemetryPanel } from './AgentOutputs';
import { ActionInbox } from './ActionInbox';
import { ActionCreateDrawer } from './ActionCreateDrawer';
import { EmailDraftPreview, ActionApprovalPanel, ActionExecutionTimeline, ActionResultPanel, ActionAuditPanel, ActionRiskBadge } from './ActionComponents';
import ChatShell from './ChatShell';
import DocumentLibraryPanel from './DocumentLibraryPanel';
import { TaskCreateDrawer } from './TaskCreateDrawer';

export default function TopicCommandCentre({ topicId }: { topicId: string }) {
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedDocumentName, setSelectedDocumentName] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbacks, setFeedbacks] = useState<{taskId: number, text: string}[]>([]);
  const [qualityScoreInput, setQualityScoreInput] = useState("");
  const [avgQualityScore, setAvgQualityScore] = useState<string | number>("Not scored");
  const [showDailyPlan, setShowDailyPlan] = useState(false);
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const [currentWorkflowRunId, setCurrentWorkflowRunId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<'tasks' | 'actions' | 'documents' | 'conversation'>('tasks');
  const [actions, setActions] = useState<any[]>([]);
  const [rejectActionId, setRejectActionId] = useState<number | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState("");
  const [showActionDrawer, setShowActionDrawer] = useState(false);
  const [selectedAction, setSelectedAction] = useState<any>(null);
  const [showTaskDrawer, setShowTaskDrawer] = useState(false);

  const [topic, setTopic] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [workstreams, setWorkstreams] = useState<any[]>([]);
  const [selectedWorkstream, setSelectedWorkstream] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

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
        setActiveCount(data.active_tasks_count || 0);
        setCompletedCount(data.completed_tasks_count || 0);
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

  useEffect(() => {
    const hasInProgress = tasks.some((t: any) => t.status === 'in_progress');
    if (!hasInProgress) return;

    const interval = setInterval(() => {
      fetch(`/api/tasks/?topic=${topicId}`)
        .then(res => res.json())
        .then(data => {
          setTasks(data);
          if (selectedTask) {
            const updatedSelected = data.find((t: any) => t.id === selectedTask.id);
            if (updatedSelected && updatedSelected.status !== selectedTask.status) {
              setSelectedTask(updatedSelected);
            }
          }
        })
        .catch(console.error);

      fetch(`/api/topics/${topicId}/command-centre/`)
        .then(res => res.json())
        .then(data => {
          setPendingCount(data.pending_approval_count || 0);
          setAvgQualityScore(data.average_quality_score || "Not scored");
          setActiveCount(data.active_tasks_count || 0);
          setCompletedCount(data.completed_tasks_count || 0);
        })
        .catch(console.error);
    }, 2000);

    return () => clearInterval(interval);
  }, [tasks, topicId, selectedTask]);

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
        setPendingCount(prev => Math.max(0, prev - 1));
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
        setPendingCount(prev => Math.max(0, prev - 1));
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
      let updatedTask = selectedTask && selectedTask.id === taskId ? { ...selectedTask } : null;
      if (feedbackText.trim()) {
        const fbRes = await fetch(`/api/tasks/${taskId}/feedback/`, {
          method: 'POST',
          body: JSON.stringify({ raw_feedback: feedbackText }),
          headers: { 'Content-Type': 'application/json' }
        });
        if (fbRes.ok) {
          const newFb = { id: Date.now(), text: feedbackText, type: "quality" };
          if (updatedTask) {
            updatedTask.feedbacks = [...(updatedTask.feedbacks || []), newFb];
          }
          const updatedFeedbacks = [...feedbacks, { taskId, text: feedbackText }];
          setFeedbacks(updatedFeedbacks);
          setFeedbackText("");
        }
      }

      const res = await fetch(`/api/tasks/${taskId}/rerun-agent/`, { method: 'POST' });
      if (res.ok) {
        if (updatedTask) {
          updatedTask.status = 'in_progress';
          setSelectedTask(updatedTask);
          setTasks(prev => prev.map((t: any) => t.id === taskId ? updatedTask : t));
        } else {
          setTasks(prev => prev.map((t: any) => t.id === taskId ? { ...t, status: 'in_progress' } : t));
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
        const newFb = { id: Date.now(), text: feedbackText, type: "quality" };
        const updatedTask = selectedTask && selectedTask.id === taskId ? {
          ...selectedTask,
          feedbacks: [...(selectedTask.feedbacks || []), newFb]
        } : null;
        
        if (updatedTask) {
          setSelectedTask(updatedTask);
          setTasks(prev => prev.map((t: any) => t.id === taskId ? updatedTask : t));
        }

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

  const handleApproveActionInDrawer = async (actionId: number) => {
    try {
      const res = await fetch(`/api/actions/${actionId}/approve/`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (selectedTask) {
          const updatedActions = selectedTask.actions.map((a: any) => a.id === actionId ? data : a);
          const updatedTask = { ...selectedTask, actions: updatedActions };
          setSelectedTask(updatedTask);
          setTasks(prev => prev.map((t: any) => t.id === selectedTask.id ? updatedTask : t));
        }
        setActions(prev => prev.map((a: any) => a.id === actionId ? data : a));
        if (selectedAction?.id === actionId) {
          setSelectedAction(data);
        }
        showToast("Action approved");
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || errorData.detail || "Failed to approve action");
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to approve action due to network error");
    }
  };

  const handleRejectActionInDrawer = async (actionId: number, reason: string) => {
    if (!reason.trim()) {
      showToast("Please enter a reason for rejection");
      return;
    }
    try {
      const res = await fetch(`/api/actions/${actionId}/reject/`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        if (selectedTask) {
          const updatedActions = selectedTask.actions.map((a: any) => a.id === actionId ? data : a);
          const updatedTask = { ...selectedTask, actions: updatedActions };
          setSelectedTask(updatedTask);
          setTasks(prev => prev.map((t: any) => t.id === selectedTask.id ? updatedTask : t));
        }
        setActions(prev => prev.map((a: any) => a.id === actionId ? data : a));
        if (selectedAction?.id === actionId) {
          setSelectedAction(data);
        }
        setRejectActionId(null);
        setRejectReasonText("");
        showToast("Action rejected");
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || errorData.detail || "Failed to reject action");
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to reject action due to network error");
    }
  };

  const handleExecuteActionInDrawer = async (actionId: number) => {
    try {
      const res = await fetch(`/api/actions/${actionId}/execute/`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (selectedTask) {
          const updatedActions = selectedTask.actions.map((a: any) => a.id === actionId ? data : a);
          const updatedTask = { ...selectedTask, actions: updatedActions };
          setSelectedTask(updatedTask);
          setTasks(prev => prev.map((t: any) => t.id === selectedTask.id ? updatedTask : t));
        }
        setActions(prev => prev.map((a: any) => a.id === actionId ? data : a));
        if (selectedAction?.id === actionId) {
          setSelectedAction(data);
        }
        showToast("Action executed");
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || errorData.detail || "Failed to execute action");
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to execute action due to network error");
    }
  };

  const handleAddDraftTaskToBoard = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/add-to-board/`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTasks(prev => prev.map((t: any) => t.id === taskId ? data : t));
        showToast("Task added to board");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDismissDraftTask = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/`, { method: 'DELETE' });
      if (res.ok) {
        setTasks(prev => prev.filter((t: any) => t.id !== taskId));
        showToast("Draft task dismissed");
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

  const handleProposeTask = async (payload: any) => {
    try {
      const res = await fetch('/api/tasks/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(prev => [data, ...prev]);
        showToast("Task request created");
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || errorData.detail || "Failed to create task");
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to create task due to network error");
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!window.confirm("Are you sure you want to delete this task? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setTasks(prev => prev.filter((t: any) => t.id !== taskId));
        setSelectedTask(null);
        showToast("Task deleted successfully");
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || errorData.detail || "Failed to delete task");
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to delete task due to network error");
    }
  };

  const handleDeleteAction = async (actionId: number) => {
    if (!window.confirm("Are you sure you want to delete this action? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/actions/${actionId}/`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setActions(prev => prev.filter((a: any) => a.id !== actionId));
        setSelectedAction(null);
        showToast("Action deleted successfully");
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || errorData.detail || "Failed to delete action");
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to delete action due to network error");
    }
  };

  const handleApproveChanges = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/approve-changes/`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(prev => prev.map((t: any) => t.id === taskId ? data : t));
        if (selectedTask?.id === taskId) {
          setSelectedTask(data);
        }
        showToast("Changes approved & saved successfully");
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || errorData.detail || "Failed to approve changes");
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to approve changes due to network error");
    }
  };

  const computeLineDiff = (oldText: string, newText: string) => {
    const oldLines = oldText ? oldText.split('\n') : [];
    const newLines = newText ? newText.split('\n') : [];
    
    if (oldLines.length === 0) {
      return newLines.map(line => ({ type: 'added' as const, value: line }));
    }
    if (newLines.length === 0) {
      return oldLines.map(line => ({ type: 'removed' as const, value: line }));
    }
    
    const dp: number[][] = Array(oldLines.length + 1).fill(null).map(() => Array(newLines.length + 1).fill(0));
    
    for (let i = 1; i <= oldLines.length; i++) {
      for (let j = 1; j <= newLines.length; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    const diff: { type: 'added' | 'removed' | 'unchanged'; value: string }[] = [];
    let i = oldLines.length;
    let j = newLines.length;
    
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        diff.unshift({ type: 'unchanged' as const, value: oldLines[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        diff.unshift({ type: 'added' as const, value: newLines[j - 1] });
        j--;
      } else {
        diff.unshift({ type: 'removed' as const, value: oldLines[i - 1] });
        i--;
      }
    }
    
    return diff;
  };

  if (!topic) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      
      {/* Navigation Breadcrumb */}
      <div className="mb-4">
        <a
          href="/topics"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-all cursor-pointer group"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1 transform group-hover:-translate-x-0.5 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </a>
      </div>

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
          onClick={() => setActiveTab('documents')} 
          className={`px-4 py-2 font-medium ${activeTab === 'documents' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Documents
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
          <p className="text-2xl font-semibold mt-1">{activeCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-slate-500">Completed tasks</h3>
          <p className="text-2xl font-semibold mt-1">{completedCount}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left: ApprovalQueue */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border" data-testid="approval-queue">
          <h2 className="text-lg font-semibold mb-4 border-b pb-2">Pending Approvals</h2>
          <ul className="space-y-3">
            {tasks.filter(t => t.approval === "required" && t.status === "proposed" && !t.governance?.is_draft).map(t => (
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

        {/* Right: NextActionsPanel */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border">
          <h2 className="text-lg font-semibold mb-4 border-b pb-2">Next Actions</h2>
          <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
            <li>Review proposed tasks</li>
            <li>Approve Algolia implementation plan</li>
          </ul>
        </section>
      </div>

      {/* Center/Bottom: Draft Tasks Panel */}
      {tasks.some(t => t.governance?.is_draft) && (
        <section className="bg-white p-6 rounded-2xl shadow-sm border mb-6" data-testid="draft-tasks-panel">
          <h2 className="text-lg font-semibold mb-2 border-b pb-2 flex items-center justify-between">
            <span>Draft Tasks from Planning</span>
            <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full font-bold">
              {tasks.filter(t => t.governance?.is_draft).length} Suggested
            </span>
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            These tasks were automatically identified and generated from your approved planning and strategy documents. Review and add them to your Task Ledger board.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tasks.filter(t => t.governance?.is_draft).map(t => (
              <div key={t.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-50 text-indigo-700 rounded border border-indigo-200 uppercase tracking-wider">
                      Draft Task
                    </span>
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-mono capitalize">
                      {t.task_type?.replace(/_/g, ' ') || 'Focus Task'}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1">{t.title}</h4>
                  {t.workstream_title && (
                    <p className="text-[11px] text-slate-500 mb-4">Workstream: {t.workstream_title}</p>
                  )}
                </div>
                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200/60 mt-auto">
                  <button
                    onClick={() => handleDismissDraftTask(t.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleAddDraftTaskToBoard(t.id)}
                    className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold transition shadow-sm"
                  >
                    Add to Board
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bottom: TaskLedgerTable */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between border-b pb-4 mb-4 gap-4">
          <div className="flex justify-between items-center w-full xl:w-auto">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Task Ledger</h2>
              <p className="text-xs text-slate-500 mt-0.5 font-normal">Track, audit, and steer task executions</p>
            </div>
            <button 
              onClick={() => setShowTaskDrawer(true)}
              className="px-3.5 py-2 bg-black hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95 cursor-pointer ml-4 shrink-0"
            >
              Propose New Task
            </button>
          </div>
          {/* Workstream Filter Pills */}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => setSelectedWorkstream(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                !selectedWorkstream
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
              }`}
            >
              All Workstreams
            </button>
            {workstreams.map(ws => {
              const isSelected = selectedWorkstream === ws.title;
              return (
                <button
                  key={ws.title}
                  onClick={() => setSelectedWorkstream(isSelected ? null : ws.title)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  {ws.title} <span className={`ml-1 text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>({ws.count})</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm whitespace-nowrap" aria-label="Task Ledger">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium rounded-tl-md">Task</th>
                <th className="px-4 py-3 font-medium">Workstream</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Approval</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium rounded-tr-md w-12 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks
                .filter(t => !t.governance?.is_draft)
                .filter(t => !selectedWorkstream || (t.workstream_title || String(t.workstream)) === selectedWorkstream)
                .map(t => (
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
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <div className="flex items-center space-x-2">
                        <span>{t.title}</span>
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-50 text-indigo-700 rounded border border-indigo-200 uppercase tracking-wider shrink-0">
                          Planning
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.workstream_title || t.workstream}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${t.risk === 'high' ? 'bg-red-100 text-red-800' : t.risk === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                      {t.risk}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.status}</td>
                  <td className="px-4 py-3 text-slate-600">{t.approval}</td>
                  <td className="px-4 py-3 text-slate-400">{t.score}</td>
                  <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(t.id);
                        }}
                        className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded-md transition cursor-pointer"
                        title="Remove Task"
                        data-testid={`delete-task-btn-${t.id}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
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
            <ActionInbox actions={actions} onSelectAction={setSelectedAction} onDeleteAction={handleDeleteAction} />
          </div>
          
          <div className="lg:col-span-2">
            {selectedAction ? (
              <div className="bg-white p-6 rounded-2xl shadow-sm border">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-xl font-bold">{selectedAction.title}</h2>
                      <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-50 text-emerald-700 rounded border border-emerald-200 uppercase tracking-wider shrink-0">
                        Execution
                      </span>
                    </div>
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
                  approvalRequired={selectedAction.approval_required}
                  onApprove={() => handleApproveActionInDrawer(selectedAction.id)} 
                  onReject={(reason) => handleRejectActionInDrawer(selectedAction.id, reason)} 
                  onExecute={() => handleExecuteActionInDrawer(selectedAction.id)}
                />
                
                {selectedAction.execution_result && (
                  <ActionResultPanel executionResult={selectedAction.execution_result} />
                )}
                
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <button
                    onClick={() => handleDeleteAction(selectedAction.id)}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-md text-sm font-semibold transition-all cursor-pointer shadow-sm active:scale-95 text-center w-full"
                  >
                    Delete Action Request
                  </button>
                </div>
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

      {activeTab === 'documents' && (
        <DocumentLibraryPanel 
          topicId={topicId}
          selectedDocumentName={selectedDocumentName}
          onClearSelectedDocumentName={() => setSelectedDocumentName(null)}
        />
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
            className={`w-full ${selectedTask?.outputs?.suggested_document_markdown ? 'max-w-3xl' : 'max-w-lg'} bg-white h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right`}
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
            
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="font-bold text-lg text-slate-800">{selectedTask.title}</h3>
              <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-50 text-indigo-700 rounded border border-indigo-200 uppercase tracking-wider shrink-0">
                Planning
              </span>
            </div>
            
            <div className="space-y-6 mt-6">
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Overview</h4>
                <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-md border">
                  <div><span className="text-slate-500">Status:</span> {selectedTask.status}</div>
                  <div><span className="text-slate-500">Risk Level:</span> {selectedTask.risk}</div>
                  <div><span className="text-slate-500">Approval Required:</span> {selectedTask.approval}</div>
                </div>
                {selectedTask.inputs?.description && (
                  <div className="mt-4">
                    <span className="text-xs font-semibold text-slate-500 block mb-1">Details / Instructions:</span>
                    <div className="text-xs text-slate-700 bg-slate-50 border p-3 rounded-lg leading-relaxed whitespace-pre-wrap font-sans">
                      {selectedTask.inputs.description}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Task Operations</h4>
                <div className="flex flex-wrap gap-3 bg-slate-50 p-4 rounded-md border">
                  {selectedTask.status === "proposed" ? (
                    selectedTask.approval === "required" ? (
                      <div className="flex flex-col gap-2 w-full">
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 p-2 rounded-md mb-1">
                          ⚠️ This task requires manual sign-off before execution.
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(selectedTask.id)}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-semibold hover:bg-emerald-700 transition-all cursor-pointer shadow-sm active:scale-95 flex-1 text-center"
                          >
                            Approve Task
                          </button>
                          <button
                            onClick={() => handleReject(selectedTask.id)}
                            className="px-4 py-2 bg-white text-rose-600 border border-rose-200 rounded-md text-sm font-semibold hover:bg-rose-50 transition-all cursor-pointer shadow-sm active:scale-95 flex-1 text-center"
                          >
                            Reject Task
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => rerunAgent(selectedTask.id)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        Execute Task
                      </button>
                    )
                  ) : selectedTask.status === "approved" ? (
                    <button
                      onClick={() => rerunAgent(selectedTask.id)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      Execute Task
                    </button>
                  ) : selectedTask.status === "in_progress" ? (
                    <div className="flex items-center gap-3 text-sm text-slate-500 font-medium">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                      <span>Agent is executing...</span>
                      <button 
                        onClick={() => {
                          fetch(`/api/tasks/${selectedTask.id}/`)
                            .then(res => res.json())
                            .then(data => {
                              setSelectedTask(data);
                              setTasks(prev => prev.map((task: any) => task.id === data.id ? data : task));
                              showToast("Refreshed status");
                            })
                            .catch(err => console.error(err));
                        }} 
                        className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer"
                      >
                        Refresh Execution Details
                      </button>
                    </div>
                  ) : selectedTask.status === "blocked" ? (
                    <div className="flex flex-col gap-3 w-full bg-amber-50 border border-amber-200 p-4 rounded-lg">
                      <div className="flex items-center text-sm font-bold text-amber-800">
                        <span className="mr-2 text-base">⚠️</span>
                        {selectedTask.governance?.revision_required 
                          ? "Revision Required: Review & Accept Revisions" 
                          : "Action Required: Submit Feedback & Rerun"}
                      </div>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        {selectedTask.governance?.revision_required
                          ? "The Executive Reviewer has requested revisions before this task can be approved. Please review the details below, accept the request, and add steering inputs."
                          : "You have accepted the revision request. Now add your guidance/details in the Feedback section below, then rerun the agent to generate an updated version."}
                      </p>
                      
                      {selectedTask.governance?.revision_required ? (
                        <div className="space-y-3 pt-1">
                          <div className="bg-white/70 p-2.5 rounded border border-amber-100 text-xs text-amber-900 space-y-1">
                            <span className="font-semibold text-[10px] uppercase text-amber-700 tracking-wider">Required Revisions:</span>
                            <ul className="list-disc list-inside space-y-0.5">
                              {selectedTask.outputs?.executive_review?.required_revisions?.map((rev: string, i: number) => (
                                  <li key={i}>{rev}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => acceptRevision(selectedTask.id)}
                              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-xs font-semibold transition shadow-sm flex-1 text-center cursor-pointer"
                            >
                              Accept revision request
                            </button>
                            <button
                              onClick={() => rerunAgent(selectedTask.id)}
                              className="bg-white hover:bg-amber-100 text-amber-700 border border-amber-300 px-3 py-1.5 rounded text-xs font-semibold transition flex-1 text-center cursor-pointer"
                            >
                              Force Rerun Task
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 pt-1">
                          <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 p-2 rounded-md">
                            ✓ Revision request accepted.
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const element = document.getElementById("feedback-section-header");
                                if (element) {
                                  element.scrollIntoView({ behavior: "smooth" });
                                }
                              }}
                              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-xs font-semibold transition text-center shadow-sm flex-1 cursor-pointer"
                            >
                              Go to Feedback Form
                            </button>
                            <button
                              onClick={() => rerunAgent(selectedTask.id)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-xs font-semibold transition text-center shadow-sm flex-1 cursor-pointer"
                            >
                              Rerun Agent & Apply Feedback
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // completed, rejected, failed
                    <div className="flex flex-col gap-2 w-full">
                      {selectedTask.status === "rejected" && (
                        <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 p-2 rounded-md mb-1">
                          ✕ This task was rejected. Reason: {selectedTask.governance?.rejection_reason || "None provided"}
                        </span>
                      )}
                      {selectedTask.status === "failed" && (
                        <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 p-2 rounded-md mb-1">
                          ✕ Execution failed. Please check the logs/telemetry.
                        </span>
                      )}
                      <button
                        onClick={() => rerunAgent(selectedTask.id)}
                        className="px-4 py-2 bg-slate-800 text-white rounded-md text-sm font-semibold hover:bg-slate-900 transition-all cursor-pointer shadow-sm active:scale-95 text-center w-full"
                      >
                        Rerun Agent
                      </button>
                    </div>
                  )}
                  <div className="w-full border-t border-slate-200 pt-3 mt-1">
                    <button
                      onClick={() => handleDeleteTask(selectedTask.id)}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-md text-sm font-semibold transition-all cursor-pointer shadow-sm active:scale-95 text-center w-full"
                    >
                      Delete Task
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Execution Lineage</h4>
                <div className="text-sm bg-slate-50 p-4 rounded-md border font-mono text-slate-600">
                  {"{ \"source\": \"template\" }"}
                </div>
              </div>



              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Governance</h4>
                <div className="text-sm text-slate-600 bg-white border p-3 rounded-md">
                  <p>Policy compliant</p>
                  {selectedTask.approval === "required" && (
                    <p className="mt-2 text-amber-700 font-medium">Approval Reason: Requires manual sign-off for execution due to {selectedTask.risk} risk level.</p>
                  )}
                </div>
              </div>

              {selectedTask?.outputs?.suggested_document_markdown && (
                <div className="mt-6 border-t pt-6" data-testid="suggested-changes-container">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Suggested Document Changes</h4>
                    <button
                      onClick={() => handleApproveChanges(selectedTask.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition shadow-sm cursor-pointer"
                      data-testid="approve-changes-button"
                    >
                      Approve & Save Changes
                    </button>
                  </div>
                  <div className="font-mono text-xs bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto max-h-96 border border-slate-800 leading-relaxed">
                    {computeLineDiff(
                      selectedTask.outputs.generated_document_markdown || "",
                      selectedTask.outputs.suggested_document_markdown
                    ).map((line, idx) => (
                      <div
                        key={idx}
                        className={`px-2 py-0.5 rounded-sm whitespace-pre-wrap ${
                          line.type === 'added' ? 'bg-emerald-950/60 text-emerald-300 border-l-2 border-emerald-500' :
                          line.type === 'removed' ? 'bg-rose-950/60 text-rose-300 border-l-2 border-rose-500' :
                          'text-slate-300'
                        }`}
                      >
                        <span className="select-none mr-2 font-bold text-slate-500">
                          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                        </span>
                        {line.value}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Inputs</h4>
                <div className="text-sm text-slate-600 bg-white border p-3 rounded-md">
                  <details open>
                    <summary className="cursor-pointer font-medium text-slate-700 hover:text-blue-600">View raw JSON</summary>
                    <pre className="mt-2 p-2 bg-slate-50 text-xs overflow-x-auto rounded border border-slate-200">
                      {JSON.stringify(selectedTask.inputs || {}, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Outputs</h4>
                <AgentOutputPanel 
                  task={selectedTask} 
                  onViewDocument={(docName) => {
                    setActiveTab('documents');
                    setSelectedDocumentName(docName);
                    setSelectedTask(null);
                  }}
                />
              </div>

              {selectedTask.actions && selectedTask.actions.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">Execution Actions ({selectedTask.actions.length})</h4>
                  <div className="space-y-4">
                    {selectedTask.actions.map((action: any) => {
                      const needsApproval = action.approval_required && (action.status === 'proposed' || action.status === 'awaiting_approval');
                      const canExecute = action.status === 'approved' || (action.status === 'proposed' && !action.approval_required);

                      return (
                        <div key={action.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-xs space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="flex items-center space-x-2">
                                <h5 className="font-bold text-slate-800 text-sm">{action.title}</h5>
                                <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-50 text-emerald-700 rounded border border-emerald-200 uppercase tracking-wider shrink-0">
                                  Execution
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 capitalize mt-0.5">{action.action_type?.replace('_', ' ') || ''}</p>
                            </div>
                            <div className="flex items-center space-x-1.5 shrink-0">
                              <ActionRiskBadge riskLevel={action.risk_level || 'low'} />
                              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full capitalize ${
                                action.status === 'executed' ? 'bg-blue-100 text-blue-800' :
                                action.status === 'approved' ? 'bg-green-100 text-green-800' :
                                action.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-slate-200 text-slate-700'
                              }`}>
                                {action.status.replace('_', ' ')}
                              </span>
                            </div>
                          </div>

                          <div className="text-xs text-slate-700 bg-white border border-slate-100 p-3 rounded-lg leading-relaxed">
                            <span className="font-semibold text-slate-500 block mb-1">Instruction:</span>
                            {action.instruction}
                          </div>

                          {action.status === 'rejected' && action.rejected_reason && (
                            <div className="text-xs text-red-700 bg-red-50 border border-red-100 p-3 rounded-lg">
                              <span className="font-bold block">Rejection Reason:</span>
                              {action.rejected_reason}
                            </div>
                          )}

                          {/* Rejection Prompt Form */}
                          {rejectActionId === action.id ? (
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg space-y-2">
                              <label htmlFor={`reject-reason-${action.id}`} className="block text-[11px] font-bold text-amber-800 uppercase tracking-wider">Reason for Rejection</label>
                              <textarea
                                id={`reject-reason-${action.id}`}
                                className="w-full text-xs p-2 border border-amber-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:outline-none bg-white"
                                rows={2}
                                placeholder="Enter rejection reason..."
                                value={rejectReasonText}
                                onChange={e => setRejectReasonText(e.target.value)}
                              />
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => {
                                    setRejectActionId(null);
                                    setRejectReasonText("");
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-800"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleRejectActionInDrawer(action.id, rejectReasonText)}
                                  className="px-3 py-1 text-[11px] bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold transition"
                                >
                                  Confirm Rejection
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Actions Panel */
                            action.status !== 'executed' && action.status !== 'rejected' && (
                              <div className="flex justify-end space-x-2 pt-1 border-t border-slate-200/60">
                                {needsApproval && (
                                  <>
                                    <button
                                      onClick={() => setRejectActionId(action.id)}
                                      className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-md transition"
                                    >
                                      Reject
                                    </button>
                                    <button
                                      onClick={() => handleApproveActionInDrawer(action.id)}
                                      className="px-3.5 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-md font-semibold transition shadow-sm"
                                    >
                                      Approve
                                    </button>
                                  </>
                                )}
                                {canExecute && (
                                  <button
                                    onClick={() => handleExecuteActionInDrawer(action.id)}
                                    className="px-3.5 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold transition shadow-sm"
                                  >
                                    Execute Action
                                  </button>
                                )}
                              </div>
                            )
                          )}

                          {action.execution_result && (
                            <div className="mt-3">
                              <span className="font-semibold text-xs text-slate-500 block mb-1">Execution Outcome:</span>
                              {action.execution_result.result_document ? (
                                <div className="bg-white border border-slate-200 p-4 rounded-lg text-[11px] text-slate-700 leading-relaxed font-sans max-h-60 overflow-y-auto shadow-2xs">
                                  {action.execution_result.result_document.split('\n').map((line: string, idx: number) => {
                                    const trimmed = line.trim();
                                    if (trimmed.startsWith('# ')) {
                                      return <h4 key={idx} className="font-bold text-xs text-slate-900 mt-2 mb-1 border-b pb-0.5">{trimmed.substring(2)}</h4>;
                                    }
                                    if (trimmed.startsWith('## ')) {
                                      return <h5 key={idx} className="font-bold text-[11px] text-slate-800 mt-2 mb-1">{trimmed.substring(3)}</h5>;
                                    }
                                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                                      return (
                                        <div key={idx} className="pl-3 py-0.5 flex items-start space-x-1.5">
                                          <span className="text-slate-400 font-bold shrink-0 mt-0.5">•</span>
                                          <span>{trimmed.substring(2)}</span>
                                        </div>
                                      );
                                    }
                                    if (trimmed === '') {
                                      return <div key={idx} className="h-1.5" />;
                                    }
                                    return <p key={idx} className="mb-1">{trimmed}</p>;
                                  })}
                                </div>
                              ) : (
                                <div className="bg-slate-100 p-3 rounded-lg text-xs font-mono text-slate-600 border border-slate-200 overflow-x-auto">
                                  <pre className="whitespace-pre-wrap">{JSON.stringify(action.execution_result, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                  {selectedTask.feedbacks?.map((f: any, i: number) => (
                    <div key={`db-${f.id || i}`} className="bg-slate-50 p-3 rounded border">
                      <p className="text-slate-800">{f.text}</p>
                      <p className="text-xs text-slate-400 mt-2">Not yet approved for reusable memory</p>
                    </div>
                  ))}
                  {feedbacks.filter(f => f.taskId === selectedTask.id && !selectedTask.feedbacks?.some((dbF: any) => dbF.text === f.text)).map((f, i) => (
                    <div key={`local-${i}`} className="bg-slate-50 p-3 rounded border">
                      <p className="text-slate-800">{f.text}</p>
                      <p className="text-xs text-slate-400 mt-2">Not yet approved for reusable memory</p>
                    </div>
                  ))}
                  
                  <div className="border-t pt-3 mt-3">
                    <h5 id="feedback-section-header" className="font-medium mb-1 text-slate-800">Add Feedback & Steering Guidance</h5>
                    <p className="text-slate-400 text-xs mb-2">Use this form to specify corrections, provide additional data, or suggest edits to resolve any requested revisions before rerunning the agent.</p>
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
          topicId={topicId}
          onClose={() => setShowDailyPlan(false)} 
          onStart={(workflowRunId) => {
            setCurrentWorkflowRunId(workflowRunId);
            setShowDailyPlan(false);
            setShowExecutionPanel(true);
          }}
        />
      )}

      <TaskCreateDrawer 
        topicId={topicId}
        isOpen={showTaskDrawer}
        onClose={() => setShowTaskDrawer(false)}
        onSubmit={handleProposeTask}
        workstreams={topic?.workstreams || []}
      />

      {showExecutionPanel && (
        <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/20 p-8" onClick={() => setShowExecutionPanel(false)}>
           <div onClick={e => e.stopPropagation()} className="w-full max-w-5xl">
             <WorkflowExecutionPanel 
               workflowRunId={currentWorkflowRunId}
               onClose={() => setShowExecutionPanel(false)} 
               autoStart={true} 
             />
           </div>
        </div>
      )}
    </div>
  );
}
