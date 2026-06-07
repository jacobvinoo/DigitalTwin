import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicCommandCentre from './TopicCommandCentre';

describe('Approval Interactions', () => {
  it('handles approval flow successfully', async () => {
    const user = userEvent.setup();
    const mockApproveAPI = vi.fn().mockImplementation((url, options) => {
      if (url.includes('/command-centre/')) {
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
      if (url.includes('/api/topics/')) {
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
      if (url.includes('/api/tasks/1/approve/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: "approved" })
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
      if (url.includes('/api/tasks')) {
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
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    globalThis.fetch = mockApproveAPI as any;

    render(<TopicCommandCentre topicId="1" />);

    // 1. ApprovalQueue shows only approval_required tasks.
    const queue = await screen.findByTestId('approval-queue');
    expect(queue).toHaveTextContent(/Create Algolia implementation plan/i);
    expect(queue).not.toHaveTextContent(/Analyse current supermarket search experience/i);

    // 2. User clicks “Review”.
    const reviewButtons = screen.getAllByRole('button', { name: /Review/i });
    await user.click(reviewButtons[0]);

    // 3. TaskDetailDrawer opens.
    const drawer = screen.getByRole('dialog', { name: /Task Detail/i });
    expect(drawer).toBeInTheDocument();

    // 4. User sees risk level and approval reason.
    expect(drawer).toHaveTextContent(/Risk Level:/i);
    expect(drawer).toHaveTextContent(/Approval Reason/i);

    // 5. User clicks “Approve”.
    const approveButton = screen.getByRole('button', { name: /^Approve$/ });
    await user.click(approveButton);

    // 6. API approve endpoint is called.
    expect(mockApproveAPI).toHaveBeenCalledWith(expect.stringContaining('/approve/'), expect.any(Object));

    // Wait for the UI to update
    await waitFor(() => {
      // 7. Task moves from proposed to approved (status changes to 'approved')
      expect(screen.getByRole('dialog', { name: /Task Detail/i })).toHaveTextContent(/Status: approved/i);
      
      // 8. Pending approvals count decreases by one.
      const pendingCount = screen.getByTestId('pending-count');
      expect(pendingCount).toHaveTextContent('3');
    });
  });
});
