import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, BarChart2, Undo2, CheckCircle, AlertTriangle, XCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../../api';

export default function ImprovementDashboard({ topicId, refreshKey }) {
  const [stats, setStats] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, expRes] = await Promise.all([
        api.get('/api/experiments/dashboard_stats/'),
        api.get('/api/experiments/')
      ]);
      setStats(statsRes.data);
      setExperiments(expRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [topicId, refreshKey]);

  const handleRollback = async (id) => {
    try {
      const exp = experiments.find(e => e.id === id);
      if (!exp || !exp.recommendation) return;
      await api.post(`/api/recommendations/${exp.recommendation}/rollback/`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to rollback improvement.");
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading dashboard...</div>;
  if (!stats) return <div className="p-8 text-red-500">Failed to load stats.</div>;

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Improvement Dashboard</h1>
          <p className="text-slate-500 mt-1">Track the impact of applied agent improvements and A/B experiments.</p>
        </div>

        {/* Top-Level KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Pending</p>
              <p className="text-3xl font-bold text-amber-600">{stats.pending_recommendations || 0}</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg"><Activity size={20} className="text-amber-600" /></div>
          </div>
          
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Monitoring</p>
              <p className="text-3xl font-bold text-blue-600">{stats.experiments_monitoring || 0}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg"><BarChart2 size={20} className="text-blue-600" /></div>
          </div>
          
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Successful</p>
              <p className="text-3xl font-bold text-green-600">{stats.successful_improvements}</p>
            </div>
            <div className="p-2 bg-green-50 rounded-lg"><CheckCircle size={20} className="text-green-600" /></div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Failed</p>
              <p className="text-3xl font-bold text-red-600">{stats.failed_improvements}</p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg"><XCircle size={20} className="text-red-600" /></div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Avg Score Impact</p>
              <div className={`flex items-center gap-1 text-3xl font-bold ${stats.average_score_impact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.average_score_impact >= 0 ? '+' : ''}{stats.average_score_impact}
              </div>
            </div>
            <div className={`p-2 rounded-lg ${stats.average_score_impact >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              {stats.average_score_impact >= 0 ? <TrendingUp size={20} className="text-green-600" /> : <TrendingDown size={20} className="text-red-600" />}
            </div>
          </div>
        </div>

        {/* Pending Recommendations Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <Activity className="text-slate-400" size={18} />
            <h2 className="text-lg font-semibold text-slate-800">Pending Improvement Recommendations</h2>
          </div>
          <div className="p-0 overflow-x-auto">
            {stats.pending_recommendations_list?.length === 0 ? (
              <div className="p-5 text-slate-500 text-sm">No pending recommendations to review.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="p-4 font-medium border-b border-slate-100">Agent</th>
                    <th className="p-4 font-medium border-b border-slate-100">Issue Type</th>
                    <th className="p-4 font-medium border-b border-slate-100 w-1/3">Proposed Fix</th>
                    <th className="p-4 font-medium border-b border-slate-100 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                  {stats.pending_recommendations_list?.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-900">{rec.agent_name}</td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-800">{rec.issue_type}</span>
                        <p className="text-xs text-slate-500 mt-1 truncate max-w-[200px]" title={rec.problem}>{rec.problem}</p>
                      </td>
                      <td className="p-4 text-xs text-slate-600 whitespace-pre-wrap max-w-sm font-mono bg-slate-50/50">
                        {rec.recommended_change}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button 
                          onClick={async () => {
                            try {
                              await api.post(`/api/recommendations/${rec.id}/accept/`);
                              fetchData();
                            } catch (err) {
                              alert("Failed to accept recommendation.");
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                        >
                          <CheckCircle size={14} /> Accept
                        </button>
                        <button 
                          onClick={async () => {
                            try {
                              await api.post(`/api/recommendations/${rec.id}/reject/`);
                              fetchData();
                            } catch (err) {
                              alert("Failed to reject recommendation.");
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recurring Weaknesses */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden col-span-1">
            <div className="p-5 border-b border-slate-100 flex items-center gap-2">
              <ShieldAlert className="text-slate-400" size={18} />
              <h2 className="text-lg font-semibold text-slate-800">Top Recurring Weaknesses</h2>
            </div>
            <div className="p-0">
              {stats.top_recurring_weaknesses.length === 0 ? (
                <div className="p-5 text-slate-500 text-sm">No recurring weaknesses detected yet.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {stats.top_recurring_weaknesses.map((weakness, i) => (
                    <li key={i} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{weakness.issue}</p>
                        <p className="text-xs text-slate-500 mt-1">Agent: {weakness.agent}</p>
                      </div>
                      <div className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">
                        {weakness.count}x
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Active A/B Experiments Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden col-span-2">
            <div className="p-5 border-b border-slate-100 flex items-center gap-2">
              <BarChart2 className="text-slate-400" size={18} />
              <h2 className="text-lg font-semibold text-slate-800">Experiment Tracking</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="p-4 font-medium border-b border-slate-100">ID</th>
                    <th className="p-4 font-medium border-b border-slate-100">Status</th>
                    <th className="p-4 font-medium border-b border-slate-100">Runs</th>
                    <th className="p-4 font-medium border-b border-slate-100">Baseline</th>
                    <th className="p-4 font-medium border-b border-slate-100">Post-Change</th>
                    <th className="p-4 font-medium border-b border-slate-100">Delta</th>
                    <th className="p-4 font-medium border-b border-slate-100 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                  {experiments.length === 0 && (
                    <tr>
                      <td colSpan="7" className="p-4 text-center text-slate-500">No experiments running.</td>
                    </tr>
                  )}
                  {experiments.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-900">EXP-{exp.id}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold 
                          ${exp.status === 'successful' ? 'bg-green-100 text-green-800' : 
                            exp.status === 'failed' ? 'bg-red-100 text-red-800' : 
                            exp.status === 'rolled_back' ? 'bg-slate-200 text-slate-700' : 
                            'bg-blue-100 text-blue-800'}`}>
                          {exp.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">{exp.runs_observed}</td>
                      <td className="p-4">{exp.baseline_score ? exp.baseline_score.toFixed(1) : '-'}</td>
                      <td className="p-4">{exp.post_change_score ? exp.post_change_score.toFixed(1) : '-'}</td>
                      <td className="p-4">
                        {exp.delta !== null && exp.delta !== undefined ? (
                          <span className={`font-semibold ${exp.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {exp.delta >= 0 ? '+' : ''}{exp.delta.toFixed(2)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-right">
                        {(exp.status === 'monitoring' || exp.status === 'failed' || exp.status === 'successful') && (
                          <button 
                            onClick={() => handleRollback(exp.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
                          >
                            <Undo2 size={14} />
                            Rollback
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
