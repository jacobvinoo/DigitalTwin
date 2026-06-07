import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ProjectDashboard from './ProjectDashboard';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ProjectDashboard', () => {
  it('renders projects and high-level metrics successfully', async () => {
    const user = userEvent.setup();
    
    render(
      <BrowserRouter>
        <ProjectDashboard />
      </BrowserRouter>
    );

    // Verify Title
    expect(await screen.findByText('StrategyPad Control Centre')).toBeInTheDocument();

    // Verify Summary Cards are rendered
    expect(screen.getByText('Total Workspaces')).toBeInTheDocument();
    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
    expect(screen.getByText('Active Tasks')).toBeInTheDocument();
    expect(screen.getByText('Action Required')).toBeInTheDocument();

    // Check project details displayed
    expect(screen.getByText('Search for Supermarket')).toBeInTheDocument();
    expect(screen.getByText('Improve supermarket search relevance')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Check progress info
    expect(screen.getByText('Tasks Completed')).toBeInTheDocument();
    expect(screen.getByText('2/5 (40%)')).toBeInTheDocument();

    // Check navigation to Command Centre
    const commandCentreBtn = screen.getByRole('button', { name: /Command Centre/i });
    await user.click(commandCentreBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/topics/1/command-centre');

    // Check navigation to Memories
    const memoriesBtn = screen.getByRole('button', { name: /Memories/i });
    await user.click(memoriesBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/topics/1/memory-review');
  });

  it('filters projects via search input', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <ProjectDashboard />
      </BrowserRouter>
    );

    await screen.findByText('Search for Supermarket');

    const searchInput = screen.getByPlaceholderText('Search strategy workspaces...');
    
    // Type non-matching term
    await user.type(searchInput, 'NonExistentProject');
    expect(screen.queryByText('Search for Supermarket')).not.toBeInTheDocument();
    expect(screen.getByText('No strategy workspaces found')).toBeInTheDocument();

    // Clear and type matching term
    await user.clear(searchInput);
    await user.type(searchInput, 'Supermarket');
    expect(screen.getByText('Search for Supermarket')).toBeInTheDocument();
  });

  it('allows user to delete a project', async () => {
    const user = userEvent.setup();
    const confirmMock = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(
      <BrowserRouter>
        <ProjectDashboard />
      </BrowserRouter>
    );

    // Wait for project to render
    const projectTitle = await screen.findByText('Search for Supermarket');
    expect(projectTitle).toBeInTheDocument();

    // Click delete button
    const deleteBtn = screen.getByRole('button', { name: /Delete Search for Supermarket/i });
    await user.click(deleteBtn);

    // Confirm that confirm dialog was shown
    expect(confirmMock).toHaveBeenCalled();

    // Verify project card is removed from screen
    await waitFor(() => {
      expect(screen.queryByText('Search for Supermarket')).not.toBeInTheDocument();
    });

    confirmMock.mockRestore();
  });
});
