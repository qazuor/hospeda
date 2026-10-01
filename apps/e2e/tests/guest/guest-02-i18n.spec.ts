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

    /**
     * HOS-1267: this test used to be three `goto()` calls to hand-written URLs,
     * each asserting that `page.url()` contained the path the test had just
     * typed. It never touched the language switcher, so it could not fail no
     * matter what the switcher did — including sending every locale to the home
     * page.
     *
     * The behaviour worth protecting is `buildLocaleUrl` in
     * `apps/web/src/components/shared/preferences/LanguageSwitcher.client.tsx`:
     * it swaps ONLY the locale prefix and keeps the rest of the path, which is
     * what "switching language keeps you on the same page" means. So the test
     * now drives the real control and reads where the browser ends up.
     */
    test('the language switcher keeps you on the same section', async ({ page }) => {
        await page.goto(`${WEB_URL}/es/alojamientos/`, { waitUntil: 'domcontentloaded' });

        // The switcher is a `role="group"` labelled "Cambiar idioma" holding one
        // anchor per locale, each labelled with the language's own name.
        const switcher = page.getByRole('group', { name: 'Cambiar idioma' });
        await expect(
            switcher,
            'the listing page must render the language switcher — without it this test has nothing to drive'
        ).toBeVisible();

        // Reading the live `aria-current` (rather than assuming) is what ties
        // the assertions below to the control's own idea of the active locale.
        await expect(
            switcher.getByRole('link', { name: 'Español' }),
            'Español must be the active option on an /es/ page'
        ).toHaveAttribute('aria-current', 'true');

        // ── es → en: the SECTION must survive the switch ───────────────────
        await switcher.getByRole('link', { name: 'English' }).click();
        await page.waitForURL(/\/en\//, { timeout: 15_000 });
        expect(
            new URL(page.url()).pathname,
            'switching to English from /es/alojamientos/ must land on /en/alojamientos/, ' +
                'not on the /en/ home page — preserving the section is the whole behaviour'
        ).toBe('/en/alojamientos/');
        await expect(
            switcher.getByRole('link', { name: 'English' }),
            'English must be the active option after the switch'
        ).toHaveAttribute('aria-current', 'true');

        // ── en → pt: same again, from a non-default locale ─────────────────
        await switcher.getByRole('link', { name: 'Português' }).click();
        await page.waitForURL(/\/pt\//, { timeout: 15_000 });
        expect(
            new URL(page.url()).pathname,
            'switching to Português from /en/alojamientos/ must land on /pt/alojamientos/'
        ).toBe('/pt/alojamientos/');

        // The destination must be a real page, not a 404 shell: the switcher
        // could preserve the path and still point at something unroutable.
        await expect(page.locator('h1').first()).toBeVisible();
    });
});
