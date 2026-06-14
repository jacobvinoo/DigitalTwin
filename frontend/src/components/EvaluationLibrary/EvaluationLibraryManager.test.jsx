import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EvaluationLibraryManager from './EvaluationLibraryManager';
import { api } from '../../api';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  }
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const mockEvalTemplates = [
  { id: 1, name: 'Quality Evaluator', category: 'quality', description: 'Checks quality', evaluation_prompt: 'Score 1-10', version: 1, scoring_schema: { "quality": 10 } }
];

describe('EvaluationLibraryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: mockEvalTemplates });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <EvaluationLibraryManager />
      </BrowserRouter>
    );
  };

  it('renders a list of evaluation templates', async () => {
    renderComponent();
    
    expect(screen.getByText(/Evaluation Library/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Quality Evaluator')).toBeInTheDocument();
    });
  });

  it('opens a form to create a new evaluation template', async () => {
    renderComponent();
    
    const newButton = screen.getByText(/New Evaluator/i);
    fireEvent.click(newButton);
    
    expect(screen.getByPlaceholderText(/e.g. Hallucination Risk/i)).toBeInTheDocument();
    expect(screen.getByText(/Save Evaluator/i)).toBeInTheDocument();
  });

  it('submits a new evaluation template', async () => {
    api.post.mockResolvedValue({ data: { id: 2, name: 'Safety Evaluator', category: 'safety', evaluation_prompt: 'Check safety', version: 1 } });
    
    renderComponent();
    
    const newButton = screen.getByText(/New Evaluator/i);
    fireEvent.click(newButton);
    
    fireEvent.change(screen.getByPlaceholderText(/e.g. Hallucination Risk/i), { target: { value: 'Safety Evaluator' } });
    fireEvent.change(screen.getByPlaceholderText(/Evaluation Prompt/i), { target: { value: 'Check safety' } });
    
    fireEvent.click(screen.getByText(/Save Evaluator/i));
    
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/evaluation-templates/', expect.objectContaining({
        name: 'Safety Evaluator',
        evaluation_prompt: 'Check safety'
      }));
    });
  });
});
