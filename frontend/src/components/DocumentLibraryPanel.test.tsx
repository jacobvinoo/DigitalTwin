import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentLibraryPanel from './DocumentLibraryPanel';

describe('DocumentLibraryPanel', () => {
  const mockDocuments = [
    {
      filename: 'task_101_spec.md',
      title: 'Algolia Spec',
      type: 'generated',
      status: 'active',
      created_at: '2026-06-05T22:47:09Z',
      task_id: 101,
      content: '# Algolia Spec\n- Key points'
    },
    {
      filename: 'user_1_12345_notes.md',
      title: 'My Custom Notes',
      type: 'user',
      status: 'active',
      created_at: '2026-06-05T22:48:09Z',
      task_id: null,
      content: '# My Custom Notes\nSome manual ideas.'
    },
    {
      filename: 'user_1_67890_old.md',
      title: 'Old Idea',
      type: 'user',
      status: 'archived',
      created_at: '2026-06-05T22:40:09Z',
      task_id: null,
      content: '# Old Idea\nDeprecated.'
    }
  ];

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url, options) => {
      if (url.endsWith('/documents/')) {
        if (options?.method === 'POST') {
          const body = JSON.parse(options.body);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              filename: 'user_1_9999_custom.md',
              title: body.title,
              type: 'user',
              status: 'active',
              created_at: new Date().toISOString(),
              task_id: null,
              content: body.content
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDocuments)
        });
      }
      if (url.includes('/documents/archive/') || url.includes('/documents/restore/') || url.includes('/documents/delete/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'success' })
        });
      }
      return Promise.reject(new Error('Unknown url'));
    }));
  });

  it('renders list of documents and displays the active filter by default', async () => {
    render(
      <DocumentLibraryPanel 
        topicId="1" 
        selectedDocumentName={null} 
        onClearSelectedDocumentName={vi.fn()} 
      />
    );

    // Sidebar documents (use findAllByText because the title appears in sidebar and detail view)
    const sidebarDocs = await screen.findAllByText('Algolia Spec');
    expect(sidebarDocs.length).toBeGreaterThan(0);
    expect(screen.getByText('My Custom Notes')).toBeInTheDocument();
    
    // Default active document should show in main area
    expect(screen.getByText('System Generated')).toBeInTheDocument();
    expect(screen.getByText('Key points')).toBeInTheDocument();
  });

  it('filters documents by source tabs', async () => {
    const user = userEvent.setup();
    render(
      <DocumentLibraryPanel 
        topicId="1" 
        selectedDocumentName={null} 
        onClearSelectedDocumentName={vi.fn()} 
      />
    );

    const sidebarDocs = await screen.findAllByText('Algolia Spec');
    expect(sidebarDocs.length).toBeGreaterThan(0);
    expect(screen.getByText('My Custom Notes')).toBeInTheDocument();
    expect(screen.queryByText('Old Idea')).not.toBeInTheDocument();

    // Switch to Archived tab
    await user.click(screen.getByText('archived'));
    expect(screen.getByText('Old Idea')).toBeInTheDocument();
    expect(screen.queryAllByText('Algolia Spec').length).toBeLessThan(3);
  });

  it('supports creating a new document via modal', async () => {
    const user = userEvent.setup();
    render(
      <DocumentLibraryPanel 
        topicId="1" 
        selectedDocumentName={null} 
        onClearSelectedDocumentName={vi.fn()} 
      />
    );

    const sidebarDocs = await screen.findAllByText('Algolia Spec');
    expect(sidebarDocs.length).toBeGreaterThan(0);
    
    // Open modal
    await user.click(screen.getByTitle('Create Custom Document'));
    
    // Fill title and content
    const titleInput = screen.getByLabelText('Document Title');
    const contentTextarea = screen.getByLabelText(/Content/);
    
    await user.type(titleInput, 'New Doc Title');
    await user.type(contentTextarea, '# New Doc Title\nFresh content here.');
    
    // Submit
    await user.click(screen.getByText('Create Document'));
    
    // Verify document was added to the list and selected
    await waitFor(() => {
      expect(screen.getAllByText('New Doc Title').length).toBeGreaterThan(0);
    });
  });
});
