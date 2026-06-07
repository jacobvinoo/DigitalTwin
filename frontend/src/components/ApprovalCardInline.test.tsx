import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApprovalCardInline from './ApprovalCardInline';

vi.mock('../api', () => ({
  api: {
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import { api } from '../api';

const mockEmailAction = {
  id: 42,
  title: 'Email Draft to Search Team',
  action_type: 'email_draft',
  risk_level: 'high' as const,
  status: 'awaiting_approval',
  approval_reason: 'This action will send an email to external recipients.',
  generated_output: {
    subject: 'Algolia Metrics Request',
    recipients: ['search-team@company.com'],
    body: 'Hi team, could you share Algolia metrics before Friday?',
  },
};

const mockMediumAction = {
  id: 7,
  title: 'Stakeholder Update Draft',
  action_type: 'stakeholder_update',
  risk_level: 'medium' as const,
  status: 'awaiting_approval',
  approval_reason: 'This will update stakeholder records.',
  generated_output: {},
};

const mockApprovedAction = {
  ...mockEmailAction,
  status: 'approved',
};

beforeEach(() => {
  vi.clearAllMocks();
  (api.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockApprovedAction });
  (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
});

describe('ApprovalCardInline', () => {
  it('renders approval card with title', () => {
    render(<ApprovalCardInline action={mockEmailAction} />);
    expect(screen.getByText('Email Draft to Search Team')).toBeInTheDocument();
  });

  it('shows risk level badge', () => {
    render(<ApprovalCardInline action={mockEmailAction} />);
    expect(screen.getByTestId('risk-badge')).toHaveTextContent(/high/i);
  });

  it('shows reason approval is needed', () => {
    render(<ApprovalCardInline action={mockEmailAction} />);
    expect(screen.getByText(/will send an email to external recipients/i)).toBeInTheDocument();
  });

  it('shows approve button', () => {
    render(<ApprovalCardInline action={mockEmailAction} />);
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
  });

  it('shows reject button', () => {
    render(<ApprovalCardInline action={mockEmailAction} />);
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  it('approve button calls PATCH action approve API', async () => {
    const user = userEvent.setup();
    render(<ApprovalCardInline action={mockEmailAction} />);

    await user.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        `/api/actions/${mockEmailAction.id}/approve/`,
        expect.anything()
      );
    });
  });

  it('reject button requires a reason before submitting', async () => {
    const user = userEvent.setup();
    render(<ApprovalCardInline action={mockEmailAction} />);

    await user.click(screen.getByRole('button', { name: /reject/i }));

    // Reject reason input appears
    const reasonInput = await screen.findByPlaceholderText(/reason for rejection/i);
    expect(reasonInput).toBeInTheDocument();

    // Submitting without reason should not call API
    const submitBtn = screen.getByRole('button', { name: /confirm reject/i });
    await user.click(submitBtn);
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('reject submits with reason after typing', async () => {
    (api.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...mockEmailAction, status: 'rejected' },
    });

    const user = userEvent.setup();
    render(<ApprovalCardInline action={mockEmailAction} />);

    await user.click(screen.getByRole('button', { name: /reject/i }));
    const reasonInput = await screen.findByPlaceholderText(/reason for rejection/i);
    await user.type(reasonInput, 'Not the right time for this action.');
    await user.click(screen.getByRole('button', { name: /confirm reject/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        `/api/actions/${mockEmailAction.id}/reject/`,
        expect.objectContaining({ reason: 'Not the right time for this action.' })
      );
    });
  });

  it('after approval, card updates status to approved', async () => {
    const user = userEvent.setup();
    render(<ApprovalCardInline action={mockEmailAction} />);

    await user.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(screen.getByTestId('approval-status')).toHaveTextContent(/approved/i);
    });
  });

  it('approve and reject buttons are hidden after approval', async () => {
    const user = userEvent.setup();
    render(<ApprovalCardInline action={mockEmailAction} />);

    await user.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    });
  });

  it('high-risk action card shows warning banner', () => {
    render(<ApprovalCardInline action={mockEmailAction} />);
    expect(screen.getByTestId('high-risk-warning')).toBeInTheDocument();
    expect(screen.getByTestId('high-risk-warning')).toHaveTextContent(/high.risk/i);
  });

  it('medium-risk card does not show high-risk warning', () => {
    render(<ApprovalCardInline action={mockMediumAction} />);
    expect(screen.queryByTestId('high-risk-warning')).not.toBeInTheDocument();
  });

  it('email draft card shows recipient', () => {
    render(<ApprovalCardInline action={mockEmailAction} />);
    expect(screen.getByTestId('email-recipients')).toHaveTextContent('search-team@company.com');
  });

  it('email draft card shows subject', () => {
    render(<ApprovalCardInline action={mockEmailAction} />);
    expect(screen.getByTestId('email-subject')).toHaveTextContent('Algolia Metrics Request');
  });

  it('email draft card shows action consequence', () => {
    render(<ApprovalCardInline action={mockEmailAction} />);
    expect(screen.getByTestId('action-consequence')).toBeInTheDocument();
    expect(screen.getByTestId('action-consequence')).toHaveTextContent(/email will be sent/i);
  });

  it('non-email action does not show email fields', () => {
    render(<ApprovalCardInline action={mockMediumAction} />);
    expect(screen.queryByTestId('email-recipients')).not.toBeInTheDocument();
    expect(screen.queryByTestId('email-subject')).not.toBeInTheDocument();
  });

  it('already-approved action shows approved state immediately', () => {
    render(<ApprovalCardInline action={mockApprovedAction} />);
    expect(screen.getByTestId('approval-status')).toHaveTextContent(/approved/i);
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });
});
