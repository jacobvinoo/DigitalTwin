import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatShell from './ChatShell';

vi.mock('../api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { api } from '../api';

const mockAssistantSession = {
  id: 1,
  title: 'Strategy Chat',
  active_entity: 'assistant' as const,
  status: 'active',
  topic: { id: 1, title: 'Algolia Search Strategy' },
  messages: [],
};

const mockExecutiveSession = {
  ...mockAssistantSession,
  active_entity: 'executive' as const,
};

const mockCritiqueResponse = {
  message: 'The Algolia implementation plan lacks a clear success metric and assumes search adoption without evidence.',
  cards: [
    {
      type: 'executive_critique_card',
      data: {
        critique: 'Missing evidence for adoption assumption.',
        risk: 'High confidence in unproven hypothesis.',
        recommendation: 'Add quantitative benchmark before proceeding.',
      },
    },
  ],
  requires_clarification: false,
};

const mockSwitchResponse = { status: 'success', active_entity: 'executive' };

beforeEach(() => {
  vi.clearAllMocks();
  (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockAssistantSession });
  (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockCritiqueResponse });
});

describe('ChatShell — Executive Entity', () => {
  it('executive mode shows distinct header label', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockExecutiveSession });
    render(<ChatShell sessionId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('active-entity-label')).toHaveTextContent(/executive/i);
    });
  });

  it('switching to executive updates the entity label', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockSwitchResponse });
    const user = userEvent.setup();
    render(<ChatShell sessionId={1} />);

    await screen.findByPlaceholderText(/type a message/i);
    await user.click(screen.getByTestId('entity-btn-executive'));

    await waitFor(() => {
      expect(screen.getByTestId('active-entity-label')).toHaveTextContent(/executive/i);
    });
  });

  it('executive mode shows executive-specific suggested commands', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockExecutiveSession });
    render(<ChatShell sessionId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state-suggestions')).toBeInTheDocument();
    });

    expect(screen.getByText(/challenge this strategy/i)).toBeInTheDocument();
    expect(screen.getByText(/find weak assumptions/i)).toBeInTheDocument();
    expect(screen.getByText(/what evidence is missing/i)).toBeInTheDocument();
    expect(screen.getByText(/is this executive-ready/i)).toBeInTheDocument();
  });

  it('executive mode does NOT show assistant suggestions', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockExecutiveSession });
    render(<ChatShell sessionId={1} />);

    await screen.findByTestId('empty-state-suggestions');

    expect(screen.queryByText(/prepare today's plan/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/what needs my approval/i)).not.toBeInTheDocument();
  });

  it('executive response renders executive_critique_card', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockExecutiveSession });
    const user = userEvent.setup();
    render(<ChatShell sessionId={1} />);

    const input = await screen.findByPlaceholderText(/type a message/i);
    await user.type(input, 'Challenge this strategy');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByTestId('executive-critique-card')).toBeInTheDocument();
    });
  });

  it('executive critique card shows critique text', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockExecutiveSession });
    const user = userEvent.setup();
    render(<ChatShell sessionId={1} />);

    const input = await screen.findByPlaceholderText(/type a message/i);
    await user.type(input, 'Find weak assumptions');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByTestId('executive-critique-card')).toHaveTextContent(
        /missing evidence for adoption assumption/i
      );
    });
  });

  it('executive critique card shows recommendation', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockExecutiveSession });
    const user = userEvent.setup();
    render(<ChatShell sessionId={1} />);

    const input = await screen.findByPlaceholderText(/type a message/i);
    await user.type(input, 'Is this executive-ready?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByTestId('executive-critique-card')).toHaveTextContent(
        /add quantitative benchmark/i
      );
    });
  });

  it('switching back to assistant restores assistant suggestions', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockExecutiveSession });
    (api.post as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { status: 'success', active_entity: 'assistant' } });

    const user = userEvent.setup();
    render(<ChatShell sessionId={1} />);

    await screen.findByTestId('empty-state-suggestions');
    // Switch back to assistant
    await user.click(screen.getByTestId('entity-btn-assistant'));

    await waitFor(() => {
      expect(screen.getByText(/prepare today's plan/i)).toBeInTheDocument();
    });
  });
});
