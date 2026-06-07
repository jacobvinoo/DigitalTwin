import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Project {
  id: number;
  title: string;
  description: string;
  strategic_context: string;
  status: string;
  created_at: string;
  updated_at: string;
  tasks_count: number;
  completed_tasks_count: number;
  active_tasks_count: number;
  pending_approvals_count: number;
  workstreams_count: number;
}

export default function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await api.get<Project[]>('/api/topics/');
        setProjects(response.data);
      } catch (err) {
        console.error('Failed to load projects:', err);
        setError('Failed to load projects. Please ensure the backend is running.');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const handleDeleteProject = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This will permanently delete all workstreams, tasks, actions, and workflow history.`)) {
      return;
    }
    try {
      await api.delete(`/api/topics/${id}/`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      console.error('Failed to delete project:', err);
      if (err.message && err.message.includes('404')) {
        // If it's already gone from the server, just filter it out of local state
        setProjects((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert('Failed to delete project. Please try again.');
      }
    }
  };

  // Filter projects based on search and status
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || project.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Calculate high-level summary metrics
  const totalProjects = projects.length;
  const totalTasks = projects.reduce((acc, p) => acc + p.tasks_count, 0);
  const completedTasks = projects.reduce((acc, p) => acc + p.completed_tasks_count, 0);
  const totalActiveTasks = projects.reduce((acc, p) => acc + p.active_tasks_count, 0);
  const totalPendingApprovals = projects.reduce((acc, p) => acc + p.pending_approvals_count, 0);

  const overallCompletionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'draft':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'paused':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'completed':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading your strategy dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm text-center">
          <div className="h-12 w-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Connection Error</h2>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12">
      {/* Dynamic Header */}
      <header className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 py-10 px-6 sm:px-12 text-white shadow-md overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.15),transparent_40%)]"></div>
        <div className="relative max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-100">
              StrategyPad Control Centre
            </h1>
            <p className="mt-2 text-slate-300 text-sm sm:text-base max-w-xl">
              Access your configured strategic workspaces, track action execution progress, and review agent decisions.
            </p>
          </div>
          <div>
            <button
              onClick={() => navigate('/topics/new')}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Create Strategy Workspace
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 sm:px-12 mt-8 space-y-8">
        {/* Statistics Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Workspaces</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalProjects}</h3>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Completion Rate</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{overallCompletionRate}%</h3>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="rounded-xl bg-sky-50 p-3 text-sky-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Tasks</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalActiveTasks}</h3>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4 transition-all hover:shadow-md relative">
            <div className={`rounded-xl p-3 ${totalPendingApprovals > 0 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-50 text-slate-500'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Action Required</p>
              <div className="flex items-center gap-2 mt-1">
                <h3 className="text-2xl font-bold text-slate-800">{totalPendingApprovals}</h3>
                {totalPendingApprovals > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                    Awaiting Approval
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Filter / Search Bar */}
        <section className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search strategy workspaces..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {['all', 'active', 'draft', 'paused', 'completed'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all capitalize flex-1 sm:flex-none ${
                  statusFilter === status
                    ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </section>

        {/* Projects Listing */}
        <section>
          {filteredProjects.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="h-16 w-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">No strategy workspaces found</h3>
              <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
                {searchTerm || statusFilter !== 'all'
                  ? "We couldn't find any workspaces matching your active filters. Try resetting your search."
                  : 'Start by creating your first strategy workspace to analyze topics, structure workstreams, and manage execution.'}
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  if (projects.length === 0) {
                    navigate('/topics/new');
                  }
                }}
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
              >
                {projects.length === 0 ? 'Create First Workspace' : 'Clear Filters'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => {
                const completionRate =
                  project.tasks_count > 0
                    ? Math.round((project.completed_tasks_count / project.tasks_count) * 100)
                    : 0;

                return (
                  <div
                    key={project.id}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 duration-200 group overflow-hidden"
                  >
                    {/* Card Upper Section */}
                    <div className="p-6 flex-1 space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(project.status)}`}>
                          {project.status}
                        </span>
                        <div className="flex items-center gap-2">
                          {project.pending_approvals_count > 0 && (
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-4 ring-rose-50 animate-ping"></span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project.id, project.title);
                            }}
                            aria-label={`Delete ${project.title}`}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {project.title}
                        </h3>
                        <p className="mt-1.5 text-xs text-slate-400">
                          Updated {new Date(project.updated_at).toLocaleDateString()}
                        </p>
                      </div>

                      {project.description && (
                        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                          {project.description}
                        </p>
                      )}

                      {/* Metrics section */}
                      <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-100">
                        <div>
                          <p className="text-slate-400 font-medium">Workstreams</p>
                          <p className="text-sm font-bold text-slate-700 mt-0.5">{project.workstreams_count}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Pending Approvals</p>
                          <p className={`text-sm font-bold mt-0.5 ${project.pending_approvals_count > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                            {project.pending_approvals_count}
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-400">Tasks Completed</span>
                          <span className="text-slate-700 font-semibold">{project.completed_tasks_count}/{project.tasks_count} ({completionRate}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${completionRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-between gap-3">
                      <button
                        onClick={() => navigate(`/topics/${project.id}/memory-review`)}
                        className="inline-flex items-center justify-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Memories
                      </button>

                      <button
                        onClick={() => navigate(`/topics/${project.id}/command-centre`)}
                        className="inline-flex items-center justify-center text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors group/btn"
                      >
                        Command Centre
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 transform group-hover/btn:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
