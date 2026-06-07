import React, { useState } from 'react';

interface Workstream {
  id: number;
  title: string;
}

interface TaskCreateDrawerProps {
  topicId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  workstreams: Workstream[];
}

export const TaskCreateDrawer = ({ topicId, isOpen, onClose, onSubmit, workstreams }: TaskCreateDrawerProps) => {
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState('competitive_research');
  const [workstreamId, setWorkstreamId] = useState('');
  const [riskLevel, setRiskLevel] = useState('low');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const payload: any = {
      topic: Number(topicId),
      title,
      task_type: taskType,
      risk_level: riskLevel,
      inputs: {
        description
      }
    };

    if (workstreamId) {
      payload.workstream = Number(workstreamId);
    }

    await onSubmit(payload);
    setLoading(false);
    
    // Reset fields
    setTitle('');
    setTaskType('competitive_research');
    setWorkstreamId('');
    setRiskLevel('low');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl p-6 z-50 overflow-y-auto animate-in slide-in-from-right duration-200 border-l border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Propose New Task</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-semibold">&times;</button>
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="task-title" className="block text-sm font-semibold text-slate-700 mb-1">Task Title</label>
          <input 
            id="task-title"
            type="text" 
            className="w-full border border-slate-200 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white"
            placeholder="e.g. Consolidate search logs"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="task-description" className="block text-sm font-semibold text-slate-700 mb-1">Task Details / Instructions</label>
          <textarea 
            id="task-description"
            className="w-full border border-slate-200 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white h-28"
            placeholder="Describe what the agent should do..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="task-type" className="block text-sm font-semibold text-slate-700 mb-1">Task Type</label>
          <select 
            id="task-type"
            className="w-full border border-slate-200 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" 
            value={taskType} 
            onChange={(e) => setTaskType(e.target.value)}
          >
            <option value="competitive_research">Competitive Research</option>
            <option value="metrics_definition">Metrics Definition</option>
            <option value="implementation_plan">Implementation Plan</option>
            <option value="risk_analysis">Risk Analysis</option>
            <option value="product_strategy">Product Strategy</option>
            <option value="roadmap">Roadmap Focus</option>
            <option value="execution_tracking">Execution Tracking</option>
            <option value="housekeeping">Housekeeping / Document Review</option>
            <option value="generic">Generic/Focus Task</option>
          </select>
        </div>

        <div>
          <label htmlFor="task-workstream" className="block text-sm font-semibold text-slate-700 mb-1">Workstream</label>
          <select 
            id="task-workstream"
            className="w-full border border-slate-200 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" 
            value={workstreamId} 
            onChange={(e) => setWorkstreamId(e.target.value)}
          >
            <option value="">No Workstream (General)</option>
            {workstreams.map(ws => (
              <option key={ws.id} value={ws.id}>{ws.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="task-risk" className="block text-sm font-semibold text-slate-700 mb-1">Risk Level</label>
          <select 
            id="task-risk"
            className="w-full border border-slate-200 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" 
            value={riskLevel} 
            onChange={(e) => setRiskLevel(e.target.value)}
          >
            <option value="low">Low Risk (Auto-execute)</option>
            <option value="medium">Medium Risk (Requires approval)</option>
            <option value="high">High Risk (Hard stop governance)</option>
          </select>
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          className="bg-black hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg mt-4 disabled:opacity-50 transition shadow-sm active:scale-95 text-sm"
        >
          {loading ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  );
};
