import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ActionCreateDrawer } from './ActionCreateDrawer';
import { ActionInbox } from './ActionInbox';

describe('ActionCreateDrawer', () => {
  it('submits a new action request', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    const onClose = vi.fn();

    render(<ActionCreateDrawer topicId="t1" isOpen={true} onClose={onClose} onSubmit={onSubmit} />);
    
    fireEvent.change(screen.getByLabelText(/Action Type/i), { target: { value: 'email_draft' } });
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Test Action' } });
    fireEvent.change(screen.getByLabelText(/Instruction/i), { target: { value: 'Do this' } });
    
    fireEvent.click(screen.getByText('Create Action'));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        topic: 't1',
        action_type: 'email_draft',
        title: 'Test Action',
        instruction: 'Do this'
      });
      expect(onClose).toHaveBeenCalled();
    });
  });
});

describe('ActionInbox', () => {
  it('renders actions and handles selection', () => {
    const actions = [
      { id: 1, title: 'Action 1', status: 'awaiting_approval', risk_level: 'high' },
      { id: 2, title: 'Action 2', status: 'executed', risk_level: 'low' }
    ];
    const onSelectAction = vi.fn();
    
    render(<ActionInbox actions={actions} onSelectAction={onSelectAction} />);
    
    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Action 2')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Action 1'));
    expect(onSelectAction).toHaveBeenCalledWith(actions[0]);
  });
});
