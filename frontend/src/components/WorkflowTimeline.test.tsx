import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorkflowExecutionPanel from './WorkflowExecutionPanel';

describe('WorkflowTimeline and Execution Flow', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/workflows/1/start')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'paused' })
        });
      }
      if (url.includes('/api/workflows/1/resume')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'completed' })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('supports starting, pausing, and resuming real workflows via backend', async () => {
    const user = userEvent.setup();
    render(<WorkflowExecutionPanel />);

    // 1. User clicks Start Workflow
    const startButton = screen.getByRole('button', { name: /Start Workflow/i });
    await user.click(startButton);

    // 2. WorkflowTimeline appears
    await waitFor(() => {
      expect(screen.getByTestId('workflow-timeline')).toBeInTheDocument();
    });

    // 3. Timeline shows nodes
    expect(screen.getByText('load_plan')).toBeInTheDocument();
    expect(screen.getByText('pause_for_task_approval')).toBeInTheDocument();

    // 5. Paused nodes have paused status
    await waitFor(() => {
      expect(screen.getByTestId('node-pause_for_task_approval')).toHaveAttribute('data-status', 'paused');
    });

    // 6. Current node is visually highlighted
    expect(screen.getByTestId('node-pause_for_task_approval')).toHaveAttribute('data-current', 'true');

    // 7. PausedApprovalCard shows task requiring approval
    expect(screen.getByTestId('paused-approval-card')).toBeInTheDocument();

    // 8. User approves paused task
    const approveTaskButton = screen.getByRole('button', { name: /Approve Task/i });
    await user.click(approveTaskButton);

    // 9. User clicks Resume Workflow
    const resumeButton = screen.getByRole('button', { name: /Resume Workflow/i });
    await user.click(resumeButton);

    // 10. Timeline updates with additional completed steps
    await waitFor(() => {
      expect(screen.getByTestId('node-pause_for_task_approval')).toHaveAttribute('data-status', 'completed');
    });

    // 11. WorkflowTelemetryPanel shows stats
    expect(screen.getByTestId('telemetry-panel')).toBeInTheDocument();
  });
});
