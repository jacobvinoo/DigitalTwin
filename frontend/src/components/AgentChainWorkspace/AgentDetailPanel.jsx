import React, { useState, useEffect } from 'react';
import { X, Maximize2, Minimize2, Settings, Activity, Play, Loader, Trash2 } from 'lucide-react';
import { api } from '../../api';
import AgentConfigPanel from './AgentConfigPanel';
import TraceabilitySidePanel from './TraceabilitySidePanel';

const AgentDetailPanel = ({ selectedNode, selectedTrace, onClose, onRunComplete, onDeleteAgent }) => {
  const [activeView, setActiveView] = useState('config'); // 'config' | 'trace'
  const [isExpanded, setIsExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Automatically switch to trace view if a trace is provided (e.g. after running)
  useEffect(() => {
    if (selectedTrace) {
      setActiveView('trace');
    }
  }, [selectedTrace]);

  const agentId = selectedNode.data.backendId || selectedNode.id;
  const agentName = selectedNode.data.name;

  const handleRunNode = async () => {
    try {
      setRunning(true);
      setRunStatus('Starting node execution...');
      // Start the progress bar
      const response = await api.post(`/api/agents/${agentId}/run/`);
      setRunStatus('Execution complete!');
      setErrorMsg('');
      setTimeout(() => setRunStatus(''), 3000);
      if (onRunComplete && response.data.trace) {
        onRunComplete(response.data.trace);
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.error || err.response?.data?.detail || err.message || "An unknown error occurred during execution.";
      setErrorMsg(`Agent Run Failed: ${errorMessage}`);
      setRunStatus('Error during execution');
      setTimeout(() => setRunStatus(''), 3000);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={`bg-white border-l border-gray-200 flex flex-col h-full shadow-2xl z-20 transition-all duration-300 relative ${isExpanded ? 'w-[48rem]' : 'w-96'}`}>
      
      {/* Global Progress Bar */}
      {running && (
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-100 overflow-hidden z-50">
          <div className="h-full bg-indigo-600 animate-pulse transition-all duration-[3000ms] ease-in-out" style={{ width: '80%' }}></div>
        </div>
      )}

      {/* Master Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-3 shrink-0">
        
        {errorMsg && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-2 rounded shadow-sm flex items-start justify-between">
            <div className="text-red-800 text-xs flex-1">
              <span className="font-semibold block mb-1">Execution Error</span>
              <p className="break-words">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-red-500 hover:text-red-700 ml-3 p-1 rounded hover:bg-red-100 transition-colors">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              {agentName}
              {running && <Loader size={14} className="animate-spin text-indigo-600" />}
            </h2>
            <span className="text-xs text-gray-500 font-mono">ID: {agentId}</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRunNode} 
              disabled={running}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
            >
              {running ? <Loader size={14} className="animate-spin" /> : <Play size={14} />} 
              {running ? 'Running...' : 'Run'}
            </button>
            <div className="w-px h-6 bg-gray-300 mx-1"></div>
            {onDeleteAgent && (
              <button 
                onClick={onDeleteAgent} 
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                title="Delete Agent"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button 
              onClick={() => setIsExpanded(!isExpanded)} 
              className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
              title={isExpanded ? "Collapse Panel" : "Expand Panel"}
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button 
              onClick={onClose} 
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Master Tabs */}
        <div className="flex bg-gray-200/50 p-1 rounded-lg">
          <button
            onClick={() => setActiveView('config')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-semibold rounded-md transition-all ${
              activeView === 'config' 
                ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            <Settings size={14} /> Configuration
          </button>
          <button
            onClick={() => setActiveView('trace')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-semibold rounded-md transition-all relative ${
              activeView === 'trace' 
                ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            {running && activeView !== 'trace' && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
            )}
            <Activity size={14} /> Execution Trace
          </button>
        </div>
        {runStatus && (
          <div className={`text-xs font-medium px-2 py-1 rounded border text-center ${runStatus.includes('Error') ? 'bg-red-50 text-red-600 border-red-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
            {runStatus}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col relative bg-white">
        {activeView === 'config' ? (
          <AgentConfigPanel 
            agentId={agentId} 
            agentName={agentName} 
            hideOuter={true}
          />
        ) : (
          selectedTrace ? (
            <TraceabilitySidePanel 
              selectedTrace={selectedTrace} 
              onClose={onClose}
              hideOuter={true}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
              <Activity size={48} className="text-gray-200 mb-4" />
              <h3 className="text-sm font-semibold text-gray-700 mb-1">No Trace Available</h3>
              <p className="text-xs text-gray-400">Run the node from the Configuration tab to generate an execution trace.</p>
            </div>
          )
        )}
      </div>

    </div>
  );
};

export default AgentDetailPanel;
