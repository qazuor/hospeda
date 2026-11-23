/**
 * VISUAL-SHELL — visual regression of the Mi Cuenta account shell on the
 * dashboard, in light and dark, at desktop 1280 and mobile 375 (HOS-2471).
 *
 * No account page is migrated to the kit yet (phases 3-5), so the first page
 * baseline is the shell itself on `/es/mi-cuenta/`: header, sidebar (desktop),
 * AccountBar and its drawer (mobile), footer. Every page migrated in phases
 * 3-5 adds its own baselines here, with the same matrix (README → «Visual
 * regression»).
 *
 * Preconditions:
 *   - e2e:seed has run (`e2e-tourist@local.test`, role USER, profile complete).
 *   - Run ONLY through `e2e:test:visual` / `e2e:visual:update` (pinned image).
 *
 * Masked (content that is not the shell and is not stable between runs):
 *   - the time-of-day greeting above the user name;
 *   - the stat cards, which load client-side from live counters (and the
 *     dashboard's section cards under them: page content, not shell);
 *   - the footer copyright, whose year is the server's current year.
 *
 * The open drawer is shot as an element: a full-page mask would be painted
 * over the drawer itself.
 *
 * Tags: @visual @account
 */

import { expect, type Page, test } from '@playwright/test';
import {
    prepareVisualPage,
    settleVisualPage,
    VISUAL_MATRIX
} from '../../fixtures/visual-helpers.ts';

const DASHBOARD_PATH = '/es/mi-cuenta/';

/**
 * Regions masked in every dashboard shot.
 *
 * @param input.page - The settled page.
 * @returns The locators to paint over.
 */
function dashboardMasks(input: { readonly page: Page }) {
    return [
        input.page.locator('.account__user-eyebrow'),
        input.page.locator('#account-stats > :not(h2)'),
        input.page.locator('[data-account-footer] > p')
    ];
}

test.describe('VISUAL-SHELL: Mi Cuenta account shell @visual @account', () => {
    for (const { theme, viewport } of VISUAL_MATRIX) {
        test(`dashboard — ${theme} ${viewport}`, async ({ page, context }) => {
            await prepareVisualPage({ page, context, theme, viewport });
            const status = await settleVisualPage({ page, path: DASHBOARD_PATH, theme });
            expect(status).toBe(200);

            await expect(page).toHaveScreenshot(
                ['account-shell', `dashboard--${theme}-${viewport}.png`],
                {
                    fullPage: true,
                    mask: dashboardMasks({ page })
                }
            );
        });
    }

    for (const { theme } of VISUAL_MATRIX.filter((cell) => cell.viewport === 'mobile')) {
        test(`dashboard drawer open — ${theme} mobile`, async ({ page, context }) => {
            await prepareVisualPage({ page, context, theme, viewport: 'mobile' });
            await settleVisualPage({ page, path: DASHBOARD_PATH, theme });

            await page.locator('[data-account-bar] button[aria-expanded]').click();
            await expect(page.getByRole('dialog')).toBeVisible();

            await expect(page.getByRole('dialog')).toHaveScreenshot([
                'account-shell',
                `dashboard-drawer--${theme}-mobile.png`
            ]);
        });
    }
});
