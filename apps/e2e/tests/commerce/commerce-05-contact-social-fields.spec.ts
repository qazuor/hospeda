/**
 * COMMERCE-05 — Contact section has no `website` field; social section
 * includes `linkedIn` input (SPEC-253 T-030, AC-4).
 *
 * Validates:
 *   1. The contact fieldset in CommerceListingEditor DOES NOT contain an input
 *      with aria-label or label text matching 'website' / 'Sitio Web' /
 *      'sitio web'. (website was present in SPEC-239 but removed per AC-4.)
 *   2. The social fieldset DOES contain an input with aria-label 'linkedIn'.
 *   3. A value entered in the linkedIn input is saved (PATCH succeeds) and
 *      persists (re-opening the editor shows the pre-filled value).
 *
 * Actor: gastro-owner-julieta@local.test (role COMMERCE_OWNER).
 * Listing: la-parrilla-del-puerto (gastronomy).
 *
 * Tags: @p0 @commerce
 *
 * Preconditions:
 *   - e2e:seed has run.
 *   - gastro-owner-julieta@local.test exists with role COMMERCE_OWNER.
 *   - la-parrilla-del-puerto is seeded and ACTIVE/PUBLIC.
 *   - Web and API servers are running (playwright.config webServer).
 *
 * @see SPEC-253 spec.md § AC-4
 * @see apps/web/src/components/commerce/CommerceListingEditor.client.tsx
 *   (ContactValues — no website; SocialValues — includes linkedIn)
 * @see apps/e2e/fixtures/react19-input-helpers.ts
 */

import { expect, test } from '@playwright/test';
import { signInExistingUser } from '../../fixtures/api-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { setReactInputValue } from '../../fixtures/react19-input-helpers.ts';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

/** Commerce owner whose gastronomy editor is under test. */
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
 * Injects the Better Auth session cookies into the Playwright browser context.
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

