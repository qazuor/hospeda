/**
 * GUEST-07 — Multi-select quick-filter chip back/forward (popstate) coherence.
 *
 * Actors: Anonymous guest.
 * Tags: @p1 @guest @discovery
 *
 * HOS-96 shipped multi-select quick-filter chips on `/alojamientos/`: clicking
 * a type chip accumulates its value into the `?types=` CSV query param (the
 * only shared state source — there is no in-memory store, see
 * `apps/web/CLAUDE.md` § "Multi-select quick-filter facets (HOS-96)"), and
 * each chip's `aria-current`/active state is re-derived from that param on
 * every render. The existing jsdom integration coverage
 * (`packages/service-core` HOS-96 T-006/T-007 and the web unit suite) proves
 * the URL <-> active-chip mapping in isolation, but cannot exercise real
 * browser history — this spec closes that gap by driving actual
 * `page.goBack()` / `page.goForward()` (popstate) through two real chip
 * clicks and asserting the rendered chip state matches the restored URL at
 * every step, including that a removed selection does NOT survive a Back.
 *
 * Chips are real `<a href>` navigations (`apps/web/src/components/shared/ui/
 * FilterChips.astro`), not client-side JS toggles, so every click creates a
 * genuine browser history entry — exactly the mechanism Back/Forward relies
 * on. `Locator`s below are re-queried live against the current document on
 * every action/assertion, so the same `firstChip`/`secondChip` locators stay
 * valid across the full-page navigations triggered by clicks and Back/Forward.
 *
 * Type chips render for every `AccommodationTypeEnum` member unconditionally
 * (`typeChips = Object.values(AccommodationTypeEnum).map(...)` in
 * `apps/web/src/pages/[lang]/alojamientos/index.astro`), independent of
 * which types the current seed actually has accommodations for. This test
 * deliberately does not hardcode specific type values (e.g. HOTEL/CABIN) —
 * it reads the first two rendered chips' own hrefs to learn which two type
 * values it is toggling, so it stays correct regardless of seed contents or
 * enum member order.
 *
 * @see .specs/HOS-96-multi-select-quick-filter-chips/spec.md
 */

import { expect, test } from '@playwright/test';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';

/** Accessible name of the type quick-filter chip row's <nav> (es locale). */
const TYPE_CHIPS_NAV_LABEL = 'Filtrar por tipo de alojamiento';

/**
 * Read the `types` array query param off a URL (relative or absolute),
 * resolving relative hrefs against `WEB_URL` the same way the browser does.
 */
function readTypesParam(url: string): string[] {
    const parsed = new URL(url, WEB_URL);
    const raw = parsed.searchParams.get('types');
    return raw ? raw.split(',') : [];
}

test.describe('GUEST-07: listing filter chips back/forward coherence @p1 @guest @discovery', () => {
    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test('multi-select type chips restore correctly on browser Back/Forward', async ({ page }) => {
        // ── 1. Load the listing with no filters active ─────────────────────
        await page.goto(`${WEB_URL}/es/alojamientos/`, { waitUntil: 'domcontentloaded' });

        const typeChipsNav = page.locator(`nav[aria-label="${TYPE_CHIPS_NAV_LABEL}"]`);
        await expect(typeChipsNav).toBeVisible({ timeout: 10_000 });

        const chipLinks = typeChipsNav.locator('a.filter-chips__chip');
        const chipCount = await chipLinks.count();
        expect(
            chipCount,
            'accommodation type chips render unconditionally from the enum — at least 2 must exist'
        ).toBeGreaterThanOrEqual(2);

        // First two chip locators — re-queried live on every action below, so
        // they stay valid across the full-page navigations that follow.
        const firstChip = chipLinks.nth(0);
        const secondChip = chipLinks.nth(1);

        // Learn the first two type values from their own (pre-click) hrefs —
        // do not hardcode HOTEL/CABIN, stay correct regardless of seed data.
        const firstHrefBefore = await firstChip.getAttribute('href');
        const secondHrefBefore = await secondChip.getAttribute('href');
        expect(firstHrefBefore).toBeTruthy();
        expect(secondHrefBefore).toBeTruthy();
        const [firstValue] = readTypesParam(firstHrefBefore as string);
        const [secondValue] = readTypesParam(secondHrefBefore as string);
        expect(firstValue).toBeTruthy();
        expect(secondValue).toBeTruthy();
        expect(firstValue).not.toBe(secondValue);

        // ── 2. Click the first chip → ?types=<first> ────────────────────────
        await firstChip.click();
        await page.waitForURL((url) => readTypesParam(url.toString()).length === 1, {
            timeout: 15_000
        });

        expect(readTypesParam(page.url())).toEqual([firstValue]);
        await expect(firstChip).toHaveAttribute('aria-current', 'true');
        await expect(firstChip).toHaveClass(/filter-chips__chip--active/);
        await expect(secondChip).not.toHaveAttribute('aria-current', 'true');
        await expect(secondChip).not.toHaveClass(/filter-chips__chip--active/);

        // ── 3. Click the second chip → accumulates: ?types=<first>,<second> ─
        await secondChip.click();
        await page.waitForURL((url) => readTypesParam(url.toString()).length === 2, {
            timeout: 15_000
        });

        expect(readTypesParam(page.url())).toEqual([firstValue, secondValue]);
        await expect(firstChip).toHaveAttribute('aria-current', 'true');
        await expect(secondChip).toHaveAttribute('aria-current', 'true');
        await expect(firstChip).toHaveClass(/filter-chips__chip--active/);
        await expect(secondChip).toHaveClass(/filter-chips__chip--active/);

        // ── 4. Browser Back → URL AND rendered state revert to just <first> ─
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await page.waitForURL((url) => readTypesParam(url.toString()).length === 1, {
            timeout: 15_000
        });

        expect(
            readTypesParam(page.url()),
            'Back must restore the single-value URL, not stay on the two-value one'
        ).toEqual([firstValue]);
        await expect(firstChip).toHaveAttribute('aria-current', 'true');
        await expect(firstChip).toHaveClass(/filter-chips__chip--active/);
        // No stale selection: the second chip must NOT read as active after Back.
        await expect(secondChip).not.toHaveAttribute('aria-current', 'true');
        await expect(secondChip).not.toHaveClass(/filter-chips__chip--active/);

        // ── 5. Browser Forward → URL AND rendered state re-accumulate both ──
        await page.goForward({ waitUntil: 'domcontentloaded' });
        await page.waitForURL((url) => readTypesParam(url.toString()).length === 2, {
            timeout: 15_000
        });

        expect(readTypesParam(page.url())).toEqual([firstValue, secondValue]);
        await expect(firstChip).toHaveAttribute('aria-current', 'true');
        await expect(secondChip).toHaveAttribute('aria-current', 'true');
        await expect(firstChip).toHaveClass(/filter-chips__chip--active/);
        await expect(secondChip).toHaveClass(/filter-chips__chip--active/);
    });
});
