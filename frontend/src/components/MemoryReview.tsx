import { useState, useEffect } from 'react';

interface MemoryRecord {
  id: number;
  content: string;
  source: string;
  confidence: number;
}

export default function MemoryReview({ topicId }: { topicId: string }) {
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [editingContent, setEditingContent] = useState<Record<number, string>>({});

  useEffect(() => {
    // Mock fetching pending memories
    setMemories([
      {
        id: 1,
        content: "When analysing regional supermarket strategy, include local market context.",
        source: "Feedback on Task #1",
        confidence: 0.85
      },
      {
        id: 2,
        content: "Another mock context.",
        source: "Feedback on Task #2",
        confidence: 0.90
      }
    ]);
  }, [topicId]);

  const handleApprove = async (id: number) => {
    const updatedContent = editingContent[id] || memories.find(m => m.id === id)?.content;
    await fetch(`/api/memory/${id}/approve/`, { 
      method: 'POST',
      body: JSON.stringify({ content: updatedContent })
    });
    setMemories(memories.filter(m => m.id !== id));
  };

  const handleReject = async (id: number) => {
    await fetch(`/api/memory/${id}/reject/`, { method: 'POST' });
    setMemories(memories.filter(m => m.id !== id));
  };

  const handleContentChange = (id: number, value: string) => {
    setEditingContent(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-800 font-sans">
      
      {/* Navigation Breadcrumb */}
      <div className="mb-4">
        <a
          href="/topics"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-all cursor-pointer group"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1 transform group-hover:-translate-x-0.5 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </a>
      </div>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Memory Review</h1>
        <p className="text-slate-500 mt-2">Review, edit, and approve context memory before it is persisted for autonomous reuse.</p>
      </header>

      <div className="space-y-6">
        {memories.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border text-center text-slate-500">
            No pending memory records to review.
          </div>
        ) : (
          memories.map(memory => (
            <div key={memory.id} className="bg-white p-6 rounded-xl shadow-sm border flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1">Source Context</h3>
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded border">{memory.source}</p>
                </div>
                
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1">Proposed Reusable Rule</h3>
                  <textarea 
                    className="w-full text-sm text-slate-800 p-3 rounded border focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    value={editingContent[memory.id] ?? memory.content}
                    onChange={(e) => handleContentChange(memory.id, e.target.value)}
                  />
                </div>
              </div>
              
              <div className="w-full md:w-64 flex flex-col justify-between border-l md:pl-6">
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Confidence</h3>
                  <div className="flex items-center">
                    <div className="w-full bg-slate-200 rounded-full h-2 mr-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${memory.confidence * 100}%` }}></div>
                    </div>
                    <span className="text-sm font-medium">{Math.round(memory.confidence * 100)}%</span>
                  </div>
                </div>
                
                <div className="mt-6 space-y-3">
                  <button 
                    onClick={() => handleApprove(memory.id)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded shadow-sm transition-colors"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleReject(memory.id)}
                    className="w-full bg-white hover:bg-red-50 text-red-600 border border-red-200 font-medium py-2 rounded transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
