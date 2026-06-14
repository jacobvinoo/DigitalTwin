import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PromptLibraryManager from './PromptLibraryManager';
import { api } from '../../api';

vi.mock('../../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  }
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

const mockTemplates = [
  { id: 1, name: 'Hallucination Avoidance', category: 'safety', description: 'desc', prompt_body: 'Be safe', version: 2 },
  { id: 2, name: 'Web Research', category: 'research', description: 'search web', prompt_body: 'Do research', version: 1 }
];

describe('PromptLibraryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: mockTemplates });
  });

  it('renders a list of prompt templates', async () => {
    render(<PromptLibraryManager />);
    
    expect(screen.getByText(/Prompt Library/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Hallucination Avoidance')).toBeInTheDocument();
      expect(screen.getByText('Web Research')).toBeInTheDocument();
    });
  });

  it('opens a form to create a new template', async () => {
    render(<PromptLibraryManager />);
    
    const newButton = screen.getByText(/New Template/i);
    fireEvent.click(newButton);
    
    expect(screen.getByPlaceholderText(/Template Name/i)).toBeInTheDocument();
    expect(screen.getByText(/Save Template/i)).toBeInTheDocument();
  });

  it('submits a new template', async () => {
    api.post.mockResolvedValue({ data: { id: 3, name: 'New Temp', category: 'writing', prompt_body: 'body', version: 1 } });
    
    render(<PromptLibraryManager />);
    
    const newButton = screen.getByText(/New Template/i);
    fireEvent.click(newButton);
    
    fireEvent.change(screen.getByPlaceholderText(/Template Name/i), { target: { value: 'New Temp' } });
    fireEvent.change(screen.getByPlaceholderText(/Prompt Body/i), { target: { value: 'body' } });
    
    fireEvent.click(screen.getByText(/Save Template/i));
    
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/prompt-templates/', expect.objectContaining({
        name: 'New Temp',
        prompt_body: 'body'
      }));
    });
  });
});
