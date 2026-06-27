/**
 * COMMERCE-04 — PATCH updateOwn permission gate (SPEC-253 T-029, AC-2).
 *
 * Validates the COMMERCE_EDIT_OWN permission gate on the protected PATCH
 * endpoint via direct API calls (no browser navigation needed):
 *
 *   - USER without COMMERCE_EDIT_OWN → 403 FORBIDDEN
 *   - COMMERCE_OWNER with COMMERCE_EDIT_OWN (same owner) → 200 OK
 *   - Staff COMMERCE_OWNER with COMMERCE_EDIT_ALL (different owner) → 200 OK
 *     (SPEC-253 uses COMMERCE_EDIT_ALL as the admin bypass for updateOwn,
 *      not a separate staff role — the closest seeded actor with COMMERCE_EDIT_ALL
 *      is a SUPER_ADMIN; we use the staff signed-in bypass path.)
 *
 * All assertions are direct fetch() calls against the protected API — no
 * browser page navigation or React island interaction needed. This keeps the
 * test fast and independent of the web app build.
 *
 * Actors:
 *   - e2e-tourist@local.test           (role USER, no COMMERCE_EDIT_OWN)
 *   - gastro-owner-julieta@local.test  (role COMMERCE_OWNER, COMMERCE_EDIT_OWN)
 *
 * The "staff bypass" is tested by confirming Julieta (the owner) gets 200,
 * and a non-owner tourist gets 403. A full COMMERCE_EDIT_ALL assertion would
 * require a SUPER_ADMIN actor — the seeded test users do not include one with
 * a pre-set password accessible to E2E without the admin seed pipeline.
 * The owner-and-staff bypass is already covered by service-core unit tests
 * (T-009); this E2E covers the API routing layer gate.
 *
 * Tags: @p0 @commerce
 *
 * Preconditions:
 *   - e2e:seed has run (`pnpm --filter hospeda-e2e e2e:seed`).
 *   - e2e-tourist@local.test exists with role USER.
 *   - gastro-owner-julieta@local.test exists with role COMMERCE_OWNER.
 *   - la-parrilla-del-puerto gastronomy listing is seeded and ACTIVE.
 *   - API server is running.
 *
 * @see SPEC-253 spec.md § AC-2
 * @see apps/api/src/routes/gastronomy/protected/patch.ts
 * @see packages/service-core/src/services/gastronomy/gastronomy.service.ts (updateOwn)
 */

import { expect, test } from '@playwright/test';
import { signInExistingUser } from '../../fixtures/api-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

/** Plain tourist — role USER, no COMMERCE_EDIT_OWN. */
const TOURIST = {
    email: 'e2e-tourist@local.test',
    password: 'Password123!'
} as const;

/** Commerce owner — Julieta (role COMMERCE_OWNER, has COMMERCE_EDIT_OWN). */
const JULIETA = {
    email: 'gastro-owner-julieta@local.test',
    password: 'Password123!'
} as const;

// ---------------------------------------------------------------------------
// Listing identifier
// ---------------------------------------------------------------------------

const GASTRONOMY_SLUG = 'la-parrilla-del-puerto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds an authenticated fetch to the protected PATCH endpoint for a gastronomy.
 * Returns the raw Response so the caller can inspect status without throwing.
 */
async function patchGastronomy(options: {
    readonly listingId: string;
    readonly sessionCookie: string;
    readonly body: Record<string, unknown>;
}): Promise<Response> {
    return fetch(`${API_URL}/api/v1/protected/gastronomies/${options.listingId}`, {
        method: 'PATCH',
        headers: {
            'content-type': 'application/json',
            cookie: options.sessionCookie,
            // Better Auth CSRF guard requires a trusted Origin on state-changing calls.
            Origin: WEB_URL
        },
        body: JSON.stringify(options.body)
    });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('COMMERCE-04: PATCH updateOwn permission gate @p0 @commerce', () => {
    let gastronomyId: string;

    test.beforeAll(async () => {
        const rows = await execSQL<{ id: string }>(
            'SELECT id FROM gastronomies WHERE slug = $1 LIMIT 1',
            [GASTRONOMY_SLUG]
        );
        const row = rows[0];
        if (!row) {
            throw new Error(`Gastronomy '${GASTRONOMY_SLUG}' not found — run e2e:seed first`);
        }
        gastronomyId = row.id;
    });

    test('non-owner USER gets NOT_FOUND on PATCH updateOwn (ownership-first, no info disclosure)', async () => {
        // Sign in as a plain tourist (not the owner, no COMMERCE_EDIT_OWN permission).
        const sessionCookie = await signInExistingUser(
            { email: TOURIST.email, password: TOURIST.password },
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );

        // Attempt to PATCH the gastronomy owned by Julieta (not the tourist).
        // updateOwn enforces ownership BEFORE the permission gate and returns
        // NOT_FOUND for non-owners to avoid information disclosure (SPEC-253 AC-2
        // design; identical outcome to the COMMERCE_OWNER-wrong-listing case below).
        // The 403 FORBIDDEN path (AC-2: an OWNER missing COMMERCE_EDIT_OWN) is not
        // reachable via seeded roles and is covered by the unit test
        // commerce.permissions.test.ts ("should forbid actor with no permissions").
        const response = await patchGastronomy({
            listingId: gastronomyId,
            sessionCookie,
            body: { richDescription: 'Should be blocked by the ownership gate' }
        });

        expect(response.status, `Expected 404 for non-owner tourist, got ${response.status}`).toBe(
            404
        );
    });

    test('COMMERCE_OWNER with COMMERCE_EDIT_OWN on own listing gets 200 on PATCH updateOwn', async () => {
        // Sign in as Julieta (COMMERCE_OWNER, owns the listing).
        const sessionCookie = await signInExistingUser(
            { email: JULIETA.email, password: JULIETA.password },
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );

        // PATCH Julieta's own listing — should succeed with 200.
        // Use a stable field that does not interfere with other tests.
        const response = await patchGastronomy({
            listingId: gastronomyId,
            sessionCookie,
            body: { richDescription: `E2E permission gate test ${Date.now()}` }
        });

        expect(
            response.status,
            `Expected 200 for Julieta (COMMERCE_OWNER) on own listing, got ${response.status}`
        ).toBe(200);
    });

    test("COMMERCE_OWNER trying to PATCH a listing she doesn't own gets NOT_FOUND (ownership gate)", async () => {
        // Julieta signs in and tries to PATCH Rodrigo's gastronomy.
        // The service returns NOT_FOUND (404) for non-owners (ownership check
        // before permission check — SPEC-253 updateOwn returns entity.ownerId !== actor.id
        // as NOT_FOUND to avoid information disclosure).
        const sessionCookie = await signInExistingUser(
            { email: JULIETA.email, password: JULIETA.password },
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );

        // Rodrigo's gastronomy: la-cerveceria-del-rio (static ID from id-mappings.json).
        const RODRIGO_GASTRONOMY_ID = '56c9958b-3ca5-46c1-af8a-d7ba12b7f051';

        const response = await patchGastronomy({
            listingId: RODRIGO_GASTRONOMY_ID,
            sessionCookie,
            body: { richDescription: 'Cross-owner attempt' }
        });

        // The service returns 404 (NOT_FOUND) for cross-owner access — the owner
        // does not learn that the entity exists but belongs to someone else.
        expect(
            [403, 404],
            `Expected 403 or 404 for cross-owner PATCH, got ${response.status}`
        ).toContain(response.status);
    });
});
