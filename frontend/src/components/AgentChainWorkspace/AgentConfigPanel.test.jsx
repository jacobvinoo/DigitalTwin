import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AgentConfigPanel from './AgentConfigPanel';
import { api } from '../../api';

vi.mock('../../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}));

describe('AgentConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    api.get.mockResolvedValue(new Promise(() => {})); // Never resolves
    render(<AgentConfigPanel agentId={1} agentName="Test Agent" onClose={() => {}} />);
    expect(screen.getByText(/Loading configurations.../i)).toBeInTheDocument();
  });

  it('loads templates and assignments and displays them', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/prompt-templates/') {
        return Promise.resolve({
          data: [
            { id: 10, name: 'Safety', category: 'safety', version: 1 },
            { id: 11, name: 'Research', category: 'research', version: 2 }
          ]
        });
      }
      if (url === '/api/agent-prompt-assignments/?agent=1' || url === '/api/agent-prompt-assignments/?agent_id=1') {
        return Promise.resolve({
          data: [
            { id: 100, agent: 1, prompt_template: 10, sort_order: 1, enabled: true }
          ]
        });
      }
      if (url === '/api/evaluation-templates/') {
        return Promise.resolve({
          data: [
            { id: 20, name: 'Hallucination Check', category: 'quality', version: 1 }
          ]
        });
      }
      if (url === '/api/evaluation-assignments/?agent=1' || url === '/api/evaluation-assignments/?agent_id=1') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<AgentConfigPanel agentId={1} agentName="Test Agent" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Test Agent Configuration')).toBeInTheDocument();
      expect(screen.getByText('Safety')).toBeInTheDocument();
      expect(screen.getByText('Research')).toBeInTheDocument();
    });
  });

  it('switches to evaluators tab and adds assignment', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/prompt-templates/') return Promise.resolve({ data: [] });
      if (url.includes('/api/agent-prompt-assignments/')) return Promise.resolve({ data: [] });
      if (url === '/api/evaluation-templates/') {
        return Promise.resolve({
          data: [
            { id: 20, name: 'Hallucination Check', category: 'quality', version: 1 }
          ]
        });
      }
      if (url.includes('/api/evaluation-assignments/')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    api.post.mockResolvedValue({ data: { id: 1, agent: 1, evaluation_template: 20, enabled: true } });

    render(<AgentConfigPanel agentId={1} agentName="Test Agent" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Test Agent Configuration')).toBeInTheDocument();
    });

    // Switch tabs
    fireEvent.click(screen.getByText('Evaluators'));

    await waitFor(() => {
      expect(screen.getByText('Hallucination Check')).toBeInTheDocument();
    });

    // Click to add assignment
    fireEvent.click(screen.getByText('Hallucination Check'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/evaluation-assignments/', expect.objectContaining({
        agent: 1,
        evaluation_template: 20,
        enabled: true
      }));
    });
  });

  it('toggles existing evaluation assignment via PUT', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/prompt-templates/') return Promise.resolve({ data: [] });
      if (url.includes('/api/agent-prompt-assignments/')) return Promise.resolve({ data: [] });
      if (url === '/api/evaluation-templates/') {
        return Promise.resolve({ data: [{ id: 20, name: 'Hallucination Check', category: 'quality', version: 1 }] });
      }
      if (url.includes('/api/evaluation-assignments/')) {
        return Promise.resolve({ data: [{ id: 50, agent: 1, evaluation_template: 20, enabled: true }] });
      }
      return Promise.resolve({ data: [] });
    });

    api.put.mockResolvedValue({ data: { id: 50, agent: 1, evaluation_template: 20, enabled: false } });

    render(<AgentConfigPanel agentId={1} agentName="Test Agent" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Test Agent Configuration')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Evaluators'));
    await waitFor(() => expect(screen.getByText('Hallucination Check')).toBeInTheDocument());

    // Click to toggle existing assignment (disable it)
    fireEvent.click(screen.getByText('Hallucination Check'));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/api/evaluation-assignments/50/', expect.objectContaining({
        enabled: false
      }));
    });
  });

  it('allows user to specify and save specific task instructions for the node', async () => {
    // 1. Setup mock data
    api.get.mockImplementation((url) => {
      if (url === '/api/agents/1/') {
        return Promise.resolve({ data: { id: 1, name: 'Web Researcher', instructions: 'Initial instruction' } });
      }
      if (url === '/api/prompt-templates/') return Promise.resolve({ data: [] });
      if (url.includes('/api/agent-prompt-assignments/')) return Promise.resolve({ data: [] });
      if (url === '/api/evaluation-templates/') return Promise.resolve({ data: [] });
      if (url.includes('/api/evaluation-assignments/')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    api.patch.mockResolvedValue({ data: { id: 1, instructions: 'Search for AI news' } });

    // 2. Render component
    render(<AgentConfigPanel agentId={1} agentName="Test Agent" onClose={() => {}} />);

    // 3. Wait for instructions to load in the textarea
    await waitFor(() => {
      expect(screen.getByLabelText(/Specific Task Instructions/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Specific Task Instructions/i)).toHaveValue('Initial instruction');
    });

    // 4. Update textarea
    const textarea = screen.getByLabelText(/Specific Task Instructions/i);
    fireEvent.change(textarea, { target: { value: 'Search for AI news' } });
    
    // 5. Fire click on the Save button
    const saveButton = screen.getByRole('button', { name: /Save Instructions/i });
    fireEvent.click(saveButton);

    // 6. Verify API was called
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/api/agents/1/', {
        instructions: 'Search for AI news'
      });
    });
  });

  it('creates new prompt assignment via POST', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/prompt-templates/') {
        return Promise.resolve({ data: [{ id: 10, name: 'Safety', category: 'safety', version: 1 }] });
      }
      if (url.includes('/api/agent-prompt-assignments/')) return Promise.resolve({ data: [] });
      if (url === '/api/evaluation-templates/') return Promise.resolve({ data: [] });
      if (url.includes('/api/evaluation-assignments/')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    api.post.mockResolvedValue({ data: { id: 100, agent: 1, prompt_template: 10, enabled: true } });

    render(<AgentConfigPanel agentId={1} agentName="Test Agent" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Safety')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Safety'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/agent-prompt-assignments/', expect.objectContaining({
        agent: 1,
        prompt_template: 10,
        enabled: true
      }));
    });
  });

  it('toggles existing prompt assignment via PUT', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/prompt-templates/') {
        return Promise.resolve({ data: [{ id: 10, name: 'Safety', category: 'safety', version: 1 }] });
      }
      if (url.includes('/api/agent-prompt-assignments/')) {
        return Promise.resolve({ data: [{ id: 100, agent: 1, prompt_template: 10, enabled: true }] });
      }
      if (url === '/api/evaluation-templates/') return Promise.resolve({ data: [] });
      if (url.includes('/api/evaluation-assignments/')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    api.put.mockResolvedValue({ data: { id: 100, agent: 1, prompt_template: 10, enabled: false } });

    render(<AgentConfigPanel agentId={1} agentName="Test Agent" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Safety')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Safety'));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/api/agent-prompt-assignments/100/', expect.objectContaining({
        enabled: false
      }));
    });
  });

  it('handles API errors gracefully during assignment', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    api.get.mockImplementation((url) => {
      if (url === '/api/prompt-templates/') {
        return Promise.resolve({ data: [{ id: 10, name: 'Safety', category: 'safety', version: 1 }] });
      }
      if (url.includes('/api/agent-prompt-assignments/')) return Promise.resolve({ data: [] });
      if (url === '/api/evaluation-templates/') return Promise.resolve({ data: [] });
      if (url.includes('/api/evaluation-assignments/')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    // Simulate an API failure
    api.post.mockRejectedValue(new Error('Network Error'));

    render(<AgentConfigPanel agentId={1} agentName="Test Agent" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Safety')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Safety'));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
    });

    consoleErrorSpy.mockRestore();
  });

  it('allows user to run the node separately', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/agents/1/') return Promise.resolve({ data: { id: 1, name: 'Web Researcher', instructions: '' } });
      if (url === '/api/prompt-templates/') return Promise.resolve({ data: [] });
      if (url.includes('/api/agent-prompt-assignments/')) return Promise.resolve({ data: [] });
      if (url === '/api/evaluation-templates/') return Promise.resolve({ data: [] });
      if (url.includes('/api/evaluation-assignments/')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    api.post.mockResolvedValue({ data: { status: 'started' } });

    render(<AgentConfigPanel agentId={1} agentName="Test Agent" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Test Agent Configuration')).toBeInTheDocument());

    const runButton = screen.getByRole('button', { name: /Run Node/i });
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/agents/1/run/');
    });
  });
});
