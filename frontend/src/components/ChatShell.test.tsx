import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatShell from './ChatShell';

// Mock the conversation API
vi.mock('../api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { api } from '../api';

const mockSession = {
  id: 1,
  title: 'My Chat',
  active_entity: 'assistant',
  status: 'active',
  topic: { id: 1, title: 'Supermarket Search' },
  messages: [],
};

const mockTextResponse = {
  message: 'Here is the status summary.',
  cards: [{ type: 'StatusCard', data: {} }],
  requires_clarification: false,
};

const mockApprovalResponse = {
  message: 'You have 2 items needing approval.',
  cards: [
    { type: 'approval_card', data: { id: 1, title: 'Email Draft', risk_level: 'high' } },
    { type: 'approval_card', data: { id: 2, title: 'Stakeholder Update', risk_level: 'medium' } },
  ],
  requires_clarification: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockSession });
  (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockTextResponse });
});

describe('ChatShell', () => {
  it('renders message thread', async () => {
    const sessionWithMessages = {
      ...mockSession,
      messages: [
        { id: 1, sender: 'user', message_text: 'Hello', channel: 'text', created_at: '' },
        { id: 2, sender: 'assistant', message_text: 'Hi there!', channel: 'text', created_at: '' },
      ],
    };
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: sessionWithMessages });

    render(<ChatShell sessionId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });
  });

  it('user can type a message', async () => {
    const user = userEvent.setup();
    render(<ChatShell sessionId={1} />);

    const input = await screen.findByPlaceholderText(/type a message/i);
    await user.type(input, 'What is the status?');
    expect(input).toHaveValue('What is the status?');
  });

  it('sending message calls API', async () => {
    const user = userEvent.setup();
    render(<ChatShell sessionId={1} />);

    const input = await screen.findByPlaceholderText(/type a message/i);
    await user.type(input, 'What is the status?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/conversations/1/messages/',
        expect.objectContaining({ text: 'What is the status?' })
      );
    });
  });

  it('user message appears in thread after send', async () => {
    const user = userEvent.setup();
    render(<ChatShell sessionId={1} />);

    const input = await screen.findByPlaceholderText(/type a message/i);
    await user.type(input, 'What is the status?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('What is the status?')).toBeInTheDocument();
    });
  });

  it('assistant response appears after send', async () => {
    const user = userEvent.setup();
    render(<ChatShell sessionId={1} />);

    const input = await screen.findByPlaceholderText(/type a message/i);
    await user.type(input, 'What is the status?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Here is the status summary.')).toBeInTheDocument();
    });
  });

  it('approval_card cards render correctly', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockApprovalResponse });
    const user = userEvent.setup();
    render(<ChatShell sessionId={1} />);

    const input = await screen.findByPlaceholderText(/type a message/i);
    await user.type(input, 'What needs my approval?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Email Draft')).toBeInTheDocument();
      expect(screen.getByText('Stakeholder Update')).toBeInTheDocument();
    });
  });

  it('task_status_card renders correctly', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        message: 'Here are your active tasks.',
        cards: [{ type: 'task_status_card', data: { title: 'Review Algolia Plan', status: 'in_progress' } }],
        requires_clarification: false,
      },
    });
    const user = userEvent.setup();
    render(<ChatShell sessionId={1} />);

    const input = await screen.findByPlaceholderText(/type a message/i);
    await user.type(input, 'What is the status?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Review Algolia Plan')).toBeInTheDocument();
    });
  });

  it('output_review_card renders correctly', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        message: 'Here is the completed work.',
        cards: [{ type: 'output_review_card', data: { title: 'Market Research Complete', quality: 0.88 } }],
        requires_clarification: false,
      },
    });
    const user = userEvent.setup();
    render(<ChatShell sessionId={1} />);

    const input = await screen.findByPlaceholderText(/type a message/i);
    await user.type(input, 'What did you complete today?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Market Research Complete')).toBeInTheDocument();
    });
  });

  it('entity switcher toggles between Assistant and Executive', async () => {
    const user = userEvent.setup();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { status: 'success', active_entity: 'executive' } });
    render(<ChatShell sessionId={1} />);

    await screen.findByPlaceholderText(/type a message/i);

    const execButton = screen.getByTestId('entity-btn-executive');
    await user.click(execButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/conversations/1/switch-entity/',
        expect.objectContaining({ entity: 'executive' })
      );
    });
  });

  it('active entity label updates after switch', async () => {
    const user = userEvent.setup();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { status: 'success', active_entity: 'executive' } });
    render(<ChatShell sessionId={1} />);

    await screen.findByPlaceholderText(/type a message/i);

    const execButton = screen.getByTestId('entity-btn-executive');
    await user.click(execButton);

    await waitFor(() => {
      expect(screen.getByTestId('active-entity-label')).toHaveTextContent(/executive/i);
    });
  });

  it('empty state suggests useful commands', async () => {
    render(<ChatShell sessionId={1} />);
    await screen.findByPlaceholderText(/type a message/i);

    expect(screen.getByTestId('empty-state-suggestions')).toBeInTheDocument();
    expect(screen.getByText(/prepare today's plan/i)).toBeInTheDocument();
    expect(screen.getByText(/what needs my approval/i)).toBeInTheDocument();
  });

  it('loading state appears while waiting for response', async () => {
    let resolvePost: (v: unknown) => void;
    (api.post as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => { resolvePost = resolve; })
    );

    const user = userEvent.setup();
    render(<ChatShell sessionId={1} />);

    const input = await screen.findByPlaceholderText(/type a message/i);
    await user.type(input, 'What is the status?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByTestId('chat-loading-indicator')).toBeInTheDocument();

    resolvePost!({ data: mockTextResponse });
    await waitFor(() => {
      expect(screen.queryByTestId('chat-loading-indicator')).not.toBeInTheDocument();
    });
  });
});
