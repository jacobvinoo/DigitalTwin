import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
});

global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('/daily-plan')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        id: 1,
        workflow_run_id: 101,
        status: "proposed",
        plan_items: [
          { task_id: "1", title: "Create Algolia implementation plan", workstream: "Implementation Plan", risk_level: "medium", execution_mode: "approval-needed" },
          { task_id: "2", title: "Identify product, technical, adoption, and data risks", workstream: "Risk Analysis", risk_level: "high", execution_mode: "hard-stop" },
          { task_id: "5", title: "Analyse current supermarket search experience", workstream: "Competitive Analysis", risk_level: "low", execution_mode: "auto-executable" }
        ],
        diff_from_previous: {
          first_plan: true,
          added: [],
          removed: [],
          unchanged: []
        }
      }),
    });
  }
  if (url.includes('/api/actions/')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    });
  }
  if (url.includes('/command-centre/')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        active_tasks_count: 8,
        completed_tasks_count: 0,
        pending_approval_count: 4,
        average_quality_score: "Not scored"
      }),
    });
  }
  if (url.includes('/api/topics/')) {
    const isList = url.endsWith('/api/topics/') || url.endsWith('/api/topics');
    const topicData = {
      id: 1,
      title: "Search for Supermarket",
      description: "Improve supermarket search relevance",
      strategic_context: "Some context",
      status: "Active",
      tasks_count: 5,
      completed_tasks_count: 2,
      active_tasks_count: 1,
      pending_approvals_count: 1,
      workstreams_count: 3,
      created_at: "2026-05-31T10:00:00Z",
      updated_at: "2026-05-31T10:00:00Z"
    };
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(isList ? [topicData] : topicData),
    });
  }
  if (url.includes('/api/tasks')) {
    const localTasks = localStorage.getItem('tasks');
    const defaultTasks = [
      { id: 1, title: "Create Algolia implementation plan", workstream: "Implementation Plan", risk: "medium", status: "proposed", approval: "required", score: "-" },
      { id: 2, title: "Identify product, technical, adoption, and data risks", workstream: "Risk Analysis", risk: "high", status: "proposed", approval: "required", score: "-" },
      { id: 3, title: "Create product strategy narrative", workstream: "Product Strategy", risk: "medium", status: "proposed", approval: "required", score: "-" },
      { id: 4, title: "Create 30/60/90 day roadmap", workstream: "Roadmap", risk: "medium", status: "proposed", approval: "required", score: "-" },
      { id: 5, title: "Analyse current supermarket search experience", workstream: "Competitive Analysis", risk: "low", status: "in_progress", approval: "not required", score: "-" }
    ];
    const tasks = localTasks ? JSON.parse(localTasks) : defaultTasks;
    const match = url.match(/\/api\/tasks\/(\d+)\/?/);
    if (match) {
      const taskId = parseInt(match[1]);
      const task = tasks.find((t: any) => t.id === taskId);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(task || {}),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(tasks),
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
});
