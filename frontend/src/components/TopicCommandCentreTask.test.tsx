import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import TopicCommandCentre from './TopicCommandCentre';

describe('TopicCommandCentre - Tasks Tab Task Creation', () => {
  it('allows the user to propose a new task via the Task Ledger creation drawer', async () => {
    let mockTasks = [
      {
        id: 1,
        title: 'Define search relevance',
        status: 'proposed',
        risk_level: 'low',
        approval_required: false
      }
    ];

    let topicData = {
      id: 1,
      title: 'Search for Supermarket',
      workstreams: [
        { id: 10, title: 'Competitive Analysis' },
        { id: 11, title: 'Market Metrics' }
      ],
      tasks: mockTasks
    };

    // Mock global fetch to handle tasks list and creation
    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes('/api/topics/1/command-centre/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            pending_approval_count: 0,
            average_quality_score: 'Not scored',
            active_tasks_count: 0,
            completed_tasks_count: 0
          })
        });
      }
      if (url.includes('/api/topics/1/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(topicData) });
      }
      if (url.includes('/api/tasks/') && options?.method === 'POST') {
        const payload = JSON.parse(options.body);
        const newTask = {
          id: 99,
          topic: payload.topic,
          title: payload.title,
          task_type: payload.task_type,
          status: 'proposed',
          risk_level: payload.risk_level,
          workstream_title: 'Competitive Analysis',
          approval_required: payload.risk_level !== 'low'
        };
        mockTasks.unshift(newTask);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(newTask)
        });
      }
      if (url.includes('/api/tasks/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTasks) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);

    // 1. Propose New Task button should be visible in Tasks tab
    const proposeBtn = await screen.findByRole('button', { name: /Propose New Task/i });
    expect(proposeBtn).toBeInTheDocument();
    
    // 2. Click button to open the drawer
    await user.click(proposeBtn);
    
    // 3. Drawer is opened, fields are visible
    const titleInput = await screen.findByLabelText(/Task Title/i);
    expect(titleInput).toBeInTheDocument();
    
    const detailsInput = screen.getByLabelText(/Task Details \/ Instructions/i);
    const taskTypeSelect = screen.getByLabelText(/Task Type/i);
    const workstreamSelect = screen.getByLabelText(/Workstream/i);
    const riskSelect = screen.getByLabelText(/Risk Level/i);
    
    // 4. Fill in the task details
    await user.type(titleInput, 'New Custom Direct Task');
    await user.type(detailsInput, 'Test instructions for task');
    await user.selectOptions(taskTypeSelect, 'generic');
    await user.selectOptions(workstreamSelect, '10'); // Competitive Analysis ID
    await user.selectOptions(riskSelect, 'medium');
    
    // 5. Submit the task
    const createBtn = screen.getByRole('button', { name: /Create Task/i });
    await user.click(createBtn);
    
    // 6. Verify that the task ledger updates with the newly created task
    await waitFor(() => {
      expect(screen.getAllByText('New Custom Direct Task').length).toBeGreaterThan(0);
    });
  });

  it('renders suggested changes diff and approves them successfully', async () => {
    let mockTasks = [
      {
        id: 1,
        title: 'Define search relevance',
        status: 'blocked',
        risk_level: 'low',
        approval_required: false,
        outputs: {
          generated_document_markdown: 'Line 1\nLine 2',
          suggested_document_markdown: 'Line 1\nLine 2 edited\nLine 3'
        }
      }
    ];

    let topicData = {
      id: 1,
      title: 'Search for Supermarket',
      workstreams: [],
      tasks: mockTasks
    };

    let approveCalled = false;

    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes('/api/topics/1/command-centre/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            pending_approval_count: 0,
            average_quality_score: 'Not scored',
            active_tasks_count: 0,
            completed_tasks_count: 0
          })
        });
      }
      if (url.includes('/api/topics/1/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(topicData) });
      }
      if (url.includes('/api/tasks/1/approve-changes/')) {
        approveCalled = true;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 1,
            title: 'Define search relevance',
            status: 'completed',
            risk_level: 'low',
            approval_required: false,
            outputs: {
              generated_document_markdown: 'Line 1\nLine 2 edited\nLine 3'
            }
          })
        });
      }
      if (url.includes('/api/tasks/1/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTasks[0]) });
      }
      if (url.includes('/api/tasks/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTasks) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);

    // Click on the task to open drawer
    const taskRow = await screen.findByText('Define search relevance');
    await user.click(taskRow);

    // Verify diff container is visible
    const diffContainer = await screen.findByTestId('suggested-changes-container');
    expect(diffContainer).toBeInTheDocument();

    // Verify lines of diff (added, removed) are rendered
    expect(screen.getByText(/Line 2 edited/)).toBeInTheDocument();
    expect(screen.getByText(/Line 3/)).toBeInTheDocument();

    // Find and click approve button
    const approveBtn = screen.getByTestId('approve-changes-button');
    expect(approveBtn).toBeInTheDocument();
    await user.click(approveBtn);

    // Assert fetch approve-changes was called
    await waitFor(() => {
      expect(approveCalled).toBe(true);
    });
  });

  it('allows the user to delete a task inline from the task list', async () => {
    let mockTasks = [
      {
        id: 1,
        title: 'Define search relevance',
        status: 'proposed',
        risk_level: 'low',
        approval_required: false
      }
    ];

    let topicData = {
      id: 1,
      title: 'Search for Supermarket',
      workstreams: [],
      tasks: mockTasks
    };

    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let deleteCalled = false;

    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes('/api/topics/1/command-centre/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            pending_approval_count: 0,
            average_quality_score: 'Not scored',
            active_tasks_count: 0,
            completed_tasks_count: 0
          })
        });
      }
      if (url.includes('/api/topics/1/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(topicData) });
      }
      if (url.includes('/api/tasks/1/') && options?.method === 'DELETE') {
        deleteCalled = true;
        return Promise.resolve({ ok: true });
      }
      if (url.includes('/api/tasks/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTasks) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);

    // Locate inline delete button and click it
    const deleteBtn = await screen.findByTestId('delete-task-btn-1');
    expect(deleteBtn).toBeInTheDocument();
    await user.click(deleteBtn);

    // Assert fetch DELETE was called and task is removed from UI
    await waitFor(() => {
      expect(deleteCalled).toBe(true);
      expect(screen.queryByText('Define search relevance')).not.toBeInTheDocument();
    });
  });

  it('allows the user to delete a task from the ledger details drawer', async () => {
    let mockTasks = [
      {
        id: 1,
        title: 'Define search relevance',
        status: 'proposed',
        risk_level: 'low',
        approval_required: false
      }
    ];

    let topicData = {
      id: 1,
      title: 'Search for Supermarket',
      workstreams: [],
      tasks: mockTasks
    };

    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let deleteCalled = false;

    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes('/api/topics/1/command-centre/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            pending_approval_count: 0,
            average_quality_score: 'Not scored',
            active_tasks_count: 0,
            completed_tasks_count: 0
          })
        });
      }
      if (url.includes('/api/topics/1/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(topicData) });
      }
      if (url.includes('/api/tasks/1/') && options?.method === 'DELETE') {
        deleteCalled = true;
        return Promise.resolve({ ok: true });
      }
      if (url.includes('/api/tasks/1/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTasks[0]) });
      }
      if (url.includes('/api/tasks/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTasks) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);

    // Click on the task to open drawer
    const taskRow = await screen.findByText('Define search relevance');
    await user.click(taskRow);

    // Locate Delete Task button and click it
    const deleteBtn = await screen.findByRole('button', { name: /Delete Task/i });
    expect(deleteBtn).toBeInTheDocument();
    await user.click(deleteBtn);

    // Assert fetch DELETE was called and task is removed from UI
    await waitFor(() => {
      expect(deleteCalled).toBe(true);
      expect(screen.queryByText('Define search relevance')).not.toBeInTheDocument();
    });
  });
});
