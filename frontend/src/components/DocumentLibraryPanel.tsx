import { useState, useEffect } from 'react';

// Simple Markdown Renderer copied from AgentOutputs for code-reuse
export function SimpleMarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;
  
  const lines = content.split('\n');
  return (
    <div className="space-y-3 font-sans text-slate-800">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
          return <h1 key={idx} className="text-xl font-bold text-slate-900 border-b pb-2 mt-4 mb-3">{trimmed.substring(2)}</h1>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={idx} className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-1 mt-4 mb-2">{trimmed.substring(3)}</h2>;
        }
        if (trimmed.startsWith('### ')) {
          return <h3 key={idx} className="text-sm font-semibold text-slate-800 mt-3 mb-1.5">{trimmed.substring(4)}</h3>;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start space-x-2 pl-4 py-0.5">
              <span className="text-slate-400 mt-1.5 shrink-0 block w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span className="text-sm text-slate-700 leading-relaxed">{trimmed.substring(2)}</span>
            </div>
          );
        }
        if (trimmed === '') {
          return <div key={idx} className="h-1" />;
        }
        return <p key={idx} className="text-sm text-slate-700 leading-relaxed mb-1.5">{trimmed}</p>;
      })}
    </div>
  );
}

interface DocumentInfo {
  filename: string;
  title: string;
  type: 'generated' | 'user';
  status: 'active' | 'archived';
  created_at: string;
  task_id: number | null;
  content: string;
}

interface DocumentLibraryPanelProps {
  topicId: string;
  selectedDocumentName: string | null;
  onClearSelectedDocumentName: () => void;
}

