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

  it('renders task category tags and interactive execution actions inside the task drawer', async () => {
    const user = userEvent.setup();
    
    // Override fetch implementation to mock task with actions
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/actions/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/api/topics/1/command-centre')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ active_tasks_count: 1 }) });
      }
      if (url.includes('/api/topics/1/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1, title: "Search Topic" }) });
      }
      if (url.includes('/api/tasks/1/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 1,
            title: "Create 30/60/90 day roadmap",
            workstream: "Roadmap",
            risk: "medium",
            status: "completed",
            approval: "required",
            score: "-",
            actions: [
              {
                id: 10,
                title: "30-Day Plan - Setup sandbox",
                action_type: "follow_up_task",
                instruction: "Configure credentials",
                status: "proposed",
                risk_level: "medium",
                approval_required: true
              }
            ]
          })
        });
      }
      if (url.includes('/api/tasks/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 1, title: "Create 30/60/90 day roadmap", workstream: "Roadmap", risk: "medium", status: "completed", approval: "required", score: "-" }
          ])
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<TopicCommandCentre topicId="1" />);

    // 1. Task row contains the "Planning" category tag
    await waitFor(() => {
      const planningBadge = screen.getByText('Planning');
      expect(planningBadge).toBeInTheDocument();
    });

    // 2. Click task to open drawer
    const taskRow = screen.getByText(/Create 30\/60\/90 day roadmap/i);
    await user.click(taskRow);

    // 3. Verify drawer opens and shows action with "Execution" tag
    await waitFor(() => {
      const drawer = screen.getByRole('dialog', { name: /Task Detail/i });
      expect(drawer).toHaveTextContent(/Execution Actions/i);
      expect(drawer).toHaveTextContent(/30-Day Plan - Setup sandbox/i);
      expect(screen.getByText('Execution')).toBeInTheDocument();
    });

    // 4. Verify "Approve" button is present for proposed medium risk action
    const approveBtn = screen.getByRole('button', { name: 'Approve' });
    expect(approveBtn).toBeInTheDocument();
  });

  it('renders draft tasks from planning and handles adding them to the board', async () => {
    const user = userEvent.setup();
    
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/actions/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/api/topics/1/command-centre')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ active_tasks_count: 1 }) });
      }
      if (url.includes('/api/topics/1/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1, title: "Search Topic" }) });
      }
      if (url.includes('/api/tasks/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 1, title: "Draft Focus Task", workstream: "Roadmap", risk: "medium", status: "proposed", approval: "required", score: "-", governance: { is_draft: true } }
          ])
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<TopicCommandCentre topicId="1" />);

    // 1. Shows "Draft Tasks from Planning" panel
    await waitFor(() => {
      expect(screen.getByTestId('draft-tasks-panel')).toBeInTheDocument();
      expect(screen.getByText('Draft Focus Task')).toBeInTheDocument();
    });

    // 2. Click "Add to Board" button
    const addBtn = screen.getByRole('button', { name: /Add to Board/i });
    await user.click(addBtn);

    // 3. Verify fetch endpoint called
    expect(global.fetch).toHaveBeenCalledWith('/api/tasks/1/add-to-board/', { method: 'POST' });
  });
});
