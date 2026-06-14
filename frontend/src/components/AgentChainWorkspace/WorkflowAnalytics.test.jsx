import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WorkflowAnalytics from './WorkflowAnalytics';

describe('WorkflowAnalytics', () => {
  it('renders the analytics dashboard with KPIs', () => {
    render(<WorkflowAnalytics />);
    
    // Check main title
    expect(screen.getByText('Workflow Analytics')).toBeInTheDocument();
    
    // Check KPIs
    expect(screen.getByText('Avg Chain Score')).toBeInTheDocument();
    expect(screen.getByText('Acceptance Rate')).toBeInTheDocument();
    expect(screen.getByText('Avg Revisions')).toBeInTheDocument();
    expect(screen.getByText('Hallucination Risk')).toBeInTheDocument();
  });

  it('renders the agent performance table', () => {
    render(<WorkflowAnalytics />);
    
    // Check table headers
    expect(screen.getByText('Agent Node')).toBeInTheDocument();
    expect(screen.getByText('Exec. Score')).toBeInTheDocument();
    expect(screen.getByText('Acceptance')).toBeInTheDocument();
    
    // Check mock data agents
    expect(screen.getByText('Web Researcher')).toBeInTheDocument();
    expect(screen.getByText('Summarizer')).toBeInTheDocument();
    expect(screen.getByText('Report Writer')).toBeInTheDocument();
  });

  it('renders alerts', () => {
    render(<WorkflowAnalytics />);
    expect(screen.getByText(/Attention Required: Summarizer Node/i)).toBeInTheDocument();
  });
});
