import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VoiceInputPanel from './VoiceInputPanel';

vi.mock('../api', () => ({
  api: {
    post: vi.fn(),
  },
}));

import { api } from '../api';

const mockVoiceResponse = {
  message: 'Here is the status summary.',
  cards: [{ type: 'StatusCard', data: {} }],
  requires_clarification: false,
};

const mockLowConfidenceResponse = {
  message: 'I heard: "Prepare today\'s plan". I\'m not confident I understood. Could you confirm?',
  requires_clarification: true,
  cards: [],
};

const mockApprovalResponse = {
  message: 'Action is unapproved. Approval required.',
  cards: [{ type: 'approval_card', data: { id: 1, title: 'Send email', risk_level: 'high' } }],
  requires_clarification: false,
  error: 'Action is unapproved. Approval required.',
};

beforeEach(() => {
  vi.clearAllMocks();
  (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockVoiceResponse });
});

describe('VoiceInputPanel', () => {
  it('renders VoiceInputPanel', () => {
    render(<VoiceInputPanel sessionId={1} onResponse={vi.fn()} />);
    expect(screen.getByTestId('voice-input-panel')).toBeInTheDocument();
  });

  it('user clicks "Start voice note" button', async () => {
    const user = userEvent.setup();
    render(<VoiceInputPanel sessionId={1} onResponse={vi.fn()} />);

    const startBtn = screen.getByRole('button', { name: /start voice note/i });
    expect(startBtn).toBeInTheDocument();
    await user.click(startBtn);
    // Should transition to recording or transcript entry state
    expect(screen.queryByRole('button', { name: /start voice note/i })).not.toBeInTheDocument();
  });

  it('UI shows recording state after click', async () => {
    const user = userEvent.setup();
    render(<VoiceInputPanel sessionId={1} onResponse={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /start voice note/i }));
    expect(screen.getByTestId('voice-recording-state')).toBeInTheDocument();
  });

  it('user can enter transcript text manually', async () => {
    const user = userEvent.setup();
    render(<VoiceInputPanel sessionId={1} onResponse={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /start voice note/i }));

    const transcriptInput = screen.getByPlaceholderText(/transcript/i);
    await user.type(transcriptInput, 'What is the status?');
    expect(transcriptInput).toHaveValue('What is the status?');
  });

  it('transcript preview appears after text is entered', async () => {
    const user = userEvent.setup();
    render(<VoiceInputPanel sessionId={1} onResponse={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /start voice note/i }));

    const transcriptInput = screen.getByPlaceholderText(/transcript/i);
    await user.type(transcriptInput, 'What is the status?');

    expect(screen.getByTestId('transcript-preview')).toHaveTextContent('What is the status?');
  });

  it('user can confirm transcript and post to voice API', async () => {
    const user = userEvent.setup();
    render(<VoiceInputPanel sessionId={1} onResponse={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /start voice note/i }));
    const transcriptInput = screen.getByPlaceholderText(/transcript/i);
    await user.type(transcriptInput, 'What is the status?');

    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/conversations/1/voice-transcript/',
        expect.objectContaining({ transcript_text: 'What is the status?' })
      );
    });
  });

  it('response appears in message thread via onResponse callback', async () => {
    const onResponse = vi.fn();
    const user = userEvent.setup();
    render(<VoiceInputPanel sessionId={1} onResponse={onResponse} />);

    await user.click(screen.getByRole('button', { name: /start voice note/i }));
    const transcriptInput = screen.getByPlaceholderText(/transcript/i);
    await user.type(transcriptInput, 'What is the status?');
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(onResponse).toHaveBeenCalledWith(mockVoiceResponse);
    });
  });

  it('low-confidence transcript shows confirmation warning', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockLowConfidenceResponse });

    const user = userEvent.setup();
    render(<VoiceInputPanel sessionId={1} onResponse={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /start voice note/i }));
    const transcriptInput = screen.getByPlaceholderText(/transcript/i);
    await user.type(transcriptInput, "Prepare today's plan");
    // Simulate low confidence by setting it explicitly
    const confidenceInput = screen.getByTestId('confidence-input');
    await user.clear(confidenceInput);
    await user.type(confidenceInput, '0.40');

    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByTestId('low-confidence-warning')).toBeInTheDocument();
    });
  });

  it('"Send email" voice command shows approval card, not execution', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockApprovalResponse });

    const onResponse = vi.fn();
    const user = userEvent.setup();
    render(<VoiceInputPanel sessionId={1} onResponse={onResponse} />);

    await user.click(screen.getByRole('button', { name: /start voice note/i }));
    const transcriptInput = screen.getByPlaceholderText(/transcript/i);
    await user.type(transcriptInput, 'Send the email');
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(onResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/approval/i),
        })
      );
    });

    // Verify the action was NOT confirmed as executed in the response
    const responsePayload = (onResponse as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(responsePayload.error).toBeTruthy();
    expect(responsePayload.cards?.[0]?.type).toBe('approval_card');
  });

  it('panel resets after successful confirm', async () => {
    const user = userEvent.setup();
    render(<VoiceInputPanel sessionId={1} onResponse={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /start voice note/i }));
    const transcriptInput = screen.getByPlaceholderText(/transcript/i);
    await user.type(transcriptInput, 'What is the status?');
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      // After confirm the start button should reappear
      expect(screen.getByRole('button', { name: /start voice note/i })).toBeInTheDocument();
    });
  });
});
