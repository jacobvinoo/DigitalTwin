import React, { useState } from 'react';

export const ActionCreateDrawer = ({ topicId, isOpen, onClose, onSubmit }: { topicId: string, isOpen: boolean, onClose: () => void, onSubmit: (data: any) => Promise<void> }) => {
  const [actionType, setActionType] = useState('email_draft');
  const [title, setTitle] = useState('');
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({
      topic: topicId,
      action_type: actionType,
      title,
      instruction
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl p-6 z-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Propose New Action</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-black">&times;</button>
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="actionType" className="block text-sm font-medium mb-1">Action Type</label>
          <select 
            id="actionType"
            className="w-full border p-2 rounded" 
            value={actionType} 
            onChange={(e) => setActionType(e.target.value)}
          >
            <option value="email_draft">Email Draft</option>
            <option value="document_create">Document Create</option>
            <option value="research_request">Research Request</option>
            <option value="follow_up_task">Follow Up Task</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-1">Title</label>
          <input 
            id="title"
            type="text" 
            className="w-full border p-2 rounded"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="instruction" className="block text-sm font-medium mb-1">Instruction</label>
          <textarea 
            id="instruction"
            className="w-full border p-2 rounded h-32"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            required
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded mt-4 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Action'}
        </button>
      </form>
    </div>
  );
};
