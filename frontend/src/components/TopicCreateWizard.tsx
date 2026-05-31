import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface TopicCreateWizardProps {
  onSubmit: (data: { title: string; objective: string; strategicContext: string }) => void;
}

export default function TopicCreateWizard({ onSubmit }: TopicCreateWizardProps) {
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [strategicContext, setStrategicContext] = useState('');
  const [notes, setNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ title, objective, strategicContext });
    setIsSuccess(true);
    // Redirect to command centre after a brief delay
    setTimeout(() => {
      navigate('/topics/1/command-centre');
    }, 1000);
  };

  if (isSuccess) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-green-600 mb-2">Strategy workspace created</h1>
        <p className="text-slate-600">Redirecting to Command Centre...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Create Strategy Workspace</h1>
        <p className="text-sm text-slate-500 mt-2">
          Define the topic, objective, and strategic context. StrategyPad will create
          the workstreams, task ledger, and approval structure.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="topic-title" className="block text-sm font-medium text-slate-700">Topic</label>
            <input
              id="topic-title"
              name="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 p-2"
              required
            />
          </div>

          <div>
            <label htmlFor="topic-objective" className="block text-sm font-medium text-slate-700">Objective</label>
            <textarea
              id="topic-objective"
              name="objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 p-2"
              rows={3}
              required
            />
          </div>

          <div>
            <label htmlFor="topic-context" className="block text-sm font-medium text-slate-700">Strategic context</label>
            <textarea
              id="topic-context"
              name="strategic_context"
              value={strategicContext}
              onChange={(e) => setStrategicContext(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 p-2"
              rows={3}
            />
          </div>

          <div>
            <label htmlFor="topic-notes" className="block text-sm font-medium text-slate-700">Optional notes</label>
            <textarea
              id="topic-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 p-2"
              rows={2}
            />
          </div>

          <div className="flex items-center space-x-4 pt-4">
            <button
              type="submit"
              disabled={isSuccess}
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSuccess ? 'Creating...' : 'Create Strategy Workspace'}
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              Save Draft
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border bg-slate-50 p-6">
        <h2 className="text-lg font-semibold">Workspace Preview</h2>
        <div className="mt-4 space-y-3">
          <div className="rounded-md bg-white p-3 shadow-sm border">
            <h3 className="font-medium text-slate-800">Competitive Analysis</h3>
          </div>
          <div className="rounded-md bg-white p-3 shadow-sm border">
            <h3 className="font-medium text-slate-800">Market Metrics</h3>
          </div>
          <div className="rounded-md bg-white p-3 shadow-sm border">
            <h3 className="font-medium text-slate-800">Algolia Implementation Plan</h3>
          </div>
          <div className="rounded-md bg-white p-3 shadow-sm border">
            <h3 className="font-medium text-slate-800">Risk Analysis</h3>
          </div>
          <div className="rounded-md bg-white p-3 shadow-sm border">
            <h3 className="font-medium text-slate-800">Product Strategy</h3>
          </div>
          <div className="rounded-md bg-white p-3 shadow-sm border">
            <h3 className="font-medium text-slate-800">Roadmap</h3>
          </div>
          <div className="rounded-md bg-white p-3 shadow-sm border">
            <h3 className="font-medium text-slate-800">Execution Tracking</h3>
          </div>
        </div>

        <div className="mt-8 rounded-md bg-blue-50 p-4 border border-blue-100">
          <h3 className="text-sm font-semibold text-blue-900">Approval Model</h3>
          <ul className="mt-2 text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Low-risk tasks auto-created.</li>
            <li>Medium-risk tasks require approval before execution.</li>
            <li>High-risk actions always require explicit approval.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
