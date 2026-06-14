import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import TopicCreateWizard from './TopicCreateWizard';

describe('TopicCreateWizard', () => {
  it('creates a strategy workspace successfully', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn();
    
    render(
      <BrowserRouter>
        <TopicCreateWizard onSubmit={mockOnSubmit} />
      </BrowserRouter>
    );
    
    // 1. User can open TopicCreateWizard.
    expect(screen.getByRole('heading', { name: /Create Strategy Workspace/i, level: 1 })).toBeInTheDocument();
    
    // 2. User enters details
    const titleInput = screen.getByLabelText(/Topic/i);
    const objectiveInput = screen.getByLabelText(/Objective/i);
    const contextInput = screen.getByLabelText(/Strategic context/i);
    
    await user.type(titleInput, 'Search for Supermarket');
    await user.type(objectiveInput, 'Improve supermarket search relevance, discovery, and conversion');
    await user.type(contextInput, 'Algolia implementation for supermarket search');
    
    // 3. User sees preview workstreams
    expect(screen.getByText(/Competitive Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Market Metrics/i)).toBeInTheDocument();
    expect(screen.getByText(/Implementation Plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Risk Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Product Strategy/i)).toBeInTheDocument();
    expect(screen.getByText(/Roadmap/i)).toBeInTheDocument();
    expect(screen.getByText(/Execution Tracking/i)).toBeInTheDocument();
    
    // 4. User submits.
    const submitButton = screen.getByRole('button', { name: /Create Strategy Workspace/i });
    await user.click(submitButton);
    
    // 5. API is called with correct payload.
    expect(mockOnSubmit).toHaveBeenCalledWith({
      title: 'Search for Supermarket',
      objective: 'Improve supermarket search relevance, discovery, and conversion',
      strategicContext: 'Algolia implementation for supermarket search'
    });
    
    // 6. Success state shows:
    expect(screen.getByText(/Strategy workspace created/i)).toBeInTheDocument();
    
    // 7. User is navigated to topic command centre
    // (Can be verified via mockOnSubmit or router mock if we used React Router)
  });
});
