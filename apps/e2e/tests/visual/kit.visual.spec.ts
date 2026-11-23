/**
 * VISUAL-KIT — visual regression of every Mi Cuenta kit component state, in
 * light and dark, at desktop 1280 and mobile 375 (HOS-2471, HOS-2413 T-030).
 *
 * Preconditions:
 *   - e2e:seed has run (`e2e-tourist@local.test` exists; the kit page lives
 *     under `/mi-cuenta/`, which requires a session).
 *   - The web server runs with `HOSPEDA_ACCOUNT_KIT_GALLERY=true`
 *     (`playwright.visual.config.ts` sets it when it boots the server).
 *   - Run ONLY through `e2e:test:visual` / `e2e:visual:update`: the browser
 *     must be the pinned Playwright Docker image, or nothing matches.
 *
 * What it shoots:
 *   - Every `[data-visual]` block of `/es/mi-cuenta/kit/` as an element
 *     screenshot. The list is read from the page, so a component added to the
 *     gallery is covered automatically (its first run fails until its
 *     baseline is generated and committed).
 *   - The four overlays (`?open=dialog|confirm|drawer-bottom|drawer-right`) as
 *     viewport screenshots, because they cover the page.
 *
 * Tags: @visual @account
 */

import { expect, test } from '@playwright/test';
import {
    prepareVisualPage,
    settleVisualPage,
    VISUAL_MATRIX,
    visualFileSegment
} from '../../fixtures/visual-helpers.ts';

const KIT_PATH = '/es/mi-cuenta/kit/';

/** Overlays the gallery opens statically through `?open=` (KitGalleryFeedback). */
const OVERLAYS = ['dialog', 'confirm', 'drawer-bottom', 'drawer-right'] as const;

test.describe('VISUAL-KIT: Mi Cuenta kit gallery @visual @account', () => {
    for (const { theme, viewport } of VISUAL_MATRIX) {
        test(`every kit state — ${theme} ${viewport}`, async ({ page, context }) => {
            await prepareVisualPage({ page, context, theme, viewport });
            const status = await settleVisualPage({ page, path: KIT_PATH, theme });
            expect(status, 'the kit gallery must be enabled for the visual run').toBe(200);

            const names = await page
                .locator('[data-visual]')
                .evaluateAll((nodes) =>
                    nodes.map((node) => node.getAttribute('data-visual') ?? '')
                );
            // A gallery that rendered nothing would make this test pass vacuously.
            expect(names.length, 'the gallery rendered no [data-visual] block').toBeGreaterThan(0);
            expect(new Set(names).size, 'data-visual names must be unique').toBe(names.length);

            for (const name of names) {
                await expect
                    .soft(page.locator(`[data-visual="${name}"]`))
                    .toHaveScreenshot([
                        'kit',
                        `${visualFileSegment({ name })}--${theme}-${viewport}.png`
                    ]);
            }
        });

        for (const overlay of OVERLAYS) {
            test(`overlay ${overlay} — ${theme} ${viewport}`, async ({ page, context }) => {
                await prepareVisualPage({ page, context, theme, viewport });
                await settleVisualPage({ page, path: `${KIT_PATH}?open=${overlay}`, theme });
                await expect(
                    page.getByRole(overlay === 'confirm' ? 'alertdialog' : 'dialog')
                ).toBeVisible();

                await expect(page).toHaveScreenshot([
                    'kit-overlays',
                    `${overlay}--${theme}-${viewport}.png`
                ]);
            });
        }
    }
});
