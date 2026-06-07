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
