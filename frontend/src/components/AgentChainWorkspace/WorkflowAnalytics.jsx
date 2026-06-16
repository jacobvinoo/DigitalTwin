import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, Clock, TrendingUp, TrendingDown, AlertTriangle, ShieldAlert, BarChart2 } from 'lucide-react';
import { api } from '../../api';

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

  const handleAccept = async (id, applyTo = "agent") => {
    try {
      await api.post(`/api/recommendations/${id}/accept/`, { apply_to: applyTo });
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
    avg_recommendations: "0.0",
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
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Avg Recommendations</p>
              <p className="text-3xl font-bold text-amber-600">{kpis.avg_recommendations}</p>
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
                  <th className="p-4 font-medium border-b border-slate-100">Recommendations</th>
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
                    <td className="p-4">{m.recommendations_count}x</td>
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
              <RecommendationCard 
                key={rec.id} 
                rec={rec} 
                onAccept={handleAccept} 
                onReject={handleReject} 
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

function RecommendationCard({ rec, onAccept, onReject }) {
  const [applyTo, setApplyTo] = useState("agent");

  return (
    <div className="bg-white border border-amber-200 rounded-xl p-5 flex items-start gap-4 shadow-sm">
      <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={28} />
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-slate-900 font-bold text-lg">Target: {rec.agent__name}</h4>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full uppercase tracking-wide">
              {rec.target_area ? rec.target_area.replace('_', ' ') : 'Prompt'}
            </span>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${rec.confidence_score >= 7 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              Confidence: {rec.confidence_score ? rec.confidence_score.toFixed(1) : '5.0'}/10
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Diagnosis ({rec.issue_type})</p>
            <p className="text-slate-700 text-sm whitespace-pre-line mb-2">{rec.root_cause_diagnosis || rec.problem}</p>
            <p className="text-amber-600 text-xs font-semibold flex items-center gap-1 mt-3">
              <ShieldAlert size={14} /> Recurring Issue: Seen {rec.recurring_count || 1} times
            </p>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <p className="text-indigo-500 text-xs font-bold uppercase tracking-wider mb-2">Recommended Fix</p>
            <p className="text-indigo-900 text-sm font-mono whitespace-pre-line">{rec.recommended_change}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Apply to:</label>
            <select 
              value={applyTo} 
              onChange={(e) => setApplyTo(e.target.value)}
              className="text-sm border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="agent">This Agent Only ({rec.agent__name})</option>
              <option value="role">All Agents with this Role</option>
              <option value="workspace">Entire Workspace</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onReject(rec.id)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
              Reject
            </button>
            <button onClick={() => onAccept(rec.id, applyTo)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
              Approve & Monitor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
