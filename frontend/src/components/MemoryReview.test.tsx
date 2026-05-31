import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemoryReview from './MemoryReview';

describe('Memory Review', () => {
  it('allows user to review memory records', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    globalThis.fetch = mockFetch as any;

    render(<MemoryReview topicId="1" />);

    // 2. Memory Review page lists unapproved memory records.
    expect(screen.getByRole('heading', { name: /Memory Review/i })).toBeInTheDocument();
    expect(screen.getByText(/When analysing regional supermarket strategy, include local market context/i)).toBeInTheDocument();

    const approveBtns = screen.getAllByRole('button', { name: /Approve/i });
    const rejectBtns = screen.getAllByRole('button', { name: /Reject/i });
    
    expect(approveBtns.length).toBeGreaterThan(0);
    expect(rejectBtns.length).toBeGreaterThan(0);

    // 3. User can approve a memory record.
    await user.click(approveBtns[0]);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/approve'), expect.any(Object));

    // 5. User can reject memory record.
    // Let's assume the first item is removed after click, so we find the reject button again.
    await waitFor(() => {
        expect(screen.queryByText(/When analysing regional supermarket strategy, include local market context/i)).not.toBeInTheDocument();
    });

    // To test reject, we should have a second mock item
    const rejectBtn = screen.getByRole('button', { name: /Reject/i });
    await user.click(rejectBtn);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/reject'), expect.any(Object));
  });
});
