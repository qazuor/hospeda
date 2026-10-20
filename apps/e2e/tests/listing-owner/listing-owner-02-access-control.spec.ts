/**
 * LISTING-OWNER-02 — Listing-owner area access-control (negative path)
 *
 * Validates that the role gate and ownership gate on the gastronomy and experience self-service
 * area reject actors who must not reach those pages:
 *
 *   1. TOURIST BLOCKED — a plain USER (holding no GASTRONOMY_OWNER hat) is
 *      redirected away from /es/mi-cuenta/comercio/ to /es/mi-cuenta/ (the
 *      generic account dashboard). The gate lives in:
 *        apps/web/src/pages/[lang]/mi-cuenta/comercio/index.astro
 *        `if (!<owner nav-access predicate>({ roles: user.roles })) → redirect('mi-cuenta')`
 *      (HOS-296 replaced the scalar owner-role check with
 *      a predicate over the role SET, so a gastronomy or experience owner who is ALSO a host
 *      keeps access.)
 *
 *   2. CROSS-OWNER BLOCKED — a logged-in GASTRONOMY_OWNER (Julieta) navigating
 *      to another owner's (Rodrigo's) gastronomy editor is redirected back to
 *      /es/mi-cuenta/comercio/ (her own listing index). The gate lives in:
 *        apps/web/src/lib/editor/resolve-listing-editor-page.ts (the shared front door)
 *        `if (!ownsListing && !isStaff) → redirect('mi-cuenta/comercio')`
 *
 * Actors:
 *   - e2e-tourist@local.test          (role USER, seeded by gastronomies.seed.ts Step 2b)
 *   - gastro-owner-julieta@local.test (role GASTRONOMY_OWNER, seeded by gastronomies.seed.ts)
 *
 * Cross-owner listing used:
 *   - "La Cervecería del Río" (gastronomy, owner: Rodrigo)
 *     seed id : 003-gastronomy-gualeguaychu-la-cerveceria-del-rio
 *     static UUID: 56c9958b-3ca5-46c1-af8a-d7ba12b7f051  (id-mappings.json)
 *     slug   : la-cerveceria-del-rio
 *
 * Tags: @p0 @listing-owner
 *
 * Preconditions:
 *   - e2e:seed has run (`pnpm --filter hospeda-e2e e2e:seed`).
 *   - e2e-tourist@local.test exists with role USER and profileCompleted=true.
 *   - gastro-owner-julieta@local.test exists with role GASTRONOMY_OWNER.
 *   - Rodrigo's gastronomy "La Cervecería del Río" (id above) is seeded and ACTIVE.
 *   - Web and API servers are running (playwright.config webServer).
 *
 * No data mutation occurs in these tests — no afterEach restore is needed.
 *
 * @see SPEC-252 spec.md § T-004 negative listing-owner access-control E2E
 * @see apps/web/src/pages/[lang]/mi-cuenta/comercio/index.astro
 * @see apps/web/src/lib/editor/resolve-listing-editor-page.ts
 * @see apps/web/src/lib/account-roles.ts
 */

import { expect, test } from '@playwright/test';
import { signInExistingUser } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

/**
 * Plain tourist (role USER). Has no GASTRONOMY_OWNER role.
 * Seeded by packages/seed/src/example/gastronomies.seed.ts Step 2b
 * as part of the example seed (runs via `e2e:seed`).
 */
const TOURIST = {
    email: 'e2e-tourist@local.test',
    password: 'Password123!'
} as const;

/**
 * Gastronomy or experience owner — Julieta Ferreyra (role GASTRONOMY_OWNER).
 * She owns "La Parrilla del Puerto" and "Café del Palacio" (gastronomies)
 * plus three experiences. She does NOT own Rodrigo's listings.
 */
const JULIETA = {
    email: 'gastro-owner-julieta@local.test',
    password: 'Password123!'
} as const;

// ---------------------------------------------------------------------------
// Cross-owner listing (belongs to Rodrigo, not Julieta)
// ---------------------------------------------------------------------------

/**
 * Static UUID for Rodrigo's gastronomy "La Cervecería del Río".
 * Source: packages/seed/mappings/id-mappings.json →
 *   gastronomies["003-gastronomy-gualeguaychu-la-cerveceria-del-rio"].id
 *
 * This UUID is assigned once at seed time and is stable across re-runs
 * (id-mappings.json is committed and never regenerated mid-project).
 */
