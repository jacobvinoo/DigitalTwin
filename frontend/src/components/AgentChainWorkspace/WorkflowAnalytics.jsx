import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, Clock, TrendingUp, TrendingDown, AlertTriangle, ShieldAlert, BarChart2 } from 'lucide-react';
import api from '../../api';

export default function WorkflowAnalytics({ topicId }) {
  const [data, setData] = useState({ metrics: [], recommendations: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!topicId) return;
    api.get(`/api/topics/${topicId}/workflow-analytics/`)
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(console.error);
  }, [topicId]);

  const handleAccept = async (id) => {
    try {
      await api.post(`/api/recommendations/${id}/accept/`);
      setData(prev => ({
        ...prev,
        recommendations: prev.recommendations.filter(r => r.id !== id)
      }));
    } catch (err) {
      console.error(err);
      alert("Failed to accept recommendation.");
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/api/recommendations/${id}/reject/`);
      setData(prev => ({
        ...prev,
        recommendations: prev.recommendations.filter(r => r.id !== id)
      }));
    } catch (err) {
      console.error(err);
      alert("Failed to reject recommendation.");
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading analytics...</div>;

  const kpis = data.overall_kpis || {
    avg_chain_score: "0.0",
    improvement_adoption_rate: "0.0",
    avg_revisions: "0.0",
    hallucination_risk: "0.0"
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Workflow Analytics</h1>
            <p className="text-slate-500 mt-1">Track the quality and performance of your agents.</p>
          </div>
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-sm text-slate-600 font-medium">
            Last 30 Days
          </div>
        </div>

        {/* Top-Level KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Avg Chain Score</p>
              <p className="text-3xl font-bold text-indigo-700">{kpis.avg_chain_score}<span className="text-lg text-slate-400 font-normal">/10</span></p>
            </div>
            <div className="p-2 bg-indigo-50 rounded-lg"><Activity size={20} className="text-indigo-600" /></div>
          </div>
          
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Improvement Adoption Rate</p>
              <p className="text-3xl font-bold text-green-600">{kpis.improvement_adoption_rate}<span className="text-lg text-slate-400 font-normal">%</span></p>
            </div>
            <div className="p-2 bg-green-50 rounded-lg"><CheckCircle size={20} className="text-green-600" /></div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Avg Revisions</p>
              <p className="text-3xl font-bold text-amber-600">{kpis.avg_revisions}</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg"><Clock size={20} className="text-amber-600" /></div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Hallucination Risk</p>
              <p className="text-3xl font-bold text-red-600">{kpis.hallucination_risk}<span className="text-lg text-slate-400 font-normal">%</span></p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg"><ShieldAlert size={20} className="text-red-600" /></div>
          </div>
        </div>

        {/* Agent Metrics Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <BarChart2 className="text-slate-400" size={18} />
            <h2 className="text-lg font-semibold text-slate-800">Agent Performance Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <th className="p-4 font-medium border-b border-slate-100">Agent Node</th>
                  <th className="p-4 font-medium border-b border-slate-100">Executions</th>
                  <th className="p-4 font-medium border-b border-slate-100">Exec. Score</th>
                  <th className="p-4 font-medium border-b border-slate-100">Trend</th>
                  <th className="p-4 font-medium border-b border-slate-100">Adoption</th>
                  <th className="p-4 font-medium border-b border-slate-100">Revisions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                {data.metrics.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-900">{m.agent}</td>
                    <td className="p-4">{m.executions}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${m.score >= 8 ? 'bg-green-100 text-green-800' : m.score >= 6 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                        {m.score}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className={`flex items-center gap-1 font-medium ${m.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {m.trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} className="text-red-600" />}
                        {Math.abs(m.trend)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-slate-200 rounded-full h-2 max-w-[60px]">
                          <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${m.adoption}%` }}></div>
                        </div>
                        <span>{m.adoption}%</span>
                      </div>
                    </td>
                    <td className="p-4">{m.revisions}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Alerts / Warning Panel */}
        {data.recommendations.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Improvement Recommendations</h3>
            {data.recommendations.map(rec => (
              <div key={rec.id} className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-4">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={24} />
                <div className="flex-1">
                  <h4 className="text-amber-900 font-bold mb-1">Low Score Detected: {rec.agent__name}</h4>
                  <p className="text-amber-800 text-sm mb-2">
                    <strong>Evaluator Feedback ({rec.issue_type}):</strong> {rec.problem}
                  </p>
                  <div className="bg-white p-3 rounded border border-amber-100 text-sm text-slate-700 font-mono">
                    <strong>Suggested Fix:</strong> {rec.recommended_change}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => handleAccept(rec.id)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                      Apply Fix
                    </button>
                    <button onClick={() => handleReject(rec.id)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
