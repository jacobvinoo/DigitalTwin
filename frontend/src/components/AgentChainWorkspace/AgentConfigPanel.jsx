import React, { useState, useEffect } from 'react';
import { Settings, X, Book, CheckSquare, Square, ClipboardList, Play } from 'lucide-react';
import { api } from '../../api';

const AgentConfigPanel = ({ agentId, agentName, onClose, onRunComplete, hideOuter }) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('prompts');
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [evalTemplates, setEvalTemplates] = useState([]);
  const [evalAssignments, setEvalAssignments] = useState([]);
  const [manualSources, setManualSources] = useState([]);
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  
  // New manual source form state
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');
  const [addingSource, setAddingSource] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [agentRes, templatesRes, assignmentsRes, evalTemplatesRes, evalAssignmentsRes, manualSourcesRes] = await Promise.all([
          api.get(`/api/agents/${agentId}/`).catch(() => ({ data: {} })),
          api.get('/api/prompt-templates/'),
          api.get(`/api/agent-prompt-assignments/?agent_id=${agentId}`),
          api.get('/api/evaluation-templates/'),
          api.get(`/api/evaluation-assignments/?agent_id=${agentId}`),
          api.get(`/api/manual-sources/?agent=${agentId}`)
        ]);
        setInstructions(agentRes.data.instructions || '');
        setTemplates(templatesRes.data);
        setAssignments(assignmentsRes.data);
        setEvalTemplates(evalTemplatesRes.data);
        setEvalAssignments(evalAssignmentsRes.data);
        setManualSources(manualSourcesRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (agentId) {
      fetchData();
    }
  }, [agentId]);

  const handleSaveInstructions = async () => {
    try {
      setSaving(true);
      await api.patch(`/api/agents/${agentId}/`, { instructions });
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error(err);
      setSaveStatus('Error saving');
    } finally {
      setSaving(false);
    }
  };

  const toggleAssignment = async (templateId) => {
    try {
      setSaving(true);
      const existing = assignments.find(a => a.prompt_template === templateId);
      
      if (existing) {
        await api.delete(`/api/agent-prompt-assignments/${existing.id}/`);
        setAssignments(assignments.filter(a => a.id !== existing.id));
      } else {
        const newAssignment = {
          agent: agentId,
          prompt_template: templateId,
          sort_order: assignments.length + 1,
          enabled: true
        };
        const res = await api.post('/api/agent-prompt-assignments/', newAssignment);
        setAssignments([...assignments, res.data]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleEvalAssignment = async (templateId) => {
    try {
      setSaving(true);
      const existing = evalAssignments.find(a => a.evaluation_template === templateId);
      
      if (existing) {
        await api.delete(`/api/evaluation-assignments/${existing.id}/`);
        setEvalAssignments(evalAssignments.filter(a => a.id !== existing.id));
      } else {
        const newAssignment = {
          agent: agentId,
          evaluation_template: templateId,
          sort_order: evalAssignments.length + 1,
          enabled: true
        };
        const res = await api.post('/api/evaluation-assignments/', newAssignment);
        setEvalAssignments([...evalAssignments, res.data]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddManualSource = async () => {
    if (!newSourceTitle || !newSourceContent) return;
    try {
      setAddingSource(true);
      const res = await api.post('/api/manual-sources/', {
        agent: agentId,
        title: newSourceTitle,
        url: newSourceUrl,
        content: newSourceContent
      });
      setManualSources([res.data, ...manualSources]);
      setNewSourceTitle('');
      setNewSourceUrl('');
      setNewSourceContent('');
    } catch (err) {
      console.error(err);
      alert('Failed to add source');
    } finally {
      setAddingSource(false);
    }
  };

  const handleDeleteManualSource = async (id) => {
    try {
      await api.delete(`/api/manual-sources/${id}/`);
      setManualSources(manualSources.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className={`flex flex-col h-full bg-white p-6 ${hideOuter ? 'w-full' : 'w-96 border-l border-gray-200 z-10'}`}>
        <p className="text-gray-500 text-center mt-10">Loading configurations...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-white ${hideOuter ? 'w-full flex-1 overflow-hidden' : 'w-96 border-l border-gray-200 shadow-lg z-10'}`}>
      {!hideOuter && (
        <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-800">{agentName} Configuration</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
        </div>
      )}
      {/* Configuration Options explicitly rendered when hideOuter is true */}
      {hideOuter && (
        <div className="px-4 py-2 bg-gray-50 flex items-center justify-between border-b border-gray-200 shrink-0">
          <span className="text-xs text-gray-500 font-medium">Agent Configuration Options</span>
        </div>
      )}
      
      {/* Tabs */}
      <div className="flex border-b border-gray-200 shrink-0">
        <button
          onClick={() => setActiveTab('prompts')}
          className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'prompts' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Prompts
        </button>
        <button
          onClick={() => setActiveTab('evaluators')}
          className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'evaluators' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Evaluators
        </button>
        <button
          onClick={() => setActiveTab('knowledge')}
          className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'knowledge' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Knowledge Base
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto bg-gray-50">
        <div className="mb-6">
          <label htmlFor="agent-instructions" className="block text-sm font-medium text-gray-700 mb-2">
            Specific Task Instructions
          </label>
          <textarea
            id="agent-instructions"
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all"
            rows="3"
            placeholder="e.g. Search for the latest AI news and summarize top 3 findings..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={saving}
          />
          <div className="flex justify-end items-center gap-3 mt-2">
            {saveStatus && <span className={`text-xs ${saveStatus === 'Saved!' ? 'text-emerald-600' : 'text-red-600'}`}>{saveStatus}</span>}
            <button 
              onClick={handleSaveInstructions} 
              disabled={saving}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {saving ? 'Saving...' : 'Save Instructions'}
            </button>
          </div>
        </div>

        {activeTab === 'prompts' ? (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
              <Book size={16} /> Prompt Templates
            </h3>
            <p className="text-xs text-gray-500 mb-4">Select the foundational instructions this agent should follow.</p>
            
            <div className="space-y-3">
              {templates.map(template => {
                const assignment = assignments.find(a => a.prompt_template === template.id);
                const isEnabled = assignment ? assignment.enabled : false;
                
                return (
                  <div 
                    key={template.id}
                    onClick={() => !saving && toggleAssignment(template.id)}
                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      isEnabled ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200 hover:border-indigo-300'
                    } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className={`mt-0.5 ${isEnabled ? 'text-indigo-600' : 'text-gray-400'}`}>
                      {isEnabled ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium text-sm ${isEnabled ? 'text-indigo-900' : 'text-gray-700'}`}>
                          {template.name}
                        </span>
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">v{template.version}</span>
                      </div>
                      <p className={`text-xs ${isEnabled ? 'text-indigo-700' : 'text-gray-500'}`}>
                        {template.category}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeTab === 'evaluators' ? (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
              <ClipboardList size={16} /> Evaluators
            </h3>
            <p className="text-xs text-gray-500 mb-4">Select the metrics this agent will be evaluated against.</p>
            
            <div className="space-y-3">
              {evalTemplates.map(template => {
                const assignment = evalAssignments.find(a => a.evaluation_template === template.id);
                const isEnabled = assignment ? assignment.enabled : false;
                
                return (
                  <div 
                    key={template.id}
                    onClick={() => !saving && toggleEvalAssignment(template.id)}
                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      isEnabled ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200 hover:border-amber-300'
                    } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className={`mt-0.5 ${isEnabled ? 'text-amber-600' : 'text-gray-400'}`}>
                      {isEnabled ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium text-sm ${isEnabled ? 'text-amber-900' : 'text-gray-700'}`}>
                          {template.name}
                        </span>
                        <span className="text-[10px] font-mono bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">v{template.version}</span>
                      </div>
                      <p className={`text-xs ${isEnabled ? 'text-amber-700' : 'text-gray-500'}`}>
                        {template.category}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-4">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-2">
                <h3 className="text-sm font-semibold text-blue-800">Add Manual Source</h3>
                <p className="text-xs text-blue-600 mb-3">Paste exact text content or reports to force the agent to use them in the next run.</p>
                <div className="space-y-2">
                  <input
                    className="w-full text-sm border border-gray-200 rounded p-1.5 focus:outline-none focus:border-blue-400"
                    placeholder="Document Title"
                    value={newSourceTitle}
                    onChange={(e) => setNewSourceTitle(e.target.value)}
                  />
                  <input
                    className="w-full text-sm border border-gray-200 rounded p-1.5 focus:outline-none focus:border-blue-400"
                    placeholder="Source URL (Optional)"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                  />
                  <textarea
                    className="w-full text-sm border border-gray-200 rounded p-1.5 h-24 resize-none focus:outline-none focus:border-blue-400 font-mono"
                    placeholder="Paste full text content here..."
                    value={newSourceContent}
                    onChange={(e) => setNewSourceContent(e.target.value)}
                  />
                  <button
                    onClick={handleAddManualSource}
                    disabled={addingSource || !newSourceTitle || !newSourceContent}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 rounded disabled:opacity-50"
                  >
                    {addingSource ? 'Adding...' : 'Attach Source to Node'}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-2">Attached Documents</h3>
                {manualSources.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No manual documents attached.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {manualSources.map(src => (
                      <div key={src.id} className="bg-white border border-gray-200 rounded p-2 flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-2">
                          <h4 className="text-xs font-bold text-gray-800 truncate">{src.title}</h4>
                          {src.url && <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline truncate block">{src.url}</a>}
                          <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{src.content}</p>
                        </div>
                        <button 
                          onClick={() => handleDeleteManualSource(src.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default AgentConfigPanel;
