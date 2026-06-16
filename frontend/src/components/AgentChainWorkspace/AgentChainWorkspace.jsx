import React, { useState, useEffect, useCallback } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, addEdge as addReactFlowEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Settings, Play, CheckCircle, BarChart2, GitBranch, ArrowLeft, Plus, TrendingUp, FileText, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AgentNode from './AgentNode';
import AgentDetailPanel from './AgentDetailPanel';
import WorkflowAnalytics from './WorkflowAnalytics';
import ImprovementDashboard from './ImprovementDashboard';
import ArtifactsDashboard from './ArtifactsDashboard';
import SystemHealthPanel from './SystemHealthPanel';
import { mapBackendToReactFlow } from '../../utils/agentGraphMapper';
import { api } from '../../api';

const nodeTypes = {
  agentNode: AgentNode,
};

const AgentChainWorkspace = ({ topicId }) => {
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedTrace, setSelectedTrace] = useState(null);
  const [viewMode, setViewMode] = useState('canvas'); // 'canvas' or 'analytics'
  const [loading, setLoading] = useState(true);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  const [topic, setTopic] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  
  // Chain Execution State
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [traces, setTraces] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  // Fetch Graph from Backend
  const loadGraph = useCallback(async () => {
    try {
      setLoading(true);
      const [topicRes, graphRes] = await Promise.all([
        api.get(`/api/topics/${topicId}/`),
        api.get(`/api/topics/${topicId}/agent-graph/`)
      ]);
      setTopic(topicRes.data);
      const { initialNodes, initialEdges } = mapBackendToReactFlow(graphRes.data);
      setNodes(initialNodes);
      setEdges(initialEdges);
    } catch (err) {
      console.error("Failed to load graph", err);
    } finally {
      setLoading(false);
    }
  }, [topicId, setNodes, setEdges]);

  const loadVersions = useCallback(async () => {
    try {
      const res = await api.get(`/api/topics/${topicId}/chain-versions/`);
      setVersions(res.data);
      if (res.data.length > 0 && !selectedVersionId) {
        setSelectedVersionId(res.data[0].id);
      }
    } catch (err) {
      console.error("Failed to load versions", err);
    }
  }, [topicId, selectedVersionId]);

  const loadTraces = useCallback(async (versionId) => {
    if (!versionId) return;
    try {
      const res = await api.get(`/api/chain-versions/${versionId}/trace/`);
      setTraces(res.data);
      
      // Update nodes visual state based on trace
      setNodes(nds => nds.map(n => {
        const t = res.data.find(trace => String(trace.agent_id) === String(n.id) || String(trace.agent_id) === String(n.data?.backendId));
        return {
          ...n,
          data: {
            ...n.data,
            isComplete: t?.status === "completed",
            hasError: t?.status === "failed",
            isRunning: t?.status === "running"
          }
        };
      }));
    } catch (err) {
      console.error("Failed to load traces", err);
    }
  }, [setNodes]);

  useEffect(() => {
    loadGraph();
    loadVersions();
  }, [loadGraph, loadVersions]);

  useEffect(() => {
    if (selectedVersionId) {
      loadTraces(selectedVersionId);
    }
  }, [selectedVersionId, loadTraces]);

  // Polling while running
  useEffect(() => {
    let interval;
    if (isRunning) {
        // Fetch versions to get the newest version if it hasn't popped up yet
        interval = setInterval(async () => {
            try {
                const versionsRes = await api.get(`/api/topics/${topicId}/chain-versions/`);
                setVersions(versionsRes.data);
                if (versionsRes.data.length > 0) {
                    const latestVersion = versionsRes.data[0];
                    if (selectedVersionId !== latestVersion.id) {
                        setSelectedVersionId(latestVersion.id);
                    }
                    await loadTraces(latestVersion.id);
                    
                    if (latestVersion.status === "completed" || latestVersion.status === "failed") {
                        setIsRunning(false);
                        await loadGraph(); // refresh node metrics after run
                        setDashboardRefreshKey(prev => prev + 1);
                    }
                }
            } catch (err) {
                console.error("Polling error:", err);
            }
        }, 3000);
    }
    return () => clearInterval(interval);
  }, [isRunning, topicId, selectedVersionId, loadTraces]);

  const handleSaveTitle = async () => {
    if (!editedTitle.trim()) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await api.patch(`/api/topics/${topicId}/`, { title: editedTitle });
      setTopic(prev => ({ ...prev, title: editedTitle }));
    } catch (err) {
      console.error("Failed to rename workspace", err);
      alert("Failed to rename workspace");
    }
    setIsEditingTitle(false);
  };

  const handleAddNode = async () => {
    try {
      const res = await api.post(`/api/topics/${topicId}/agents/`, {
        name: 'New Agent Node',
        role: 'Assistant',
        system_prompt: 'You are a helpful assistant.',
        model_name: 'gpt-4o',
        is_entrypoint: nodes.length === 0,
        position_x: 250,
        position_y: 250
      });
      loadGraph();
    } catch (err) {
      console.error("Failed to add node", err);
      alert("Failed to add node.");
    }
  };

  const onConnect = useCallback(async (params) => {
    try {
      await api.post(`/api/topics/${topicId}/edges/`, {
        source_agent: params.source,
        target_agent: params.target,
        label: 'data'
      });
      loadGraph();
    } catch (err) {
      console.error("Failed to create edge", err);
      alert("Failed to create connection.");
    }
  }, [topicId, loadGraph]);

  const onNodesDelete = useCallback(async (deletedNodes) => {
    for (const node of deletedNodes) {
      if (window.confirm(`Are you sure you want to delete ${node.data.name}?`)) {
        try {
          await api.delete(`/api/agents/${node.id}/`);
        } catch (err) {
          console.error(`Failed to delete node ${node.id}`, err);
          alert("Failed to delete node.");
        }
      }
    }
    loadGraph();
  }, [loadGraph]);

  const onEdgesDelete = useCallback(async (deletedEdges) => {
    for (const edge of deletedEdges) {
      // React Flow prepends 'e-' to edge IDs in the mapper, so we strip it.
      const edgeId = edge.id.replace('e-', '');
      try {
        await api.delete(`/api/edges/${edgeId}/`);
      } catch (err) {
        console.error(`Failed to delete edge ${edge.id}`, err);
        alert("Failed to delete connection.");
      }
    }
    loadGraph();
  }, [loadGraph]);

  const onNodeDragStop = useCallback(async (event, node) => {
    try {
      await api.patch(`/api/agents/${node.id}/`, {
        position_x: Math.round(node.position.x),
        position_y: Math.round(node.position.y)
      });
    } catch (err) {
      console.error("Failed to save node position", err);
    }
  }, []);

  const onNodeClick = (event, node) => {
    // Select the node to configure its prompt library assignments
    setSelectedNode(node);
    
    // Find trace for this node in the current version
    const agentId = node.data?.backendId || node.id;
    const nodeTrace = traces.find(t => String(t.agent_id) === String(agentId));
    
    if (nodeTrace) {
        setSelectedTrace({
            ...nodeTrace,
            node_id: node.id,
            agentName: nodeTrace.agent_name,
            model: "unknown",
            tokens: 0,
            cost: 0,
            latency: 0,
            messages: [] // Detailed messages might need separate fetch if we really want to simulate
        });
    } else {
        setSelectedTrace(null);
    }
  };

  const onEdgeClick = (event, edge) => {
    const targetNode = nodes.find(n => n.id === edge.target);
    if (targetNode) {
      onNodeClick(event, targetNode);
    }
  };

  const handleRunChain = async () => {
    if (isRunning) return;
    try {
      setIsRunning(true);
      const resp = await api.post(`/api/topics/${topicId}/execute-chain/`, {
          trigger_input: { trigger: "manual" }
      });
      
      if (resp.data.execution_version_id) {
          setSelectedVersionId(resp.data.execution_version_id);
      }
      
      // Force an immediate reload of versions to start the polling loop cleanly
      await loadVersions();
    } catch (err) {
      console.error("Failed to run chain", err);
      const backendError = err.response?.data?.error || err.message;
      alert(`Failed to run chain: ${backendError}`);
      setIsRunning(false);
    }
  };

  const onPaneClick = () => {
    setSelectedNode(null);
    setSelectedTrace(null);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar / Left Panel */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button 
            onClick={() => navigate('/topics')} 
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 mb-4 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          {isEditingTitle ? (
            <input 
              type="text" 
              value={editedTitle} 
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setIsEditingTitle(false); }}
              className="text-lg font-semibold text-gray-800 border-b border-gray-400 focus:outline-none focus:border-indigo-600 bg-transparent px-1 w-full"
              autoFocus
            />
          ) : (
            <h2 
              className="text-lg font-semibold text-gray-800 cursor-pointer hover:text-indigo-600 transition-colors"
              onClick={() => { setEditedTitle(topic?.title || 'Agent Chain'); setIsEditingTitle(true); }}
              title="Click to rename"
            >
              {topic?.title || 'Agent Chain'}
            </h2>
          )}
          <p className="text-sm text-gray-500">Custom Workflow</p>
        </div>
        <div className="p-4 flex-1 space-y-4">
          <button 
            onClick={handleAddNode}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors mb-2"
          >
            <Plus size={16} /> Add Node
          </button>
          <button 
            onClick={handleRunChain}
            disabled={isRunning}
            className={`w-full font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${isRunning ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {isRunning ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Play size={16} />}
            {isRunning ? 'Running...' : 'Run Chain'}
          </button>
          
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Execution History</p>
            <select
                className="w-full bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2"
                value={selectedVersionId}
                onChange={(e) => setSelectedVersionId(e.target.value)}
            >
                <option value="">Select a run...</option>
                {versions.map(v => (
                    <option key={v.id} value={v.id}>v{v.version_number} - {new Date(v.started_at).toLocaleTimeString()}</option>
                ))}
            </select>
          </div>
          
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Views</p>
            <button 
              onClick={() => setViewMode('canvas')}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${viewMode === 'canvas' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <GitBranch size={16} className={viewMode === 'canvas' ? 'text-indigo-600' : 'text-gray-400'} /> Canvas
            </button>
            <button 
              onClick={() => setViewMode('analytics')}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${viewMode === 'analytics' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <BarChart2 size={16} className={viewMode === 'analytics' ? 'text-indigo-600' : 'text-gray-400'} /> Analytics Dashboard
            </button>
            <div className="space-y-1">
              <button 
                onClick={() => setViewMode('improvements')}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${viewMode === 'improvements' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <TrendingUp size={16} className={viewMode === 'improvements' ? 'text-indigo-600' : 'text-gray-400'} /> Improvements
              </button>
              <button 
                onClick={() => setViewMode('health')}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${viewMode === 'health' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <ShieldAlert size={16} className={viewMode === 'health' ? 'text-indigo-600' : 'text-gray-400'} /> System Health
              </button>
            </div>
            <button 
              onClick={() => setViewMode('artifacts')}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${viewMode === 'artifacts' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <FileText size={16} className={viewMode === 'artifacts' ? 'text-indigo-600' : 'text-gray-400'} /> Generated Artifacts
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'canvas' ? (
        <div className="flex-1 relative" data-testid="graph-canvas">
          <ReactFlow 
            nodes={nodes} 
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
          >
            <Background color="#ccc" gap={16} />
            <Controls />
          </ReactFlow>

          {/* Execution Trace Panel overlay */}
          {traces.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm shadow-xl rounded-lg border border-gray-200 z-10 max-h-64 flex flex-col">
              <div className="px-4 py-2 border-b border-gray-200 bg-gray-50/50 rounded-t-lg">
                <h3 className="text-sm font-semibold text-gray-800">Execution Trace Panel</h3>
              </div>
              <div className="overflow-y-auto p-0">
                <table className="w-full text-xs text-left text-gray-600">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 font-medium">Node</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Started</th>
                      <th className="px-4 py-2 font-medium">Completed</th>
                      <th className="px-4 py-2 font-medium w-1/3">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {traces.map((t) => {
                      const selectedVersion = versions.find(v => v.id === selectedVersionId);
                      const isFailed = t.status === "failed";
                      const isRunningNode = t.status === "running";
                      return (
                        <tr 
                          key={t.id} 
                          className="hover:bg-indigo-50 cursor-pointer transition-colors"
                          onClick={(e) => {
                            const node = nodes.find(n => String(n.id) === String(t.agent_id) || String(n.data?.backendId) === String(t.agent_id));
                            if (node) {
                                onNodeClick(e, node);
                            }
                          }}
                        >
                          <td className="px-4 py-2 font-medium text-gray-900">{t.agent_name}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider
                              ${isFailed ? 'bg-red-100 text-red-800' : 
                                isRunningNode ? 'bg-amber-100 text-amber-800 animate-pulse' : 
                                'bg-emerald-100 text-emerald-800'}`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-500">{t.started_at ? new Date(t.started_at).toLocaleTimeString() : '-'}</td>
                          <td className="px-4 py-2 text-gray-500">{t.completed_at ? new Date(t.completed_at).toLocaleTimeString() : '-'}</td>
                          <td className="px-4 py-2 text-red-600 truncate max-w-xs" title={t.validation_result?.error || ""}>
                            {t.validation_result?.error || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'analytics' ? (
        <WorkflowAnalytics topicId={topicId} />
      ) : viewMode === 'improvements' ? (
        <ImprovementDashboard topicId={topicId} refreshKey={dashboardRefreshKey} />
      ) : viewMode === 'health' ? (
        <SystemHealthPanel topicId={topicId} />
      ) : (
        <ArtifactsDashboard topicId={topicId} />
      )}

      {(selectedNode || selectedTrace) && viewMode === 'canvas' && (
        <AgentDetailPanel 
          selectedNode={selectedNode || { id: selectedTrace?.node_id, data: { name: selectedTrace?.agentName || 'Agent' } }} 
          selectedTrace={selectedTrace}
          onClose={() => {
            setSelectedNode(null);
            setSelectedTrace(null);
          }} 
          onRunComplete={(trace) => {
            setSelectedTrace(trace);
          }}
          onDeleteAgent={async () => {
            if (selectedNode) {
              await onNodesDelete([selectedNode]);
              setSelectedNode(null);
              setSelectedTrace(null);
            }
          }}
        />
      )}
    </div>
  );
};

export default AgentChainWorkspace;
