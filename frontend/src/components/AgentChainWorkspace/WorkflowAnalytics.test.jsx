import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorkflowAnalytics from './WorkflowAnalytics';
import api from '../../api';

vi.mock('../../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('WorkflowAnalytics', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    api.get.mockResolvedValue({
      data: {
        overall_kpis: {
          avg_chain_score: 8.5,
          acceptance_rate: 90.0,
          avg_revisions: 2.0,
          hallucination_risk: 0.5
        },
        metrics: [
          {
            id: 1,
            agent: 'Analysis Node',
            score: 8.5,
            trend: 0.2,
            acceptance: 90.0,
            revisions: 2,
            executions: 10
          }
        ],
        recommendations: [
          {
            id: 1,
            agent__name: 'Analysis Node',
            issue_type: 'Quality Evaluator',
            problem: 'Missing sources',
            recommended_change: 'Add 3 sources'
          }
        ]
      }
    });
  });

  it('renders the analytics dashboard with dynamic KPIs', async () => {
    render(<WorkflowAnalytics topicId={1} />);
    
    // Check main title (waits for loading to finish)
    expect(await screen.findByText('Workflow Analytics')).toBeInTheDocument();
    
    // Check KPI titles
    expect(screen.getByText('Avg Chain Score')).toBeInTheDocument();
    expect(screen.getByText('Acceptance Rate')).toBeInTheDocument();
    expect(screen.getByText('Avg Revisions')).toBeInTheDocument();
    expect(screen.getByText('Hallucination Risk')).toBeInTheDocument();
    
    // Dynamic KPI values
    expect(screen.getAllByText(/8\.5/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/90/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0\.5/).length).toBeGreaterThan(0);
  });

  it('renders the agent performance table with dynamic agents', async () => {
    render(<WorkflowAnalytics topicId={1} />);
    
    expect(await screen.findByText('Agent Node')).toBeInTheDocument();
    expect(screen.getByText('Exec. Score')).toBeInTheDocument();
    expect(screen.getByText('Acceptance')).toBeInTheDocument();
    
    // Check dynamic data agent
    expect(screen.getByText('Analysis Node')).toBeInTheDocument();
  });

  it('renders alerts', async () => {
    render(<WorkflowAnalytics topicId={1} />);
    expect(await screen.findByText(/Low Score Detected: Analysis Node/i)).toBeInTheDocument();
  });
});
