import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Network, Play } from 'lucide-react';

interface AgentChainCreateWizardProps {
  onSubmit: (data: { title: string; objective: string }) => Promise<any> | void;
}

export default function AgentChainCreateWizard({ onSubmit }: AgentChainCreateWizardProps) {
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await onSubmit({ title, objective });
      setIsSuccess(true);
      const topicId = result?.id || 1;
      setTimeout(() => {
        navigate(`/topics/${topicId}/agent-chain`);
      }, 1000);
    } catch (error) {
      console.error('Failed to create agent chain:', error);
    }
  };

  if (isSuccess) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-green-600 mb-2">Agent Chain created</h1>
        <p className="text-slate-600">Redirecting to Interactive Canvas...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 min-h-screen bg-slate-50">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <Network className="text-indigo-600" size={24} />
          </div>
          <h1 className="text-2xl font-semibold">Create Agent Chain Workspace</h1>
        </div>
        <p className="text-sm text-slate-500 mt-2">
          Define the name and description for your custom agent workflow. You will then be able to visually construct the directed acyclic graph (DAG) of AI agents.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="chain-title" className="block text-sm font-medium text-slate-700 mb-1">Workflow Name</label>
            <input
              id="chain-title"
              name="title"
              type="text"
              placeholder="e.g. Daily Research Pipeline"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full rounded-xl border border-slate-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="chain-objective" className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              id="chain-objective"
              name="objective"
              placeholder="Describe what this agent workflow is intended to accomplish..."
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="block w-full rounded-xl border border-slate-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              rows={4}
              required
            />
          </div>

          <div className="flex items-center space-x-4 pt-4">
            <button
              type="submit"
              disabled={isSuccess}
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSuccess ? 'Creating...' : 'Create Agent Chain'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/topics')}
              className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-100 p-6 flex flex-col justify-center">
        <h2 className="text-lg font-semibold text-slate-800 text-center mb-8">What happens next?</h2>
        
        <div className="space-y-6 max-w-sm mx-auto">
          <div className="flex gap-4 items-start bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="bg-emerald-100 p-2 rounded-full mt-1 text-emerald-600">
              <Play size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">1. Setup Trigger</h3>
              <p className="text-xs text-slate-500 mt-1">Configure the entrypoint for your workflow.</p>
            </div>
          </div>
          
          <div className="flex gap-4 items-start bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="bg-blue-100 p-2 rounded-full mt-1 text-blue-600">
              <Bot size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">2. Map Agents</h3>
              <p className="text-xs text-slate-500 mt-1">Link agents together to pass output data logically.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="bg-amber-100 p-2 rounded-full mt-1 text-amber-600">
              <Network size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">3. Execute & Trace</h3>
              <p className="text-xs text-slate-500 mt-1">Run the chain and inspect prompts in real-time.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
