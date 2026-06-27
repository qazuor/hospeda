/**
 * GUEST-02 — i18n locale switching across pages.
 *
 * Actors: Anonymous guest.
 * Tags: @p0 @guest @i18n
 *
 * Validates that locale prefix in URL (/es/, /en/, /pt/) loads the right
 * translations and that switching locale on a deep page preserves the
 * page identity.
 *
 * @see SPEC-092 spec.md § GUEST-02
 */

import { expect, test } from '@playwright/test';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';

test.describe('GUEST-02: i18n locale switching @p0 @guest @i18n', () => {
    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test('all 3 locales render the home page', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        for (const locale of ['es', 'en', 'pt']) {
            const response = await page.goto(`${WEB_URL}/${locale}/`, {
                waitUntil: 'domcontentloaded'
            });
            expect(
                response?.ok(),
                `/${locale}/ must respond 200, got ${response?.status() ?? 'unknown'}`
            ).toBe(true);
            expect(page.url()).toContain(`/${locale}/`);

            // Page must have a body and a title
            const title = await page.title();
            expect(title.length).toBeGreaterThan(0);
        }

        // No missing-i18n-key errors logged
        const i18nErrors = consoleErrors.filter((msg) =>
            /missing.*translation|i18n.*key|missing.*key/i.test(msg)
        );
        expect(
            i18nErrors,
            `console must not log missing i18n keys; saw: ${i18nErrors.join('\n')}`
        ).toEqual([]);
    });

    test('switching locale on listing page preserves the section', async ({ page }) => {
        await page.goto(`${WEB_URL}/es/alojamientos/`, { waitUntil: 'domcontentloaded' });
        await page.goto(`${WEB_URL}/en/alojamientos/`, { waitUntil: 'domcontentloaded' });
        expect(page.url()).toContain('/en/alojamientos/');

        await page.goto(`${WEB_URL}/pt/alojamientos/`, { waitUntil: 'domcontentloaded' });
        expect(page.url()).toContain('/pt/alojamientos/');
    });
});
