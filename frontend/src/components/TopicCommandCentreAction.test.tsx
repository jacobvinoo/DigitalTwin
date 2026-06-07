import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicCommandCentre from './TopicCommandCentre';

describe('TopicCommandCentre - Actions Tab', () => {
  it('manages action lifecycle in Actions tab', async () => {
    // Mock global fetch to handle action creation
    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes('/api/actions/') && options?.method === 'POST') {
        const payload = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 99,
            title: payload.title,
            action_type: payload.action_type,
            status: 'drafted',
            risk_level: 'medium',
            generated_output: {
              subject: 'Algolia Metrics Request',
              recipients: ['search-team@example.com'],
              body: 'Please provide the latest metrics.'
            }
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);

    // 1. User sees Actions tab in topic
    const actionsTab = await screen.findByRole('button', { name: /Actions/i });
    expect(actionsTab).toBeInTheDocument();
    await user.click(actionsTab);

    // 2. User can create action request
    const createButton = screen.getByRole('button', { name: /Propose New Action/i });
    expect(createButton).toBeInTheDocument();
    await user.click(createButton);

    // 3. User selects action type: Email Draft
    const actionTypeSelect = await screen.findByLabelText(/Action Type/i);
    await user.selectOptions(actionTypeSelect, 'email_draft');

    // 4. User enters instruction
    const titleInput = screen.getByLabelText(/Title/i);
    await user.type(titleInput, 'Request Algolia Metrics');
    
    const instructionInput = screen.getByLabelText(/Instruction/i);
    await user.type(instructionInput, 'Draft an email to the Search team asking for Algolia metrics before Friday.');
    
    const submitBtn = screen.getByRole('button', { name: /Create Action/i });
    await user.click(submitBtn);

    // 5. Draft action appears in ActionInbox and UI shows risk badge
    await waitFor(() => {
      expect(screen.getByText('Request Algolia Metrics')).toBeInTheDocument();
      expect(screen.getByText('Medium Risk')).toBeInTheDocument();
    });

    // 6. User opens action detail
    const actionRow = screen.getByText('Request Algolia Metrics');
    await user.click(actionRow);

    // 7. User sees approval status and generated draft
    await waitFor(() => {
      expect(screen.getByText('Algolia Metrics Request')).toBeInTheDocument();
      expect(screen.getByText('search-team@example.com')).toBeInTheDocument();
    });
  });

  it('manages action approval and execution lifecycle safely', async () => {
    // Mock fetch for execute and approve
    let actionState: any = {
      id: 100,
      title: 'Send Report',
      action_type: 'email_send',
      status: 'awaiting_approval',
      risk_level: 'high',
      approval_required: true,
      generated_output: {
        subject: 'Weekly Report',
        recipients: ['team@example.com'],
        body: 'Here is the report.',
        approval_summary: 'This action will send an external email.'
      },
      execution_result: null
    };

    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes('/api/actions/') && !options) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([actionState]) });
      }
      if (url.includes('/approve/')) {
        actionState.status = 'approved';
        return Promise.resolve({ ok: true, json: () => Promise.resolve(actionState) });
      }
      if (url.includes('/reject/')) {
        actionState.status = 'rejected';
        return Promise.resolve({ ok: true, json: () => Promise.resolve(actionState) });
      }
      if (url.includes('/execute/')) {
        actionState.status = 'executed';
        actionState.execution_result = { message_id: 'msg-abc', status: 'sent' };
        return Promise.resolve({ ok: true, json: () => Promise.resolve(actionState) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);

    await user.click(await screen.findByRole('button', { name: /Actions/i }));
    
    // Select the action
    await waitFor(() => {
      expect(screen.getByText('Send Report')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Send Report'));

    // 1. EmailDraftPreview shows subject, recipients, body.
    expect(screen.getByText('Weekly Report')).toBeInTheDocument();
    expect(screen.getByText('team@example.com')).toBeInTheDocument();
    
    // 2. ApprovalPanel shows exactly what will happen.
    expect(screen.getByText(/This action will send an external email/i)).toBeInTheDocument();

    // 3. Send/Execute button remains disabled until approved.
    const executeBtn = screen.getByRole('button', { name: /Execute Action/i });
    expect(executeBtn).toBeDisabled();

    // 4. User can approve draft.
    const approveBtn = screen.getByRole('button', { name: /Approve Action/i });
    await user.click(approveBtn);

    await waitFor(() => {
      expect(executeBtn).not.toBeDisabled();
    });

    // 5. UI never says email was sent before execution result exists.
    expect(screen.queryByText(/msg-abc/)).not.toBeInTheDocument();

    // 6. User executes
    await user.click(executeBtn);

    // 7. Executed action shows result.
    await waitFor(() => {
      expect(screen.getByText(/msg-abc/)).toBeInTheDocument();
    });
  });

  it('handles action execution failure gracefully without crashing', async () => {
    let actionState = {
      id: 101,
      title: 'Failed Action Send',
      action_type: 'email_send',
      status: 'approved',
      risk_level: 'high',
      approval_required: true,
      generated_output: {
        subject: 'Fail Report',
        recipients: ['team@example.com'],
        body: 'Here is the report.',
      },
      execution_result: null
    };

    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes('/api/actions/') && !options) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([actionState]) });
      }
      if (url.includes('/execute/')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: 'Must approve high-risk action before execution' })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);

    await user.click(await screen.findByRole('button', { name: /Actions/i }));
    
    await waitFor(() => {
      expect(screen.getByText('Failed Action Send')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Failed Action Send'));

    const executeBtn = screen.getByRole('button', { name: /Execute Action/i });
    expect(executeBtn).not.toBeDisabled();

    // Trigger execute which will fail (status 400)
    await user.click(executeBtn);

    // Verify error toast message is displayed and UI is intact
    await waitFor(() => {
      expect(screen.getByText('Must approve high-risk action before execution')).toBeInTheDocument();
      expect(screen.getAllByText('Failed Action Send').length).toBeGreaterThan(0);
    });
  });

  it('allows the user to delete an action request from the details panel', async () => {
    let actionState = {
      id: 100,
      title: 'Send Report To Delete',
      action_type: 'email_send',
      status: 'awaiting_approval',
      risk_level: 'high',
      approval_required: true,
      generated_output: {
        subject: 'Weekly Report',
        recipients: ['team@example.com'],
        body: 'Here is the report.',
      },
      execution_result: null
    };

    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let deleteCalled = false;

    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes('/api/actions/') && options?.method === 'DELETE') {
        deleteCalled = true;
        return Promise.resolve({ ok: true });
      }
      if (url.includes('/api/actions/') && !options) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([actionState]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);

    await user.click(await screen.findByRole('button', { name: /Actions/i }));
    
    // Select the action
    await waitFor(() => {
      expect(screen.getByText('Send Report To Delete')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Send Report To Delete'));

    // Locate Delete Action button and click it
    const deleteBtn = await screen.findByRole('button', { name: /Delete Action Request/i });
    expect(deleteBtn).toBeInTheDocument();
    await user.click(deleteBtn);

    // Assert fetch DELETE was called and action is removed from UI
    await waitFor(() => {
      expect(deleteCalled).toBe(true);
      expect(screen.queryByText('Send Report To Delete')).not.toBeInTheDocument();
    });
  });

  it('allows the user to delete an action request inline from the inbox', async () => {
    let actionState = {
      id: 100,
      title: 'Send Report To Delete Inline',
      action_type: 'email_send',
      status: 'awaiting_approval',
      risk_level: 'high',
      approval_required: true,
      generated_output: {
        subject: 'Weekly Report',
        recipients: ['team@example.com'],
        body: 'Here is the report.',
      },
      execution_result: null
    };

    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let deleteCalled = false;

    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes('/api/actions/') && options?.method === 'DELETE') {
        deleteCalled = true;
        return Promise.resolve({ ok: true });
      }
      if (url.includes('/api/actions/') && !options) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([actionState]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);

    await user.click(await screen.findByRole('button', { name: /Actions/i }));
    
    // Locate the inline delete button next to the risk badge
    const deleteBtn = await screen.findByTestId('delete-action-btn-100');
    expect(deleteBtn).toBeInTheDocument();
    await user.click(deleteBtn);

    // Assert fetch DELETE was called and action is removed from UI
    await waitFor(() => {
      expect(deleteCalled).toBe(true);
      expect(screen.queryByText('Send Report To Delete Inline')).not.toBeInTheDocument();
    });
  });
});
