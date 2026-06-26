import { test, expect } from '@playwright/test';

test('Agent Chain Workspace loads without syntax errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  await page.goto('http://localhost:5173/topics/25/agent-chain');
  
  // Wait for network idle to ensure all modules are loaded
  await page.waitForLoadState('networkidle');
  
  // The page should not have any uncaught module syntax errors
  expect(errors.length, `Page crashed with errors: ${errors.join(', ')}`).toBe(0);
});
