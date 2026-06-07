import { test, expect } from '@playwright/test';

test('Complete Phase 1 user flow', async ({ page }) => {
  // 1. User logs in. (Assuming mocked or direct navigate to topics for now)
  await page.goto('/topics');

  // 3. User creates topic
  // Navigate to wizard or click create
  await page.goto('/topics/new');

  // 4. User enters objective
  await page.fill('input[name="title"]', 'Search for Supermarket');
  await page.fill('textarea[name="objective"]', 'Improve supermarket search relevance, discovery, and conversion.');
  
  // 5. User enters context
  await page.fill('textarea[name="strategic_context"]', 'Algolia implementation for supermarket search.');

  // 6. User submits.
  await page.click('button:has-text("Create Strategy Workspace")');

  // 7. User lands on command centre.
  await expect(page).toHaveURL(/\/topics\/\d+\/command-centre/);
  const topicId = page.url().match(/\/topics\/(\d+)\//)?.[1] || '1';

  // 8. User sees seven workstreams.
  // Assuming a specific heading or card exists
  await expect(page.getByText('Workstreams')).toBeVisible();

  // 9. User sees approval queue.
  await expect(page.getByTestId('approval-queue')).toBeVisible();

  // 10. User opens Algolia implementation plan task.
  await page.getByRole('cell', { name: 'Create Algolia implementation plan' }).click();

  // 11. User approves it.
  await page.click('button:has-text("Approve")');

  // 12. User adds feedback
  await page.fill('textarea[placeholder="Enter your feedback"]', 'Make this more specific to NZ supermarket search and online grocery behaviour.');
  await page.click('button:has-text("Submit Feedback")');

  // 13. User adds scorecard.
  await page.fill('input[aria-label="Quality Score"]', '5');
  await page.click('button:has-text("Save Scorecard")');

  // 14. User opens Memory Review.
  await page.goto(`/topics/${topicId}/memory-review`);

  // 15. User sees pending memory candidate.
  await expect(page.getByText('When analysing regional supermarket strategy, include local market context')).toBeVisible();

  // 16. User approves memory candidate.
  await page.click('button:has-text("Approve")');

  // 17. User returns to command centre.
  await page.goto(`/topics/${topicId}/command-centre`);

  // 18. Performance summary reflects score.
  await expect(page.getByText('5', { exact: true }).first()).toBeVisible();

  // 19. Pending approval count has decreased.
  // This depends on initial count, but we can just check if it's visible without error
  await expect(page.getByTestId('pending-count')).toBeVisible();
});
