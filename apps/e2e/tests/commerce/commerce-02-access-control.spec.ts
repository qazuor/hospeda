/**
 * COMMERCE-02 — Commerce area access-control (negative path)
 *
 * Validates that the role gate and ownership gate on the commerce self-service
 * area reject actors who must not reach those pages:
 *
 *   1. TOURIST BLOCKED — a plain USER (no COMMERCE_OWNER role) is redirected
 *      away from /es/mi-cuenta/comercio/ to /es/mi-cuenta/ (the generic
 *      account dashboard). The gate lives in:
 *        apps/web/src/pages/[lang]/mi-cuenta/comercio/index.astro (L32-34)
 *        `if (!isCommerceOwnerRole(user.role)) → redirect('mi-cuenta')`
 *
 *   2. CROSS-OWNER BLOCKED — a logged-in COMMERCE_OWNER (Julieta) navigating
 *      to another owner's (Rodrigo's) gastronomy editor is redirected back to
 *      /es/mi-cuenta/comercio/ (her own listing index). The gate lives in:
 *        apps/web/src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar.astro (L51-55)
 *        `if (!ownsListing && !isStaff) → redirect('mi-cuenta/comercio')`
 *
 * Actors:
 *   - e2e-tourist@local.test          (role USER, seeded by gastronomies.seed.ts Step 2b)
 *   - gastro-owner-julieta@local.test (role COMMERCE_OWNER, seeded by gastronomies.seed.ts)
 *
 * Cross-owner listing used:
 *   - "La Cervecería del Río" (gastronomy, owner: Rodrigo)
 *     seed id : 003-gastronomy-gualeguaychu-la-cerveceria-del-rio
 *     static UUID: 56c9958b-3ca5-46c1-af8a-d7ba12b7f051  (id-mappings.json)
 *     slug   : la-cerveceria-del-rio
 *
 * Tags: @p0 @commerce
 *
 * Preconditions:
 *   - e2e:seed has run (`pnpm --filter hospeda-e2e e2e:seed`).
 *   - e2e-tourist@local.test exists with role USER and profileCompleted=true.
 *   - gastro-owner-julieta@local.test exists with role COMMERCE_OWNER.
 *   - Rodrigo's gastronomy "La Cervecería del Río" (id above) is seeded and ACTIVE.
 *   - Web and API servers are running (playwright.config webServer).
 *
 * No data mutation occurs in these tests — no afterEach restore is needed.
 *
 * @see SPEC-252 spec.md § T-004 negative commerce access-control E2E
 * @see apps/web/src/pages/[lang]/mi-cuenta/comercio/index.astro
 * @see apps/web/src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar.astro
 * @see apps/web/src/lib/account-roles.ts (isCommerceOwnerRole)
 */

import { expect, test } from '@playwright/test';
import { signInExistingUser } from '../../fixtures/api-helpers.ts';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

/**
 * Plain tourist (role USER). Has no COMMERCE_OWNER role.
 * Seeded by packages/seed/src/example/gastronomies.seed.ts Step 2b
 * as part of the example seed (runs via `e2e:seed`).
 */
const TOURIST = {
    email: 'e2e-tourist@local.test',
    password: 'Password123!'
} as const;

/**
 * Commerce owner — Julieta Ferreyra (role COMMERCE_OWNER).
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
        const name = eqIdx !== -1 ? part.slice(0, eqIdx).trim() : part.trim();
        const value = eqIdx !== -1 ? part.slice(eqIdx + 1) : '';
        return { name, value, url: WEB_URL };
    });
    await context.addCookies(parsed);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('COMMERCE-02: access-control negative paths @p0 @commerce', () => {
    // ── Case 1: Tourist (USER) blocked from commerce index ───────────────────

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

        // ── Attempt to navigate to the commerce area ───────────────────────
        await page.goto(`${WEB_URL}/es/mi-cuenta/comercio/`, {
            waitUntil: 'domcontentloaded'
        });

        // The role gate in index.astro redirects non-COMMERCE_OWNER users to
        // /[lang]/mi-cuenta/ (the generic account dashboard).
        // Assert the final URL is in /mi-cuenta/ but NOT in /mi-cuenta/comercio/.
        await expect(page).toHaveURL(`${WEB_URL}/es/mi-cuenta/`);
    });

    // ── Case 2: Commerce owner blocked from another owner's editor ───────────

    test("commerce owner (Julieta) is redirected away from a rival owner's editor to her own listing index", async ({
        page,
        context
    }) => {
        // ── Sign in as Julieta (COMMERCE_OWNER) ───────────────────────────
        const sessionCookie = await signInExistingUser(
            { email: JULIETA.email, password: JULIETA.password },
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );
        await authenticateContext(context, sessionCookie);

        // ── Attempt to open Rodrigo's gastronomy editor ───────────────────
        // Julieta's role IS COMMERCE_OWNER so the role gate passes.
        // The ownership gate in editar.astro checks detail.ownerId === user.id.
        // Rodrigo's listing ownerId !== Julieta's userId → redirect to /mi-cuenta/comercio/.
        const rivalEditorUrl = `${WEB_URL}/es/mi-cuenta/comercio/gastronomy/${RODRIGO_GASTRONOMY_ID}/editar`;
        await page.goto(rivalEditorUrl, { waitUntil: 'domcontentloaded' });

        // The ownership gate redirects to /[lang]/mi-cuenta/comercio/ (her index).
        // Assert the final URL is the commerce index and does NOT contain the editor path.
        await expect(page).toHaveURL(`${WEB_URL}/es/mi-cuenta/comercio/`);

        // Additionally confirm the editor form is NOT present on this page
        // (the listing index has no form[aria-busy] — that element only exists
        // inside the CommerceListingEditor island on the editor page).
        await expect(page.locator('form[aria-busy]')).not.toBeVisible();
    });
});
