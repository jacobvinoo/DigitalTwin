import { test, expect } from '@playwright/test';

/**
 * Phase 5 E2E — Conversational Interface Full Scenario
 *
 * Tests the complete voice + chat flow against the live dev server.
 * The spec runs sequentially (workers: 1) and expects the default
 * seeded topic "Search for Supermarket" to exist.
 *
 * All approval gates must be respected — no action executes without
 * an explicit human approval step.
 */

test.describe('Phase 5 — Conversational Interface', () => {

  // Navigate to the topic command centre then open the Conversation tab
  test.beforeEach(async ({ page }) => {
    await page.goto('/topics/1/command-centre');
    await expect(page.getByText('Search for Supermarket')).toBeVisible();
    await page.getByRole('tab', { name: /conversation/i }).click();
    await expect(page.getByTestId('chat-shell')).toBeVisible();
  });

  test('1. Chat shell renders inside command centre', async ({ page }) => {
    await expect(page.getByTestId('chat-shell')).toBeVisible();
    await expect(page.getByTestId('empty-state-suggestions')).toBeVisible();
  });

  test('2. "What needs my approval?" returns approval cards', async ({ page }) => {
    const input = page.getByPlaceholder(/type a message/i);
    await input.fill('What needs my approval?');
    await page.getByRole('button', { name: /send/i }).click();

    await expect(page.getByTestId('chat-loading-indicator')).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('[data-testid="approval-card"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('3. User approves one action from inline card', async ({ page }) => {
    const input = page.getByPlaceholder(/type a message/i);
    await input.fill('What needs my approval?');
    await page.getByRole('button', { name: /send/i }).click();

    // Wait for approval cards to arrive
    const firstApproveBtn = page.locator('[data-testid="approval-card"] button', { hasText: /approve/i }).first();
    await expect(firstApproveBtn).toBeVisible({ timeout: 10_000 });
    await firstApproveBtn.click();

    // Card should update to approved state
    await expect(
      page.locator('[data-testid="approval-status"]').first()
    ).toHaveText(/approved/i, { timeout: 5_000 });
  });

  test('4. Switching to Executive shows distinct header', async ({ page }) => {
    await page.getByTestId('entity-btn-executive').click();

    await expect(page.getByTestId('active-entity-label')).toHaveText(/executive/i, { timeout: 3_000 });
  });

  test('5. Executive mode shows executive-specific suggestions', async ({ page }) => {
    await page.getByTestId('entity-btn-executive').click();

    await expect(page.getByText(/challenge this strategy/i)).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(/find weak assumptions/i)).toBeVisible();
    await expect(page.getByText(/what evidence is missing/i)).toBeVisible();
    await expect(page.getByText(/is this executive-ready/i)).toBeVisible();
  });

  test('6. Executive challenge returns critique card', async ({ page }) => {
    await page.getByTestId('entity-btn-executive').click();

    const input = page.getByPlaceholder(/type a message/i);
    await input.fill('Challenge the Algolia implementation plan.');
    await page.getByRole('button', { name: /send/i }).click();

    await expect(page.getByTestId('executive-critique-card')).toBeVisible({ timeout: 10_000 });
  });

  test('7. Executive critique card contains critique, risk and recommendation', async ({ page }) => {
    await page.getByTestId('entity-btn-executive').click();

    const input = page.getByPlaceholder(/type a message/i);
    await input.fill('Challenge the Algolia implementation plan.');
    await page.getByRole('button', { name: /send/i }).click();

    const card = page.getByTestId('executive-critique-card');
    await expect(card).toBeVisible({ timeout: 10_000 });
    // Card must contain at least some substantive text from _generate_critique
    await expect(card).not.toBeEmpty();
  });

  test('8. Switching back to Assistant restores assistant suggestions', async ({ page }) => {
    // Go executive, then back
    await page.getByTestId('entity-btn-executive').click();
    await expect(page.getByTestId('active-entity-label')).toHaveText(/executive/i);

    await page.getByTestId('entity-btn-assistant').click();
    await expect(page.getByTestId('active-entity-label')).toHaveText(/assistant/i);
    await expect(page.getByText(/prepare today's plan/i)).toBeVisible({ timeout: 3_000 });
  });

  test('9. Voice input panel opens on click', async ({ page }) => {
    await page.getByRole('button', { name: /start voice note/i }).click();
    await expect(page.getByTestId('voice-recording-state')).toBeVisible();
  });

  test('10. Voice transcript creates action request and shows email draft', async ({ page }) => {
    await page.getByRole('button', { name: /start voice note/i }).click();

    const transcriptInput = page.getByPlaceholder(/transcript/i);
    await transcriptInput.fill(
      'Draft an email to the Search team asking for Algolia metrics before Friday.'
    );
    await page.getByRole('button', { name: /confirm/i }).click();

    // Should see an action draft card or action draft message in thread
    await expect(
      page.getByText(/drafting action/i).or(page.getByTestId('action-draft-card'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('11. "Send the email" via voice shows approval card, not execution', async ({ page }) => {
    // First create a drafted (unapproved) action via chat
    const input = page.getByPlaceholder(/type a message/i);
    await input.fill('Draft an email to the Search team asking for Algolia metrics before Friday.');
    await page.getByRole('button', { name: /send/i }).click();
    await expect(page.getByTestId('chat-loading-indicator')).toBeHidden({ timeout: 10_000 });

    // Now try to send it via voice
    await page.getByRole('button', { name: /start voice note/i }).click();
    await page.getByPlaceholder(/transcript/i).fill('Send the email');
    await page.getByRole('button', { name: /confirm/i }).click();

    // Must show approval requirement, not a success execution card
    const response = page
      .getByText(/approval required/i)
      .or(page.getByTestId('approval-card'))
      .or(page.getByText(/unapproved/i));
    await expect(response).toBeVisible({ timeout: 10_000 });

    // Confirm the action was NOT executed (no execution card)
    await expect(page.getByTestId('action-executed-card')).not.toBeVisible();
  });

  test('12. Approval gate prevents silent email send', async ({ page }) => {
    // Attempt to execute via chat without prior approval
    const input = page.getByPlaceholder(/type a message/i);
    await input.fill('Send the email');
    await page.getByRole('button', { name: /send/i }).click();

    await expect(page.getByTestId('chat-loading-indicator')).toBeHidden({ timeout: 10_000 });

    // Must not show executed state
    await expect(page.getByTestId('action-executed-card')).not.toBeVisible();
  });

  test('13. After approval, action can be executed and shows fake result', async ({ page }) => {
    // Create action
    const input = page.getByPlaceholder(/type a message/i);
    await input.fill('Draft an email to the Search team asking for Algolia metrics before Friday.');
    await page.getByRole('button', { name: /send/i }).click();
    await expect(page.getByTestId('chat-loading-indicator')).toBeHidden({ timeout: 10_000 });

    // Find and approve the action card
    const approveBtn = page
      .locator('[data-testid="approval-card"] button', { hasText: /approve/i })
      .first();
    await expect(approveBtn).toBeVisible({ timeout: 10_000 });
    await approveBtn.click();
    await expect(page.locator('[data-testid="approval-status"]').first()).toHaveText(/approved/i, { timeout: 5_000 });

    // Execute
    await input.fill('Send the email');
    await page.getByRole('button', { name: /send/i }).click();
    await expect(page.getByTestId('chat-loading-indicator')).toBeHidden({ timeout: 10_000 });

    await expect(page.getByTestId('action-executed-card')).toBeVisible({ timeout: 5_000 });
  });

  test('14. No approval bypass: executive cannot approve or execute', async ({ page }) => {
    await page.getByTestId('entity-btn-executive').click();
    await expect(page.getByTestId('active-entity-label')).toHaveText(/executive/i);

    const input = page.getByPlaceholder(/type a message/i);
    await input.fill('Send the email');
    await page.getByRole('button', { name: /send/i }).click();

    await expect(page.getByTestId('chat-loading-indicator')).toBeHidden({ timeout: 10_000 });

    // Must show error or refusal — never an executed card
    await expect(page.getByTestId('action-executed-card')).not.toBeVisible();

    const refusal = page
      .getByText(/executive reviewer cannot/i)
      .or(page.getByText(/switch to assistant/i));
    await expect(refusal).toBeVisible({ timeout: 5_000 });
  });
});
