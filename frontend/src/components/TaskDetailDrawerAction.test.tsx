import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicCommandCentre from './TopicCommandCentre';

describe('TaskDetailDrawer - Action Results', () => {
  it('displays action results in the task drawer', async () => {
    // Mock the task fetch to include linked actions
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/tasks/1/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 1,
            title: 'Create Algolia implementation plan',
            status: 'completed',
            actions: [
              {
                id: 50,
                title: 'Email Eng Team',
                status: 'executed',
                execution_result: { message_id: '12345', status: 'sent' }
              }
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);
    
    // Find the Task Ledger row and click it
    const taskRow = await screen.findAllByText(/Create Algolia implementation plan/i);
    await user.click(taskRow[1]); // second one is the table row
    
    // Check that the TaskDetailDrawer opens and shows the action result
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Email Eng Team')).toBeInTheDocument();
      expect(screen.getByText(/message_id/)).toBeInTheDocument();
    });
  });
});
