import React, { useState, useEffect } from 'react';
import { Book, Plus, Search, Edit2, Shield, Settings, FileText, CheckCircle, BarChart2, AlertTriangle, Star, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';

const CATEGORY_ICONS = {
  safety: <Shield className="text-emerald-500" size={16} />,
  research: <Search className="text-blue-500" size={16} />,
  reasoning: <Settings className="text-purple-500" size={16} />,
  writing: <FileText className="text-amber-500" size={16} />
};

export default function PromptLibraryManager() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('safety');
  const [description, setDescription] = useState('');
  const [promptBody, setPromptBody] = useState('');

  const loadTemplates = async () => {
    try {
      const res = await api.get('/api/prompt-templates/');
      setTemplates(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setName('');
    setCategory('safety');
    setDescription('');
    setPromptBody('');
    setIsEditing(true);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setName(template.name);
    setCategory(template.category);
    setDescription(template.description);
    setPromptBody(template.prompt_body);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const payload = { name, category, description, prompt_body: promptBody };
      if (editingTemplate) {
        await api.put(`/api/prompt-templates/${editingTemplate.id}/`, payload);
      } else {
        await api.post('/api/prompt-templates/', payload);
      }
      setIsEditing(false);
      loadTemplates();
    } catch (err) {
      console.error("Failed to save template", err);
    }
  };

  if (isEditing) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <button onClick={() => setIsEditing(false)} className="text-sm text-slate-500 hover:text-indigo-600 mb-6 flex items-center gap-1 transition-colors">
          <ArrowLeft size={16} /> Back to Library
        </button>
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-6">{editingTemplate ? 'Edit Template' : 'Create New Template'}</h2>
          
          {editingTemplate && editingTemplate.versions && editingTemplate.versions.length > 0 && (
            <div className="mb-8 p-4 bg-slate-50 border rounded-xl">
              <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
                <BarChart2 size={16} className="text-indigo-500" /> Version Analytics
              </h3>
              {(() => {
                const latestVersion = editingTemplate.versions[editingTemplate.versions.length - 1];
                const metrics = latestVersion.metrics || { tasks_used_count: 0, acceptance_rate: 0, average_executive_score: 0, hallucination_rate: 0 };
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-3 rounded-lg border shadow-sm">
                      <p className="text-xs text-slate-500 font-medium">Tasks Used</p>
                      <p className="text-xl font-bold text-slate-800">{metrics.tasks_used_count}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border shadow-sm">
                      <p className="text-xs text-slate-500 font-medium">Acceptance Rate</p>
                      <div className="flex items-end gap-1">
                        <p className="text-xl font-bold text-emerald-600">{metrics.acceptance_rate.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border shadow-sm">
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        <AlertTriangle size={12} className="text-amber-500" /> Hallucinations
                      </p>
                      <div className="flex items-end gap-1">
                        <p className={`text-xl font-bold ${metrics.hallucination_rate > 5 ? 'text-red-500' : 'text-slate-800'}`}>
                          {metrics.hallucination_rate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border shadow-sm">
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        <Star size={12} className="text-purple-500" /> Executive Score
                      </p>
                      <p className="text-xl font-bold text-slate-800">{metrics.average_executive_score.toFixed(1)}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Template Name</label>
              <input 
                type="text" 
                placeholder="Template Name"
                className="w-full border rounded-lg p-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select 
                  className="w-full border rounded-lg p-2"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="safety">Safety</option>
                  <option value="research">Research</option>
                  <option value="reasoning">Reasoning</option>
                  <option value="writing">Writing</option>
                  <option value="evaluation">Evaluation</option>
                  <option value="memory">Memory</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input 
                type="text" 
                placeholder="Brief description of what this template does"
                className="w-full border rounded-lg p-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prompt Body</label>
              <textarea 
                placeholder="Prompt Body"
                className="w-full border rounded-lg p-3 font-mono text-sm min-h-[200px]"
                value={promptBody}
                onChange={(e) => setPromptBody(e.target.value)}
              />
            </div>
            
            <div className="pt-4 flex justify-end gap-3 border-t">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg border">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                <CheckCircle size={16} />
                Save Template
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto h-full">
      <button 
        onClick={() => navigate('/topics')} 
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <Book className="text-indigo-600" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Prompt Library</h1>
            <p className="text-slate-500 text-sm">Manage reusable, versioned instructions for agents.</p>
          </div>
        </div>
        <button 
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm transition-all"
        >
          <Plus size={18} />
          New Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map(t => (
          <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                {CATEGORY_ICONS[t.category] || <Book size={16} className="text-slate-400" />}
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t.category}</span>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full font-mono">v{t.version}</span>
            </div>
            
            <h3 className="text-lg font-semibold text-slate-800 mb-2">{t.name}</h3>
            <p className="text-slate-600 text-sm mb-4 line-clamp-2 min-h-[40px]">{t.description || "No description provided."}</p>
            
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4 h-24 overflow-hidden relative">
              <p className="text-xs font-mono text-slate-500 whitespace-pre-wrap">{t.prompt_body}</p>
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-50 to-transparent"></div>
            </div>

            {t.versions && t.versions.length > 0 && (
              <div className="flex items-center justify-between bg-white border rounded-lg p-2 mb-4">
                <div className="flex flex-col items-center flex-1 border-r border-slate-100 px-2">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Used</span>
                  <span className="text-sm font-bold text-slate-700">{t.versions[t.versions.length - 1].metrics?.tasks_used_count || 0}</span>
                </div>
                <div className="flex flex-col items-center flex-1 border-r border-slate-100 px-2">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Accept</span>
                  <span className="text-sm font-bold text-emerald-600">{(t.versions[t.versions.length - 1].metrics?.acceptance_rate || 0).toFixed(0)}%</span>
                </div>
                <div className="flex flex-col items-center flex-1 px-2">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Score</span>
                  <span className="text-sm font-bold text-purple-600">{(t.versions[t.versions.length - 1].metrics?.average_executive_score || 0).toFixed(1)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button 
                onClick={() => handleEdit(t)}
                className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Edit2 size={14} />
                Edit Template
              </button>
            </div>
          </div>
        ))}
      </div>
      {templates.length === 0 && (
        <div className="text-center py-20 bg-white border border-dashed border-slate-300 rounded-2xl">
          <Book className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-slate-700">No templates yet</h3>
          <p className="text-slate-500 mt-1">Create your first reusable prompt template to get started.</p>
        </div>
      )}
    </div>
  );
}
