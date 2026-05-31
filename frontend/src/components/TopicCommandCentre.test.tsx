import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicCommandCentre from './TopicCommandCentre';

describe('TopicCommandCentre', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/actions/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/api/topics/1/command-centre')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            active_tasks_count: 8,
            completed_tasks_count: 0,
            pending_approval_count: 4,
            average_quality_score: "Not scored"
          })
        });
      }
      if (url.includes('/api/topics/1/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 1,
            title: "Search for Supermarket",
            objective: "Improve supermarket search relevance",
            status: "Active"
          })
        });
      }
      if (url.includes('/api/tasks/1/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 1, title: "Create Algolia implementation plan", workstream: "Implementation Plan", risk: "medium", status: "proposed", approval: "required", score: "-"
          })
        });
      }
      if (url.includes('/api/tasks/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 1, title: "Create Algolia implementation plan", workstream: "Implementation Plan", risk: "medium", status: "proposed", approval: "required", score: "-" },
            { id: 2, title: "Identify product, technical, adoption, and data risks", workstream: "Risk Analysis", risk: "high", status: "proposed", approval: "required", score: "-" },
            { id: 3, title: "Create product strategy narrative", workstream: "Product Strategy", risk: "medium", status: "proposed", approval: "required", score: "-" },
            { id: 4, title: "Create 30/60/90 day roadmap", workstream: "Roadmap", risk: "medium", status: "proposed", approval: "required", score: "-" },
            { id: 5, title: "Analyse current supermarket search experience", workstream: "Competitive Analysis", risk: "low", status: "in_progress", approval: "not required", score: "-" }
          ])
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('renders all required panels and supports task detail viewing with real backend', async () => {
    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);
    
    // 1. Page loads topic title
    await waitFor(() => {
      expect(screen.getByText(/Search for Supermarket/i)).toBeInTheDocument();
    });
    
    // 2. Shows objective
    expect(screen.getByText(/Improve supermarket search relevance/i)).toBeInTheDocument();
    
    // 3. Shows summary cards
    expect(screen.getByText(/Active tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/Completed tasks/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Pending approvals/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Average quality score/i)).toBeInTheDocument();
    
    // 5. Shows approval queue with medium/high-risk tasks
    await waitFor(() => {
      const approvalQueue = screen.getByTestId('approval-queue');
      expect(approvalQueue).toHaveTextContent(/Create Algolia implementation plan/i);
    });
    
    const approvalQueue = screen.getByTestId('approval-queue');
    expect(approvalQueue).toHaveTextContent(/Identify product, technical, adoption, and data risks/i);
    expect(approvalQueue).toHaveTextContent(/Create product strategy narrative/i);
    expect(approvalQueue).toHaveTextContent(/Create 30\/60\/90 day roadmap/i);
    
    // 6. Shows next actions panel
    expect(screen.getByText(/Next Actions/i)).toBeInTheDocument();
    
    // 7. Shows task ledger table
    expect(screen.getByRole('table', { name: /Task Ledger/i })).toBeInTheDocument();
    
    // 8. Clicking a task opens TaskDetailDrawer
    const taskRow = screen.getAllByText(/Create Algolia implementation plan/i)[1]; // The table row is the second one
    await user.click(taskRow);
    
    // 9. TaskDetailDrawer shows details
    await waitFor(() => {
      const drawer = screen.getByRole('dialog', { name: /Task Detail/i });
      expect(drawer).toHaveTextContent(/status/i);
      expect(drawer).toHaveTextContent(/risk level/i);
      expect(drawer).toHaveTextContent(/approval required/i);
    });
    
    // 10. UI should not show "agent is working autonomously"
    expect(screen.queryByText(/agent is working autonomously/i)).not.toBeInTheDocument();
  });
});
