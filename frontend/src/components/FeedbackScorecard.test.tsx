import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicCommandCentre from './TopicCommandCentre';

describe('Feedback and Scorecard', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('allows user to submit feedback and scorecards', async () => {
    const user = userEvent.setup();
    let averageQualityScore: string | number = "Not scored";
    const mockFetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes('/command-centre/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            active_tasks_count: 8,
            completed_tasks_count: 0,
            pending_approval_count: 4,
            average_quality_score: averageQualityScore
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
      if (url.includes('/api/tasks/1/score/')) {
        if (options && options.body) {
          const body = JSON.parse(options.body);
          if (body.quality) {
            averageQualityScore = body.quality;
          }
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: "scorecard created" }) });
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
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    globalThis.fetch = mockFetch as any;

    render(<TopicCommandCentre topicId="1" />);

    // Open a task to see TaskDetailDrawer
    const taskRow = (await screen.findAllByText(/Create Algolia implementation plan/i))[1];
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