const RODRIGO_GASTRONOMY_ID = '56c9958b-3ca5-46c1-af8a-d7ba12b7f051';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Injects the Better Auth session cookies returned from the sign-in endpoint
 * into the Playwright browser context so subsequent navigations are
 * authenticated.
 *
 * Both cookies emitted by Better Auth (`better-auth.session_token` and
 * `better-auth.session_data`) are forwarded; `signInExistingUser` already
 * extracts both into a single '; '-joined string.
 */
async function authenticateContext(
    context: import('@playwright/test').BrowserContext,
    sessionCookie: string
): Promise<void> {
    const parsed = sessionCookie.split('; ').map((part) => {
        const eqIdx = part.indexOf('=');
        const name = eqIdx === -1 ? part.trim() : part.slice(0, eqIdx).trim();
        const value = eqIdx === -1 ? '' : part.slice(eqIdx + 1);
        return { name, value, url: WEB_URL };
    });
    await context.addCookies(parsed);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('LISTING-OWNER-02: access-control negative paths @p0 @listing-owner', () => {
    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    // ── Case 1: Tourist (USER) blocked from the listing-owner index ───────────────────

    test('tourist (USER role) is redirected away from /mi-cuenta/comercio/ to /mi-cuenta/', async ({
        page,
        context
    }) => {
        // ── Sign in as a plain tourist ─────────────────────────────────────
        const sessionCookie = await signInExistingUser(
            { email: TOURIST.email, password: TOURIST.password },
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );
        await authenticateContext(context, sessionCookie);

        // ── Attempt to navigate to the listing-owner area ───────────────────────
        await page.goto(`${WEB_URL}/es/mi-cuenta/comercio/`, {
            waitUntil: 'domcontentloaded'
        });

        // The role gate in index.astro redirects non-GASTRONOMY_OWNER users to
        // /[lang]/mi-cuenta/ (the generic account dashboard).
        // Assert the final URL is in /mi-cuenta/ but NOT in /mi-cuenta/comercio/.
        await expect(page).toHaveURL(`${WEB_URL}/es/mi-cuenta/`);
    });

    // ── Case 2: Gastronomy or experience owner blocked from another owner's editor ───────────

    test("gastronomy or experience owner (Julieta) is redirected away from a rival owner's editor to her own listing index", async ({
        page,
        context
    }) => {
        // ── Sign in as Julieta (GASTRONOMY_OWNER) ───────────────────────────
        const sessionCookie = await signInExistingUser(
            { email: JULIETA.email, password: JULIETA.password },
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );
        await authenticateContext(context, sessionCookie);

        // ── Attempt to open Rodrigo's gastronomy editor ───────────────────
        // Julieta's role IS GASTRONOMY_OWNER so the role gate passes.
        // The ownership gate in `resolveListingEditorPage` checks
        // detail.ownerId === user.id, for the hub and every section alike
        // (HOS-1080 moved it out of the single page into the shared resolver).
        // Rodrigo's listing ownerId !== Julieta's userId → redirect to /mi-cuenta/comercio/.
        const rivalEditorUrl = `${WEB_URL}/es/mi-cuenta/comercio/gastronomy/${RODRIGO_GASTRONOMY_ID}/editar`;
        await page.goto(rivalEditorUrl, { waitUntil: 'domcontentloaded' });

        // The ownership gate redirects to /[lang]/mi-cuenta/comercio/ (her index).
        // Assert the final URL is the listing-owner index and does NOT contain the editor path.
        await expect(page).toHaveURL(`${WEB_URL}/es/mi-cuenta/comercio/`);

        // Additionally confirm the gastronomy editor input is NOT present on this page.
        // #ce-menuUrl is the stable, unique id for the gastronomy editor's menuUrl field
        // inside ListingEditor. Its absence confirms we landed on the listing index
        // (which has no editor island) rather than the editor page. Using toHaveCount(0)
        // avoids strict-mode multi-match violations — it passes even if the selector would
        // theoretically match zero OR many elements, since we only care about absence.
        await expect(page.locator('#ce-menuUrl')).toHaveCount(0);
    });
});
