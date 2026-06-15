import React, { useState, useEffect, useCallback } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, addEdge as addReactFlowEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Settings, Play, CheckCircle, BarChart2, GitBranch, ArrowLeft, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AgentNode from './AgentNode';
import AgentDetailPanel from './AgentDetailPanel';
import WorkflowAnalytics from './WorkflowAnalytics';
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

  const [topic, setTopic] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");

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

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

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
    setSelectedTrace(null);
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
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
            <Play size={16} /> Run Chain
          </button>
          
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
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
          >
            <Background color="#ccc" gap={16} />
            <Controls />
          </ReactFlow>
        </div>
      ) : (
        <WorkflowAnalytics topicId={topicId} />
      )}

      {(selectedNode || selectedTrace) && (
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
