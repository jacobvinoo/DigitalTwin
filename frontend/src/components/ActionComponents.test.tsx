import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  ActionRiskBadge, 
  EmailDraftPreview, 
  ActionApprovalPanel, 
  ActionExecutionTimeline, 
  ActionResultPanel, 
  ActionAuditPanel 
} from './ActionComponents';
import { vi } from 'vitest';

describe('ActionRiskBadge', () => {
  it('renders correctly for low risk', () => {
    render(<ActionRiskBadge riskLevel="low" />);
    expect(screen.getByText('Low Risk')).toBeInTheDocument();
  });

  it('renders correctly for high risk', () => {
    render(<ActionRiskBadge riskLevel="high" />);
    expect(screen.getByText('High Risk')).toBeInTheDocument();
  });
});

describe('EmailDraftPreview', () => {
  it('renders email details', () => {
    const payload = {
      subject: 'Test Subject',
      recipients: ['test@test.com'],
      body: 'Hello world'
    };
    render(<EmailDraftPreview payload={payload} />);
    expect(screen.getByText(/Test Subject/)).toBeInTheDocument();
    expect(screen.getByText(/test@test.com/)).toBeInTheDocument();
    expect(screen.getByText(/Hello world/)).toBeInTheDocument();
  });
});

describe('ActionApprovalPanel', () => {
  it('calls onApprove when approve button is clicked', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    
    render(<ActionApprovalPanel status="awaiting_approval" onApprove={onApprove} onReject={onReject} />);
    
    fireEvent.click(screen.getByText('Approve Action'));
    expect(onApprove).toHaveBeenCalled();
  });

  it('calls onReject with reason when reject button is clicked', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    
    render(<ActionApprovalPanel status="awaiting_approval" onApprove={onApprove} onReject={onReject} />);
    
    fireEvent.change(screen.getByPlaceholderText('Reason for rejection'), { target: { value: 'Not ready' } });
    fireEvent.click(screen.getByText('Reject Action'));
    
    expect(onReject).toHaveBeenCalledWith('Not ready');
  });
  
  it('does not render buttons if status is not awaiting_approval', () => {
    render(<ActionApprovalPanel status="approved" onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.queryByText('Approve Action')).not.toBeInTheDocument();
  });
});

describe('ActionExecutionTimeline', () => {
  it('renders the correct current step', () => {
    render(<ActionExecutionTimeline status="approved" />);
    expect(screen.getByText('approved')).toBeInTheDocument();
    expect(screen.getByText('executed').parentElement).toHaveStyle({ opacity: '0.5' });
  });
});

describe('ActionResultPanel', () => {
  it('renders execution result if present', () => {
    const result = { message_id: 'fake-123', status: 'sent' };
    render(<ActionResultPanel executionResult={result} />);
    expect(screen.getByText(/fake-123/)).toBeInTheDocument();
  });
});

describe('ActionAuditPanel', () => {
  it('renders audit fields correctly', () => {
    const action = {
      approved_by_email: 'boss@test.com',
      approved_at: '2026-05-24T12:00:00Z',
      rejected_reason: null
    };
    render(<ActionAuditPanel action={action} />);
    expect(screen.getByText(/boss@test.com/)).toBeInTheDocument();
    expect(screen.getByText(/2026-05-24T12:00:00Z/)).toBeInTheDocument();
  });
});
