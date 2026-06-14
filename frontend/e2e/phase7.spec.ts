import { test, expect } from '@playwright/test';

test.describe('Agent Config Panel State', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the agent chain workspace for the first seeded topic
    await page.goto('/topics/1/agent-chain');
    // Wait for the React Flow canvas to load
    await expect(page.locator('.react-flow')).toBeVisible();
  });

  test('Instructions state clears when switching between agent nodes', async ({ page }) => {
    // Wait for nodes to appear
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10000 });
    
    // Find the first agent node (e.g., Web Researcher) and click it
    const firstNode = page.locator('.react-flow__node').nth(0);
    await firstNode.click();
    
    // Wait for the config panel to open
    const configPanel = page.locator('text=Specific Task Instructions').locator('..');
    await expect(configPanel).toBeVisible();

    // Fill in specific task instructions for the first node
    const instructionsInput = page.getByPlaceholder(/Search for the latest/i);
    await instructionsInput.fill('This is a test instruction for the first node.');
    
    // Click the Save button
    await page.getByRole('button', { name: /Save Instructions/i }).click();
    
    // Ensure it says "Saved!"
    await expect(page.getByText('Saved!')).toBeVisible();

    // Now click the SECOND agent node on the canvas
    const secondNode = page.locator('.react-flow__node').nth(1);
    await secondNode.click();

    // The Specific Task Instructions input should be EMPTY for the new node
    // (It should NOT contain 'This is a test instruction for the first node.')
    await expect(instructionsInput).toHaveValue('');
    
    // Fill in a DIFFERENT instruction for the second node
    await instructionsInput.fill('Instructions for the second node.');
    await page.getByRole('button', { name: /Save Instructions/i }).click();
    await expect(page.getByText('Saved!')).toBeVisible();
    
    // Click back to the FIRST node
    await firstNode.click();
    
    // Verify it restored the first node's instructions correctly
    await expect(instructionsInput).toHaveValue('This is a test instruction for the first node.');
  });
});
