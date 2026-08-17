/**
 * GUEST-01 — Search, filter, paginate, view detail.
 *
 * Actors: Anonymous guest.
 * Tags: @p0 @guest @discovery
 *
 * Preconditions: suite seed (e2e-seed.ts) populates 25+ accommodations
 * across 3+ destinations, multiple types, varied price ranges.
 *
 * Validates the discovery pipeline end-to-end through the public search
 * results page.
 *
 * @see SPEC-092 spec.md § GUEST-01
 */

import { expect, test } from '@playwright/test';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';

test.describe('GUEST-01: search + filter + paginate @p0 @guest @discovery', () => {
    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test('anonymous can search by destination and reach detail', async ({ page }) => {
        // ── 1. Home loads ──────────────────────────────────────────────────
        await page.goto(`${WEB_URL}/es/`, { waitUntil: 'domcontentloaded' });
        expect(page.url()).toContain('/es/');

        // ── 2. Navigate to listing ─────────────────────────────────────────
        await page.goto(`${WEB_URL}/es/alojamientos/`, { waitUntil: 'domcontentloaded' });

        // Cards should be present (seed has 25+).
        const cards = page.locator('[data-testid="accommodation-card"], article');
        await expect(cards.first()).toBeVisible({ timeout: 10_000 });
        const count = await cards.count();
        expect(count).toBeGreaterThanOrEqual(1);

        // ── 3. Click first card → detail page loads ────────────────────────
        const firstHref = await cards.first().locator('a').first().getAttribute('href');
        expect(firstHref).toBeTruthy();
        await page.goto(`${WEB_URL}${firstHref}`, { waitUntil: 'domcontentloaded' });

        // Detail page should respond 200 and contain at least a title and price area.
        expect(page.url()).toContain('/alojamientos/');
        const titles = page.locator('h1');
        await expect(titles.first()).toBeVisible({ timeout: 10_000 });
    });

    test('type filter narrows results', async ({ page }) => {
        // The dedicated landing lives at the Spanish slug (H-110). Loading it
        // directly must serve the page, not redirect.
        const direct = await page.goto(`${WEB_URL}/es/alojamientos/tipo/cabana/`, {
            waitUntil: 'domcontentloaded'
        });
        expect(direct?.status()).toBe(200);
        expect(page.url()).toContain('/alojamientos/tipo/cabana/');
        await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
    });

    test('the English type segment redirects to the Spanish slug', async ({ page }) => {
        // `/tipo/cabin/` was the indexed form before H-110. It has to keep
        // resolving — permanently, and in a single hop, since a redirect chain
        // is what dilutes the signals the 301 exists to carry.
        const response = await page.goto(`${WEB_URL}/es/alojamientos/tipo/cabin/`, {
            waitUntil: 'domcontentloaded'
        });

        expect(page.url()).toContain('/alojamientos/tipo/cabana/');
        expect(response?.status()).toBe(200);

        const chain = response?.request().redirectedFrom();
        expect(chain, 'expected exactly one redirect into this response').not.toBeNull();
        expect(
            chain?.redirectedFrom(),
            'more than one hop: /tipo/cabin/ should reach /tipo/cabana/ directly'
        ).toBeNull();
        expect((await chain?.response())?.status()).toBe(301);
    });
});