test.describe('COMMERCE-05: contact has no website; social includes linkedIn @p0 @commerce', () => {
    let gastronomyId: string;
    let originalLinkedIn: string | null;

    test.beforeAll(async () => {
        const rows = await execSQL<{ id: string; social_networks: Record<string, string> | null }>(
            'SELECT id, social_networks FROM gastronomies WHERE slug = $1 LIMIT 1',
            [GASTRONOMY_SLUG]
        );
        const row = rows[0];
        if (!row) {
            throw new Error(`Gastronomy '${GASTRONOMY_SLUG}' not found — run e2e:seed first`);
        }
        gastronomyId = row.id;
        originalLinkedIn = row.social_networks?.linkedIn ?? null;
    });

    test.afterAll(async () => {
        // Restore the social_networks.linkedIn value to whatever it was before.
        if (originalLinkedIn === null) {
            // Remove the linkedIn key from the JSON.
            await execSQL(
                "UPDATE gastronomies SET social_networks = social_networks - 'linkedIn' WHERE slug = $1",
                [GASTRONOMY_SLUG]
            );
        } else {
            await execSQL(
                "UPDATE gastronomies SET social_networks = jsonb_set(COALESCE(social_networks, '{}'::jsonb), '{linkedIn}', $1::jsonb) WHERE slug = $2",
                [JSON.stringify(originalLinkedIn), GASTRONOMY_SLUG]
            );
        }
    });

    test('contact fieldset has no website input; social fieldset has linkedIn input', async ({
        page,
        context
    }) => {
        // ── Sign in as Julieta ───────────────────────────────────────────────
        const sessionCookie = await signInExistingUser(
            { email: JULIETA.email, password: JULIETA.password },
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );
        await authenticateContext(context, sessionCookie);

        // ── Open gastronomy editor ───────────────────────────────────────────
        await page.goto(`${WEB_URL}/es/mi-cuenta/comercio/gastronomy/${gastronomyId}/editar`, {
            waitUntil: 'load'
        });

        // Wait for the React island to hydrate: the type select is the earliest
        // reliably-visible React-controlled element.
        await expect(page.locator('#ce-type')).toBeVisible({ timeout: 15_000 });

        // ── AC-4 assertion 1: no website input in the contact fieldset ────────
        // CommerceListingEditor renders the contact fieldset with a legend
        // matching 'Información de contacto'. The ContactValues interface
        // intentionally omits 'website'. We check every possible label/aria
        // variant: aria-label, label text, and placeholder containing 'website'
        // or 'Sitio Web'.
        //
        // Using toHaveCount(0) (not .not.toBeVisible()) to avoid strict-mode
        // violations when the locator would match multiple elements.
        await expect(
            page.locator('input[aria-label*="website" i], input[aria-label*="sitio web" i]')
        ).toHaveCount(0);
        await expect(page.locator('input[placeholder*="website" i]')).toHaveCount(0);
        await expect(page.locator('label', { hasText: /sitio web/i })).toHaveCount(0);

        // ── AC-4 assertion 2: linkedIn input exists in the social fieldset ────
        // CommerceListingEditor renders each social key as an <input type="url"
        // aria-label={key}> where key is the SOCIAL_KEYS entry (e.g. 'linkedIn').
        const linkedInInput = page.locator('input[aria-label="linkedIn"]');
        await expect(linkedInInput).toBeVisible({ timeout: 10_000 });
        await expect(linkedInInput).toBeEditable({ timeout: 5_000 });
    });

    test('owner fills linkedIn in social section, PATCH succeeds, editor re-load shows persisted value', async ({
        page,
        context
    }) => {
        // ── Sign in as Julieta ───────────────────────────────────────────────
        const sessionCookie = await signInExistingUser(
            { email: JULIETA.email, password: JULIETA.password },
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );
        await authenticateContext(context, sessionCookie);

        // ── Open editor ──────────────────────────────────────────────────────
        await page.goto(`${WEB_URL}/es/mi-cuenta/comercio/gastronomy/${gastronomyId}/editar`, {
            waitUntil: 'load'
        });

        // Wait for React hydration.
        await expect(page.locator('#ce-type')).toBeVisible({ timeout: 15_000 });

        // Fill the linkedIn input using the React 19 helper.
        const linkedInInput = page.locator('input[aria-label="linkedIn"]');
        await expect(linkedInInput).toBeVisible({ timeout: 10_000 });
        await expect(linkedInInput).toBeEditable({ timeout: 5_000 });

        const newLinkedInUrl = `https://linkedin.com/company/e2e-test-${Date.now()}`;
        await setReactInputValue(linkedInInput, newLinkedInUrl);

        // Assert save button enabled (dirty.size > 0 after marking socialNetworks dirty).
        const saveButton = page.locator('button[type="submit"]', {
            hasText: /guardar cambios/i
        });
        await expect(saveButton).toBeEnabled({ timeout: 10_000 });

        // Wait for the PATCH response before asserting.
        const patchResponse = page.waitForResponse(
            (r) => /\/protected\/gastronomies\//.test(r.url()) && r.request().method() === 'PATCH',
            { timeout: 15_000 }
        );
        await saveButton.click({ force: true });
        const saved = await patchResponse;
        expect(saved.ok(), `PATCH failed: ${saved.status()} ${saved.url()}`).toBe(true);

        // ── Re-open editor: assert linkedIn input is pre-filled ──────────────
        await page.goto(`${WEB_URL}/es/mi-cuenta/comercio/gastronomy/${gastronomyId}/editar`, {
            waitUntil: 'load'
        });

        // Wait for hydration.
        await expect(page.locator('#ce-type')).toBeVisible({ timeout: 15_000 });

        const linkedInInputAfter = page.locator('input[aria-label="linkedIn"]');
        await expect(linkedInInputAfter).toBeVisible({ timeout: 10_000 });
        await expect(linkedInInputAfter).toHaveValue(newLinkedInUrl, { timeout: 10_000 });
    });
});
