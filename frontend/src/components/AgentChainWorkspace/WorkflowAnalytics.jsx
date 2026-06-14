import React from 'react';
import { Activity, CheckCircle, Clock, TrendingUp, TrendingDown, AlertTriangle, ShieldAlert, BarChart2 } from 'lucide-react';

const mockAnalyticsData = [
  { id: 1, agent: 'Web Researcher', score: 8.9, trend: 1.2, acceptance: 92, revisions: 1.1, executions: 145 },
  { id: 2, agent: 'Summarizer', score: 7.2, trend: -0.5, acceptance: 78, revisions: 2.4, executions: 145 },
  { id: 3, agent: 'Report Writer', score: 9.4, trend: 0.2, acceptance: 96, revisions: 1.0, executions: 142 }
];

export default function WorkflowAnalytics() {
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
              <p className="text-3xl font-bold text-indigo-700">8.5<span className="text-lg text-slate-400 font-normal">/10</span></p>
            </div>
            <div className="p-2 bg-indigo-50 rounded-lg"><Activity size={20} className="text-indigo-600" /></div>
          </div>
          
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Acceptance Rate</p>
              <p className="text-3xl font-bold text-green-600">88.6<span className="text-lg text-slate-400 font-normal">%</span></p>
            </div>
            <div className="p-2 bg-green-50 rounded-lg"><CheckCircle size={20} className="text-green-600" /></div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Avg Revisions</p>
              <p className="text-3xl font-bold text-amber-600">1.5</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg"><Clock size={20} className="text-amber-600" /></div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Hallucination Risk</p>
              <p className="text-3xl font-bold text-red-600">1.2<span className="text-lg text-slate-400 font-normal">%</span></p>
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
                  <th className="p-4 font-medium border-b border-slate-100">Acceptance</th>
                  <th className="p-4 font-medium border-b border-slate-100">Revisions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                {mockAnalyticsData.map((data) => (
                  <tr key={data.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-900">{data.agent}</td>
                    <td className="p-4">{data.executions}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${data.score >= 8 ? 'bg-green-100 text-green-800' : data.score >= 6 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                        {data.score}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className={`flex items-center gap-1 font-medium ${data.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {data.trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} className="text-red-600" />}
                        {Math.abs(data.trend)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-slate-200 rounded-full h-2 max-w-[60px]">
                          <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${data.acceptance}%` }}></div>
                        </div>
                        <span>{data.acceptance}%</span>
                      </div>
                    </td>
                    <td className="p-4">{data.revisions}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Alerts / Warning Panel */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-amber-800 font-semibold mb-1">Attention Required: Summarizer Node</h3>
            <p className="text-amber-700 text-sm">
              The "Summarizer" agent has experienced a score drop of 0.5 points over the last 7 days, primarily due to an increase in revision requests related to "Hallucination Check". We recommend reviewing the Prompt Template for this node.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
