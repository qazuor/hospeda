/**
 * E2E tests for the Feedback FAB (Floating Action Button).
 *
 * Tests the happy path of opening the feedback form, filling it out,
 * and submitting. Also tests FAB minimize/restore and keyboard shortcut.
 *
 * Requires:
 * - Web app running at localhost:4321
 * - API running at localhost:3001 (for form submission)
 */
import { type Page, expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to the Spanish homepage and wait for the FAB to appear */
async function navigateAndWaitForFab(page: Page): Promise<void> {
    await page.goto('/es/');
    await page.waitForSelector('[data-testid="feedback-fab"]', { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Feedback FAB', () => {
    test('should render the FAB on the homepage', async ({ page }) => {
        await navigateAndWaitForFab(page);
        const fab = page.getByTestId('feedback-fab');
        await expect(fab).toBeVisible();
    });

    test('should open the feedback modal when FAB is clicked', async ({ page }) => {
        await navigateAndWaitForFab(page);

        // Click the FAB
        await page.getByTestId('feedback-fab').click();

        // Modal should appear with the form
        const modal = page.locator('dialog[data-feedback-modal]');
        await expect(modal).toBeVisible();

        // Form title should be visible
        await expect(modal.locator('h2')).toBeVisible();
    });

    test('should close the modal when close button is clicked', async ({ page }) => {
        await navigateAndWaitForFab(page);

        // Open modal
        await page.getByTestId('feedback-fab').click();
        const modal = page.locator('dialog[data-feedback-modal]');
        await expect(modal).toBeVisible();

        // Click close button
        await page.getByTestId('feedback-modal-close').click();

        // Modal should disappear
        await expect(modal).not.toBeVisible();
    });

    test('should open modal via keyboard shortcut Ctrl+Shift+F', async ({ page }) => {
        await navigateAndWaitForFab(page);

        // Press keyboard shortcut
        await page.keyboard.press('Control+Shift+KeyF');

        // Modal should appear
        const modal = page.locator('dialog[data-feedback-modal]');
        await expect(modal).toBeVisible();
    });

    test('should minimize and restore the FAB', async ({ page }) => {
        await navigateAndWaitForFab(page);

        // Click minimize button
        await page.getByTestId('feedback-fab-minimize').click();

        // Full FAB should be gone, minimized version visible
        await expect(page.getByTestId('feedback-fab')).not.toBeVisible();
        await expect(page.getByTestId('feedback-fab-minimized')).toBeVisible();

        // Click the minimized FAB to open modal directly
        await page.getByTestId('feedback-fab-minimized').click();
        const modal = page.locator('dialog[data-feedback-modal]');
        await expect(modal).toBeVisible();
    });
});

test.describe('Feedback Form - Happy Path', () => {
    test('should submit a feedback report successfully', async ({ page }) => {
        await navigateAndWaitForFab(page);

        // Open the form
        await page.getByTestId('feedback-fab').click();
        const modal = page.locator('dialog[data-feedback-modal]');
        await expect(modal).toBeVisible();

        // --- Step 1: Required fields ---

        // Select report type
        const typeSelect = modal.locator('select').first();
        await typeSelect.selectOption('bug-ui-ux');

        // Fill title
        const titleInput = modal.locator('input[type="text"]').first();
        await titleInput.fill('Test bug report from E2E');

        // Fill description
        const descriptionTextarea = modal.locator('textarea').first();
        await descriptionTextarea.fill(
            'This is an automated test report from Playwright E2E tests. Please ignore.'
        );

        // Fill reporter name
        const nameInput = modal
            .locator('input[placeholder*="ombre"], input[placeholder*="name"]')
            .first();
        if (await nameInput.isVisible()) {
            await nameInput.fill('E2E Test User');
        }

        // Fill reporter email
        const emailInput = modal.locator('input[type="email"]').first();
        if (await emailInput.isVisible()) {
            await emailInput.fill('e2e-test@hospeda.com');
        }

        // Click "Next" to go to step 2
        const nextButton = modal.getByRole('button', { name: /siguiente|next|continuar/i });
        if (await nextButton.isVisible()) {
            await nextButton.click();
        }

        // --- Step 2: Optional fields (skip, go to submit) ---

        // Look for submit/send button
        const submitButton = modal.getByRole('button', { name: /enviar|submit|send/i });
        if (await submitButton.isVisible()) {
            // Mock the API response to avoid actually creating a Linear issue
            await page.route('**/api/v1/public/feedback', (route) => {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: {
                            linearIssueId: 'TEST-123',
                            linearIssueUrl: 'https://linear.app/test/issue/TEST-123'
                        }
                    })
                });
            });

            await submitButton.click();

            // Wait for success state
            await expect(
                modal.locator('text=/gracias|thank|enviado|submitted|success/i')
            ).toBeVisible({ timeout: 10_000 });
        }
    });
});
