import { test, expect } from '@playwright/test';

test('Complete Phase 2 deterministic workflow', async ({ page }) => {
  // 1. User logs in. (Assuming mocked or direct navigate to topics for now)
  // 2. User opens topic: Search for Supermarket
  await page.goto('/topics/1/command-centre');

  // 3. User clicks Create Daily Plan.
  await page.click('button:has-text("Create daily plan")');

  // 4. User sees proposed daily plan.
  await expect(page.getByTestId('daily-plan-panel')).toBeVisible();

  // 5. User sees grouped tasks: Auto-execute, Approval needed, Hard stop
  await expect(page.getByText('Auto-execute')).toBeVisible();
  await expect(page.getByText('Approval needed')).toBeVisible();
  await expect(page.getByText('Hard stop')).toBeVisible();

  // 6. User approves plan.
  await page.click('button:has-text("Approve Plan")');

  // 7. User clicks Start Workflow.
  await page.click('button:has-text("Start Workflow")');

  // 8. Workflow runs low-risk tasks (WorkflowTimeline appears)
  await expect(page.getByTestId('workflow-timeline')).toBeVisible();
  await expect(page.getByTestId('node-execute_low_risk_task')).toHaveAttribute('data-status', 'completed');

  // 9. Workflow pauses on medium-risk task.
  await expect(page.getByTestId('node-pause_for_task_approval')).toHaveAttribute('data-status', 'paused');

  // 10. UI shows paused approval card.
  await expect(page.getByTestId('paused-approval-card')).toBeVisible();

  // 11. User approves "Create Algolia implementation plan".
  await page.click('button:has-text("Approve Task")');

  // 12. User resumes workflow.
  await page.click('button:has-text("Resume Workflow")');

  // 13. Workflow completes that task.
  await expect(page.getByTestId('node-execute_approved_task')).toHaveAttribute('data-status', 'completed');

  // 14. User opens task drawer.
  // First close the panel if necessary
  const closeBtn = page.getByRole('button', { name: 'Close Workflow' });
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
  }
  
  await page.getByRole('cell', { name: 'Create Algolia implementation plan' }).click();

  // 15. User sees execution lineage, placeholder output, telemetry, evaluation.
  await expect(page.getByText('Execution Lineage')).toBeVisible();
  await expect(page.getByText('Outputs').first()).toBeVisible();
  await expect(page.getByText('Traceability')).toBeVisible();
  await expect(page.getByText('Evaluation')).toBeVisible();

  // 16. User returns to Command Centre.
  await page.click('button:has-text("✕")');

  // 17. Counts are updated.
  await expect(page.getByText('Completed tasks')).toBeVisible();

  // 18. Timeline is coherent.
  // 19. UI clearly says real agent execution comes in Phase 3. (obsolete in Phase 4)

  // 20. No broken empty states.
});
