import React, { useState, useEffect } from 'react';
import { Shield, Search, Settings, FileText, CheckCircle, Edit2, Plus, ArrowLeft, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';

const CATEGORY_ICONS = {
  quality: <Shield className="text-emerald-500" size={16} />,
  evidence: <Search className="text-blue-500" size={16} />,
  strategy: <Settings className="text-purple-500" size={16} />,
  product: <Settings className="text-indigo-500" size={16} />,
  executive: <FileText className="text-amber-500" size={16} />,
  safety: <Shield className="text-red-500" size={16} />,
  writing: <FileText className="text-teal-500" size={16} />
};

export default function EvaluationLibraryManager() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('quality');
  const [description, setDescription] = useState('');
  const [evaluationPrompt, setEvaluationPrompt] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/api/evaluation-templates/');
      setTemplates(response.data);
    } catch (err) {
      console.error("Failed to fetch evaluation templates", err);
    }
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setName('');
    setCategory('quality');
    setDescription('');
    setEvaluationPrompt('');
    setIsEditing(true);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setName(template.name);
    setCategory(template.category);
    setDescription(template.description);
    setEvaluationPrompt(template.evaluation_prompt);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const payload = {
      name,
      category,
      description,
      evaluation_prompt: evaluationPrompt,
      scoring_schema: {} // Simplified for now, can build JSON schema builder later
    };

    try {
      if (editingTemplate) {
        await api.put(`/api/evaluation-templates/${editingTemplate.id}/`, payload);
      } else {
        await api.post('/api/evaluation-templates/', payload);
      }
      setIsEditing(false);
      fetchTemplates();
    } catch (err) {
      console.error("Failed to save evaluation template", err);
    }
  };

  if (isEditing) {
    return (
      <div className="p-8 max-w-4xl mx-auto h-full">
        <button onClick={() => setIsEditing(false)} className="text-sm text-slate-500 hover:text-indigo-600 mb-6 flex items-center gap-1 transition-colors">
          <ArrowLeft size={16} /> Back to Library
        </button>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
            <ClipboardList className="text-indigo-600" size={24} />
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {editingTemplate ? 'Edit Evaluator' : 'New Evaluator'}
              </h2>
              <p className="text-slate-500 text-sm">Define how agents should be evaluated.</p>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Evaluator Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Hallucination Risk"
                  className="w-full border rounded-lg p-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select 
                  className="w-full border rounded-lg p-2"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="quality">Quality</option>
                  <option value="evidence">Evidence</option>
                  <option value="strategy">Strategy</option>
                  <option value="product">Product</option>
                  <option value="executive">Executive</option>
                  <option value="safety">Safety</option>
                  <option value="writing">Writing</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input 
                type="text" 
                placeholder="Brief description"
                className="w-full border rounded-lg p-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Evaluation Prompt</label>
              <textarea 
                placeholder="Evaluation Prompt"
                className="w-full border rounded-lg p-3 font-mono text-sm min-h-[200px]"
                value={evaluationPrompt}
                onChange={(e) => setEvaluationPrompt(e.target.value)}
              />
            </div>
            
            <div className="pt-4 flex justify-end gap-3 border-t">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg border">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                <CheckCircle size={16} />
                Save Evaluator
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
            <ClipboardList className="text-indigo-600" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Evaluation Library</h1>
            <p className="text-slate-500 text-sm">Manage the grading criteria and evaluators for agents.</p>
          </div>
        </div>
        <button 
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm transition-all"
        >
          <Plus size={18} />
          New Evaluator
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map(t => (
          <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                {CATEGORY_ICONS[t.category] || <ClipboardList size={16} className="text-slate-400" />}
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t.category}</span>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full font-mono">v{t.version}</span>
            </div>
            
            <h3 className="text-lg font-semibold text-slate-800 mb-2">{t.name}</h3>
            <p className="text-slate-600 text-sm mb-4 line-clamp-2 min-h-[40px]">{t.description || "No description provided."}</p>
            
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4 h-24 overflow-hidden relative">
              <p className="text-xs font-mono text-slate-500 whitespace-pre-wrap">{t.evaluation_prompt}</p>
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-50 to-transparent"></div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button 
                onClick={() => handleEdit(t)}
                className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Edit2 size={14} />
                Edit Evaluator
              </button>
            </div>
          </div>
        ))}
      </div>
      {templates.length === 0 && (
        <div className="text-center py-20 bg-white border border-dashed border-slate-300 rounded-2xl">
          <ClipboardList className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-slate-700">No evaluators yet</h3>
          <p className="text-slate-500 mt-1">Create your first evaluation template to start assessing agents.</p>
        </div>
      )}
    </div>
  );
}
