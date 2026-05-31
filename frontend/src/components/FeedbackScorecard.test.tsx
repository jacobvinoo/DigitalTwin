import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicCommandCentre from './TopicCommandCentre';

describe('Feedback and Scorecard', () => {
  it('allows user to submit feedback and scorecards', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    globalThis.fetch = mockFetch as any;

    render(<TopicCommandCentre topicId="1" />);

    // Open a task to see TaskDetailDrawer
    const taskRow = screen.getAllByText(/Create Algolia implementation plan/i)[1];
    await user.click(taskRow);

    const drawer = screen.getByRole('dialog', { name: /Task Detail/i });
    expect(drawer).toBeInTheDocument();

    // 1. TaskDetailDrawer has FeedbackPanel.
    expect(screen.getByRole('heading', { name: /Add Feedback/i })).toBeInTheDocument();

    // 2. User enters text.
    const feedbackInput = screen.getByPlaceholderText(/Enter your feedback/i);
    await user.type(feedbackInput, 'This is too generic. Add stronger NZ supermarket search context.');

    // 3. User submits feedback.
    const submitFeedbackBtn = screen.getByRole('button', { name: /Submit Feedback/i });
    await user.click(submitFeedbackBtn);

    // Mock API called
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/feedback'), expect.any(Object));

    // 4. Feedback appears in task history.
    await waitFor(() => {
      expect(screen.getByText(/This is too generic. Add stronger NZ supermarket search context./i)).toBeInTheDocument();
      // 5. UI shows: “Not yet approved for reusable memory”
      expect(screen.getByText(/Not yet approved for reusable memory/i)).toBeInTheDocument();
    });

    // 6. User adds scorecard values.
    const qualityInput = screen.getByLabelText(/Quality Score/i);
    await user.clear(qualityInput);
    await user.type(qualityInput, '8');
    
    const saveScoreBtn = screen.getByRole('button', { name: /Save Scorecard/i });
    await user.click(saveScoreBtn);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/score'), expect.any(Object));

    // 7. PerformanceSummary updates.
    const closeBtn = screen.getByRole('button', { name: /✕/i });
    await user.click(closeBtn);
    
    await waitFor(() => {
      const avgQuality = screen.getByText(/Average quality score/i).nextElementSibling;
      expect(avgQuality).toHaveTextContent(/8/i);
    });
  });
});
