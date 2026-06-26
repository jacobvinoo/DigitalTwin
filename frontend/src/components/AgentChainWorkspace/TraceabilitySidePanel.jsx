import React, { useState } from 'react';
import { Activity, Code, FileJson, CheckCircle, Clock, X, BarChart2, FileText, Link as LinkIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const TraceabilitySidePanel = ({ selectedTrace, onClose, hideOuter }) => {
  const [activeTab, setActiveTab] = useState('input');

  if (!selectedTrace) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full" data-testid="config-panel">
        <div className="p-4 border-b border-gray-200 flex items-center gap-2">
          <Activity size={18} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-800">Trace</h2>
        </div>
        <div className="p-4 flex-1 flex items-center justify-center text-center text-gray-500">
          Select a node to view its execution trace
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'input':
        return (
          <pre className="text-xs text-gray-700 bg-gray-50 p-3 rounded-lg border overflow-auto">
            {JSON.stringify(selectedTrace.input_payload, null, 2)}
          </pre>
        );
      case 'prompt':
        return (
          <div className="space-y-4">
            {selectedTrace.prompt_traces ? (
              selectedTrace.prompt_traces.map((pt, idx) => (
                <div key={idx} className="bg-blue-50 rounded-lg border border-blue-100 overflow-hidden">
                  <div className="bg-blue-100 px-3 py-1.5 flex justify-between items-center border-b border-blue-200">
                    <span className="text-xs font-semibold text-blue-900">{pt.template_name}</span>
                    <span className="text-[10px] font-mono bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded">v{pt.version}</span>
                  </div>
                  <div className="p-3 text-sm text-gray-800 whitespace-pre-wrap font-mono text-xs">
                    {pt.snapshot}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-800 bg-blue-50 p-3 rounded-lg border border-blue-100 whitespace-pre-wrap">
                {selectedTrace.prompt_snapshot || "No prompt trace available."}
              </div>
            )}
          </div>
        );
      case 'output':
        const markdown = selectedTrace.output_payload?.markdown_content || selectedTrace.output_payload?.result || "No markdown content returned.";
        return (
          <div className="bg-white p-4 rounded-lg border border-gray-200 overflow-auto prose prose-sm max-w-none text-gray-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </div>
        );
      case 'sources':
        const sources = selectedTrace.output_payload?.sources || [];
        if (sources.length === 0) {
          return (
            <div className="text-center p-6 text-gray-500 text-sm bg-gray-50 rounded-lg border border-gray-200">
              No sources were documented for this execution.
            </div>
          );
        }
        return (
          <div className="space-y-3">
            {sources.map((src, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <LinkIcon size={14} className="text-blue-500" />
                  <span className="font-semibold text-gray-800 text-sm">{src.title}</span>
                </div>
                {src.url && (
                  <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all ml-5">
                    {src.url}
                  </a>
                )}
                <div className="flex items-center gap-3 mt-1 ml-5">
                  {src.publisher && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">{src.publisher}</span>}
                  <span className="text-[10px] text-gray-400 capitalize">{src.source_type}</span>
                </div>
              </div>
            ))}
          </div>
        );
      case 'evaluations':
        return (
          <div className="space-y-3">
            {selectedTrace.evaluations && selectedTrace.evaluations.length > 0 ? (
              selectedTrace.evaluations.map((ev, idx) => (
                <div key={idx} className={`p-3 rounded-lg border ${ev.passed ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-semibold text-sm ${ev.passed ? 'text-emerald-900' : 'text-red-900'}`}>{ev.evaluator}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ev.passed ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>Score: {ev.score}/10</span>
                  </div>
                  {ev.feedback && ev.feedback !== "No direct feedback key." && (
                    <p className="text-xs text-gray-700 mt-2">{ev.feedback}</p>
                  )}
                  {ev.rich_output && ev.rich_output.metric_scores && (
                    <div className="mt-3 bg-white bg-opacity-60 rounded p-2 border border-gray-200 border-opacity-50">
                      <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Metric Breakdown</div>
                      <div className="grid grid-cols-2 gap-1">
                        {Object.entries(ev.rich_output.metric_scores).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-xs">
                            <span className="text-gray-600 capitalize">{k.replace(/_/g, ' ')}:</span>
                            <span className="font-semibold">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {ev.rich_output && ev.rich_output.weaknesses && ev.rich_output.weaknesses.length > 0 && (
                    <div className="mt-2 text-xs">
                      <div className="text-[10px] uppercase font-bold text-red-500 mb-1">Weaknesses</div>
                      <ul className="list-disc pl-4 text-red-800 space-y-0.5">
                        {ev.rich_output.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}
                  {ev.rich_output && ev.rich_output.strengths && ev.rich_output.strengths.length > 0 && (
                    <div className="mt-2 text-xs">
                      <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Strengths</div>
                      <ul className="list-disc pl-4 text-emerald-800 space-y-0.5">
                        {ev.rich_output.strengths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 text-center p-4">No evaluations executed.</div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`bg-white flex flex-col h-full ${hideOuter ? 'w-full flex-1 overflow-hidden' : 'w-96 border-l border-gray-200 shadow-lg z-10'}`} data-testid="trace-panel">
      {/* Header */}
      {!hideOuter && (
        <div className="p-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-800">Execution Trace</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-800">
                <CheckCircle size={12} /> {selectedTrace.status}
              </span>
              <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
          </div>
          <h3 className="font-medium text-gray-900">{selectedTrace.agentName || selectedTrace.agent_name}</h3>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
        <button
          onClick={() => setActiveTab('input')}
          className={`flex-1 py-2 text-sm font-medium border-b-2 flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'input' ? 'border-blue-500 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileJson size={14} /> Input
        </button>
        <button
          onClick={() => setActiveTab('prompt')}
          className={`flex-1 py-2 text-sm font-medium border-b-2 flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'prompt' ? 'border-blue-500 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Code size={14} /> Prompt
        </button>
        <button 
          onClick={() => setActiveTab('output')}
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'output' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Document
        </button>
        <button 
          onClick={() => setActiveTab('sources')}
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'sources' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Sources
        </button>
        <button
          onClick={() => setActiveTab('evaluations')}
          className={`flex-1 py-2 text-sm font-medium border-b-2 flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'evaluations' ? 'border-blue-500 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart2 size={14} /> Metrics
        </button>
      </div>

      {/* Content Area */}
      <div className="p-4 flex-1 overflow-y-auto bg-white">
        {renderContent()}
      </div>
    </div>
  );
};

export default TraceabilitySidePanel;
