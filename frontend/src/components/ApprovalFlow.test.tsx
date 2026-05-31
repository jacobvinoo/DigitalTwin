import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicCommandCentre from './TopicCommandCentre';

describe('Approval Interactions', () => {
  it('handles approval flow successfully', async () => {
    const user = userEvent.setup();
    const mockApproveAPI = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = mockApproveAPI as any;

    render(<TopicCommandCentre topicId="1" />);

    // 1. ApprovalQueue shows only approval_required tasks.
    const queue = screen.getByTestId('approval-queue');
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
    const approveButton = screen.getByRole('button', { name: /Approve/i });
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
