/**
 * GUEST-08 — Soft navigation into the comparison page hydrates its islands (HOS-575).
 *
 * Actors: anonymous visitor.
 * Tags: @p0 @guest
 *
 * Preconditions:
 *   - Suite seed has at least 2 ACTIVE, publicly-visible accommodations.
 *
 * What this pins:
 *   The CompareBar CTA on `/es/alojamientos/` reaches `/es/alojamientos/comparar/`
 *   through a `<ClientRouter />` SOFT navigation, and the destination's
 *   `client:only` islands (`ComparisonMatrix`, `CompareCount`) still hydrate.
 *
 * Why it can break:
 *   A soft nav keeps the ORIGIN page's CSP in force. The listing ships no
 *   `client:only` island, so unless every response hash-allows Astro's
 *   `client:only` runtime (HOS-798, `csp-astro-runtime-hashes.ts`), that runtime
 *   is blocked on arrival and both islands stay as bare `<astro-island ssr>`
 *   shells — a blank page with no error anywhere. HOS-566 hid it behind a
 *   `data-astro-reload`; HOS-575 removed that workaround.
 *
 *   The unit test `apps/web/src/lib/__tests__/csp-astro-runtime-hashes.test.ts`
 *   gates the cause (the header content). This spec gates the behaviour: it goes
 *   red if the hashes regress AND if someone re-adds a hard reload to the CTA,
 *   because the `window` marker below only survives a soft navigation.
 *
 * Deliberately anonymous and store-seeded: hydration does not depend on the
 * visitor's entitlements, so no user, subscription or selection clicks are
 * needed — which keeps this fast enough to gate every PR. The full select →
 * compare → matrix flow for a paying user lives in GUEST-05 (@p1).
 */

import { expect, test } from '@playwright/test';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';

/** compare-store localStorage keys (apps/web/src/store/compare-store.ts). */
const COMPARE_IDS_KEY = 'hospeda:compare:v1';
const COMPARE_SAVED_AT_KEY = 'hospeda:compare:savedAt:v1';
const COMPARE_MODE_KEY = 'hospeda:compare:mode:v1';

type AccRow = { id: string } & Record<string, unknown>;
type MarkedWindow = Window & { __hos575SoftNav?: boolean };

test.describe('GUEST-08: soft navigation to the comparison page hydrates @p0 @guest', () => {
    let accIds: string[] = [];

    test.beforeAll(async () => {
        const accs = await execSQL<AccRow>(
            `SELECT id FROM accommodations
             WHERE lifecycle_state = 'ACTIVE'
               AND visibility = 'PUBLIC'
               AND deleted_at IS NULL
             ORDER BY created_at ASC
             LIMIT 2`
        );
        accIds = accs.map((a) => a.id);
    });

    test('CompareBar CTA soft-navigates and every client:only island hydrates', async ({
        page
    }) => {
        test.fixme(accIds.length < 2, 'Seed needs ≥ 2 ACTIVE accommodations');

        // ── Arrange: a persisted two-item selection, then the listing ───────
        await seedCookieConsent(page);
        await page.addInitScript(
            ({ ids, idsKey, savedAtKey, modeKey }) => {
                // Only seed once: the store rewrites these itself afterwards.
                if (window.localStorage.getItem(idsKey) !== null) return;
                window.localStorage.setItem(idsKey, JSON.stringify(ids));
                window.localStorage.setItem(savedAtKey, JSON.stringify(Date.now()));
                window.localStorage.setItem(modeKey, 'true');
            },
            {
                ids: accIds,
                idsKey: COMPARE_IDS_KEY,
                savedAtKey: COMPARE_SAVED_AT_KEY,
                modeKey: COMPARE_MODE_KEY
            }
        );
        await page.goto(`${WEB_URL}/es/alojamientos/`, { waitUntil: 'domcontentloaded' });

        const bar = page.getByRole('region', { name: /comparar alojamientos/i });
        const cta = bar.getByRole('link', { name: /ver comparaci[oó]n/i });
        await expect(cta).toBeVisible({ timeout: 15_000 });

        // A marker on `window` survives a soft nav and dies on a full load.
        await page.evaluate(() => {
            (window as MarkedWindow).__hos575SoftNav = true;
        });

        // ── Act ─────────────────────────────────────────────────────────────
        await cta.click();
        await page.waitForURL(/\/es\/alojamientos\/comparar\/?$/, { timeout: 15_000 });

        // ── Assert: it was a soft navigation … ──────────────────────────────
        const survivedSoftNav = await page.evaluate(
            () => (window as MarkedWindow).__hos575SoftNav === true
        );
        expect(
            survivedSoftNav,
            'the CompareBar CTA must reach /comparar/ through a ClientRouter soft navigation'
        ).toBe(true);

        // … and every client:only island hydrated. Astro removes `ssr` from an
        // island once it hydrates; one still carrying it never mounted.
        const clientOnly = page.locator('astro-island[client="only"]');
        await expect(clientOnly).not.toHaveCount(0);
        await expect(page.locator('astro-island[client="only"][ssr]')).toHaveCount(0, {
            timeout: 15_000
        });
    });
});