export default function DocumentLibraryPanel({ 
  topicId, 
  selectedDocumentName,
  onClearSelectedDocumentName
}: DocumentLibraryPanelProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'generated' | 'user' | 'archived'>('all');
  const [selectedDoc, setSelectedDoc] = useState<DocumentInfo | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDocuments = () => {
    setLoading(true);
    fetch(`/api/topics/${topicId}/documents/`)
      .then(res => res.json())
      .then(data => {
        setDocuments(data);
        setLoading(false);
        
        // If a document was pre-selected from the task drawer, find and select it
        if (selectedDocumentName) {
          const doc = data.find((d: DocumentInfo) => d.filename === selectedDocumentName);
          if (doc) {
            setSelectedDoc(doc);
          }
          onClearSelectedDocumentName();
        } else if (data.length > 0 && !selectedDoc) {
          // Select first document by default
          const activeDocs = data.filter((d: DocumentInfo) => d.status === 'active');
          if (activeDocs.length > 0) {
            setSelectedDoc(activeDocs[0]);
          } else {
            setSelectedDoc(data[0]);
          }
        }
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDocuments();
  }, [topicId]);

  useEffect(() => {
    if (selectedDocumentName && documents.length > 0) {
      const doc = documents.find(d => d.filename === selectedDocumentName);
      if (doc) {
        setSelectedDoc(doc);
      }
      onClearSelectedDocumentName();
    }
  }, [selectedDocumentName, documents]);

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    
    fetch(`/api/topics/${topicId}/documents/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        content: newContent
      })
    })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Failed to create document');
      })
      .then(newDoc => {
        setDocuments([newDoc, ...documents]);
        setSelectedDoc(newDoc);
        setShowAddModal(false);
        setNewTitle('');
        setNewContent('');
        setSubmitting(false);
      })
      .catch(err => {
        console.error(err);
        setSubmitting(false);
      });
  };

  const handleArchive = (filename: string) => {
    fetch(`/api/topics/${topicId}/documents/archive/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    })
      .then(res => {
        if (res.ok) {
          setDocuments(prev => prev.map(d => d.filename === filename ? { ...d, status: 'archived' } : d));
          if (selectedDoc?.filename === filename) {
            setSelectedDoc(prev => prev ? { ...prev, status: 'archived' } : null);
          }
        }
      })
      .catch(err => console.error(err));
  };

  const handleRestore = (filename: string) => {
    fetch(`/api/topics/${topicId}/documents/restore/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    })
      .then(res => {
        if (res.ok) {
          setDocuments(prev => prev.map(d => d.filename === filename ? { ...d, status: 'active' } : d));
          if (selectedDoc?.filename === filename) {
            setSelectedDoc(prev => prev ? { ...prev, status: 'active' } : null);
          }
        }
      })
      .catch(err => console.error(err));
  };

  const handleDelete = (filename: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this document? This action cannot be undone.')) {
      return;
    }
    
    fetch(`/api/topics/${topicId}/documents/delete/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    })
      .then(res => {
        if (res.ok) {
          setDocuments(prev => prev.filter(d => d.filename !== filename));
          if (selectedDoc?.filename === filename) {
            setSelectedDoc(null);
          }
        }
      })
      .catch(err => console.error(err));
  };

  // Filter logic
  const filteredDocs = documents.filter(doc => {
    if (activeFilter === 'archived') return doc.status === 'archived';
    if (doc.status === 'archived') return false; // Hide archived from others
    if (activeFilter === 'generated') return doc.type === 'generated';
    if (activeFilter === 'user') return doc.type === 'user';
    return true; // activeFilter === 'all'
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 bg-slate-50 min-h-[calc(100vh-250px)]">
      
      {/* Sidebar List */}
      <div className="lg:col-span-1 bg-white p-4 rounded-2xl border shadow-sm flex flex-col h-[650px]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-800 text-base">Documents</h3>
          <button 
            onClick={() => setShowAddModal(true)}
            className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition flex items-center justify-center cursor-pointer"
            title="Create Custom Document"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-4 text-xs font-medium">
          {(['all', 'generated', 'user', 'archived'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`flex-1 py-1 rounded-md capitalize transition cursor-pointer ${
                activeFilter === filter 
                  ? 'bg-white text-indigo-700 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Document List */}
        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {loading ? (
            <div className="text-center py-10 text-xs text-slate-400">Loading documents...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400 italic">No documents found</div>
          ) : (
            filteredDocs.map(doc => {
              const isSelected = selectedDoc?.filename === doc.filename;
              return (
                <div
                  key={doc.filename}
                  onClick={() => setSelectedDoc(doc)}
                  className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-200 shadow-xs'
                      : 'bg-slate-50/50 hover:bg-slate-50 border-slate-150'
                  }`}
                >
                  <div className="flex flex-col space-y-1.5">
                    {/* Header: Title and Type Pill */}
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-slate-800 text-xs line-clamp-2 leading-snug">
                        {doc.title}
                      </span>
                    </div>

                    {/* Metadata Footer */}
                    <div className="flex items-center justify-between text-[9px] text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        {doc.status === 'archived' ? (
                          <span className="px-1.5 py-0.5 font-bold bg-amber-50 text-amber-700 rounded border border-amber-100 uppercase tracking-wider">
                            Archived
                          </span>
                        ) : doc.type === 'generated' ? (
                          <span className="px-1.5 py-0.5 font-bold bg-blue-50 text-blue-700 rounded border border-blue-100 uppercase tracking-wider">
                            Generated
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 font-bold bg-emerald-50 text-emerald-700 rounded border border-emerald-100 uppercase tracking-wider">
                            Uploaded
                          </span>
                        )}
                      </div>
                      <span>
                        {new Date(doc.created_at).toLocaleDateString(undefined, { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Hover Actions */}
                  <div className="absolute right-2 top-2 hidden group-hover:flex space-x-1 bg-white p-1 rounded-lg shadow-sm border border-slate-150 transition-all">
                    {doc.status === 'active' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchive(doc.filename);
                        }}
                        className="p-1 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded transition cursor-pointer"
                        title="Archive"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(doc.filename);
                        }}
                        className="p-1 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded transition cursor-pointer"
                        title="Restore"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17.5" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc.filename);
                      }}
                      className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                      title="Delete Permanently"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lg:col-span-3 bg-white p-6 rounded-2xl border shadow-sm flex flex-col h-[650px] overflow-hidden">
        {selectedDoc ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Top Bar inside Document Detail */}
            <div className="flex justify-between items-start border-b pb-4 mb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold text-slate-800">{selectedDoc.title}</h2>
                  <div className="flex space-x-1.5">
                    {selectedDoc.status === 'archived' && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 rounded border border-amber-100 uppercase tracking-wider">
                        Archived
                      </span>
                    )}
                    {selectedDoc.type === 'generated' ? (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-50 text-blue-700 rounded border border-blue-100 uppercase tracking-wider">
                        System Generated
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-700 rounded border border-emerald-100 uppercase tracking-wider">
                        User Document
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-mono break-all">{selectedDoc.filename}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {selectedDoc.status === 'active' ? (
                  <button
                    onClick={() => handleArchive(selectedDoc.filename)}
                    className="px-2.5 py-1.5 text-xs border rounded-md hover:bg-amber-50 hover:text-amber-700 transition cursor-pointer flex items-center space-x-1"
                  >
                    <span>Archive</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleRestore(selectedDoc.filename)}
                    className="px-2.5 py-1.5 text-xs border rounded-md hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer flex items-center space-x-1"
                  >
                    <span>Restore</span>
                  </button>
                )}
                <button
                  onClick={() => handleDelete(selectedDoc.filename)}
                  className="px-2.5 py-1.5 text-xs bg-red-50 border border-red-200 text-red-600 rounded-md hover:bg-red-100 transition cursor-pointer flex items-center space-x-1 font-semibold"
                >
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Document Markdown Render Container */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 rounded-xl border border-slate-150">
              <SimpleMarkdownRenderer content={selectedDoc.content} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center py-20 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="font-semibold text-slate-700 text-base mb-1">No Document Selected</h3>
            <p className="text-xs text-slate-500 max-w-xs text-center leading-relaxed">
              Select a strategy document from the sidebar list, or click the add button to write a new custom document.
            </p>
          </div>
        )}
      </div>

      {/* Add Document Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h3 className="font-bold text-slate-800 text-base">Add Custom Document</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="doc-title">
                  Document Title
                </label>
                <input
                  id="doc-title"
                  type="text"
                  placeholder="Enter document title (e.g. competitor research notes)..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-sm p-2.5 border rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="doc-content">
                  Content (Supports Markdown)
                </label>
                <textarea
                  id="doc-content"
                  placeholder="Write your document content here..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full text-sm p-2.5 border rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white text-slate-800 font-sans"
                  rows={8}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newTitle.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-lg cursor-pointer transition shadow-sm"
                >
                  {submitting ? 'Creating...' : 'Create Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
