import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicCommandCentre from './TopicCommandCentre';

describe('TopicCommandCentre Revision State', () => {
  beforeEach(() => {
    localStorage.setItem('tasks', JSON.stringify([
      { 
        id: 99, 
        title: "Draft email", 
        workstream: "Testing", 
        risk: "low", 
        status: "blocked", 
        approval: "not required",
        governance: { revision_required: true },
        outputs: {
            executive_review: { required_revisions: ["Change tone", "Add data"] },
            output_versions: [{ data: "old_v1" }]
        }
      }
    ]));
  });

  it('renders revision required state in drawer', async () => {
    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);
    
    const taskRow = screen.getByText(/Draft email/i);
    await user.click(taskRow);
    
    expect(screen.getByText(/Revision required/i)).toBeInTheDocument();
    expect(screen.getByText(/Change tone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Accept revision request/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rerun task/i })).toBeInTheDocument();
    expect(screen.getByText(/old_v1/i)).toBeInTheDocument();
  });
});
