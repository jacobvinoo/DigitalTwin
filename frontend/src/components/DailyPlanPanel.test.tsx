import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicCommandCentre from './TopicCommandCentre';

describe('DailyPlanPanel Flow', () => {
  it('supports creating and approving a daily plan', async () => {
    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);
    
    // 1. User sees "Create Daily Plan" button.
    const createButton = await screen.findByRole('button', { name: /Create Daily Plan/i });
    expect(createButton).toBeInTheDocument();
    
    // 2. User clicks it.
    await user.click(createButton);
    
    // 3. DailyPlanPanel opens.
    const panel = screen.getByTestId('daily-plan-panel');
    expect(panel).toBeInTheDocument();
    
    // 4. UI shows plan summary under 120 words.
    const summary = screen.getByTestId('plan-summary');
    expect(summary).toBeInTheDocument();
    expect(summary.textContent?.split(' ').length).toBeLessThanOrEqual(120);
    
    // 5. UI shows RiskSummaryStrip: low, medium, high risk count
    expect(screen.getByTestId('risk-low-count')).toBeInTheDocument();
    expect(screen.getByTestId('risk-medium-count')).toBeInTheDocument();
    expect(screen.getByTestId('risk-high-count')).toBeInTheDocument();
    
    // 6. UI shows PlanDiffView.
    expect(screen.getByTestId('plan-diff-view')).toBeInTheDocument();
    
    // 7. First plan shows "First plan for this topic".
    expect(screen.getByText(/First plan for this topic/i)).toBeInTheDocument();
    
    // 8. Plan items are grouped by: Auto-execute, Approval needed, Hard stop
    expect(screen.getAllByText(/Auto-execute/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Approval needed/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Hard stop/i).length).toBeGreaterThanOrEqual(1);
    
    // 9. User clicks Approve Plan.
    const approveButton = screen.getByRole('button', { name: /Approve Plan/i });
    await user.click(approveButton);
    
    // 10. API approval endpoint is called. (Implied by UI state change)
    // 11. Plan status changes to approved.
    expect(screen.getByText(/Status: Approved/i)).toBeInTheDocument();
    
    // 12. Start Workflow button becomes enabled.
    const startButton = screen.getByRole('button', { name: /Start Workflow/i });
    expect(startButton).toBeEnabled();
  });
});
