/**
 * COMMERCE-01 — Commerce owner edits operational fields on both verticals
 * (gastronomy + experience) and changes are visible on the public ficha.
 *
 * Actors: gastro-owner-julieta@local.test (role COMMERCE_OWNER, seeded by
 *   @repo/seed example pipeline: gastronomies.seed + experiences.seed).
 * Tags: @p0 @commerce
 *
 * Preconditions:
 *   - e2e:seed has run (`pnpm --filter hospeda-e2e e2e:seed`).
 *   - Julieta's account (gastro-owner-julieta@local.test / Password123!)
 *     exists with role COMMERCE_OWNER and profileCompleted=true.
 *   - She owns PUBLIC/ACTIVE gastronomies:
 *       - la-parrilla-del-puerto (slug)
 *       - cafe-del-palacio       (slug)
 *   - She owns PUBLIC/ACTIVE experiences (same commerceOwnerId):
 *       - excursion-rio-uruguay-concepcion (slug)
 *       - alquiler-kayak-colon-termas      (slug)
 *       - guia-turistica-gualeguaychu-carnaval (slug, isPriceOnRequest=true)
 *   - Web and API servers are running (playwright.config webServer).
 *
 * What this test validates (SPEC-249 T-025 / SPEC-252 T-003):
 *  1. Julieta can sign in and reach /es/mi-cuenta/comercio/.
 *  2. The listing index shows ONLY her own entries (both verticals)
 *     and no listing owned by another COMMERCE_OWNER (rodrigo, valentina).
 *  3. She opens the gastronomy editor for "la-parrilla-del-puerto",
 *     changes the menuUrl field, saves; the new value is reflected on the
 *     public gastronomy ficha (/.../gastronomia/la-parrilla-del-puerto/).
 *  4. She opens the experience editor for "excursion-rio-uruguay-concepcion",
 *     edits the richDescription field, saves; the updated text is reflected
 *     on the public experience ficha (/.../experiencias/excursion-...).
 *  5. Both edits are driven through the real browser → CommerceListingEditor
 *     island → protected PATCH endpoint chain, exercising the full stack.
 *
 * @see SPEC-249 spec.md § Owner self-service web area
 * @see SPEC-252 spec.md § T-003 positive commerce-owner E2E
 * @see apps/web/src/pages/[lang]/mi-cuenta/comercio/index.astro
 * @see apps/web/src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar.astro
 * @see apps/web/src/components/commerce/CommerceListingEditor.client.tsx
 */

import { expect, test } from '@playwright/test';
import { signInExistingUser } from '../../fixtures/api-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

/** Known seeded commerce owner. Password is stable across all E2E runs. */
const JULIETA = {
    email: 'gastro-owner-julieta@local.test',
    password: 'Password123!'
} as const;

/**
 * Known slugs for Julieta's PUBLIC/ACTIVE listings (seeded by @repo/seed).
 * Slugs are stable identifiers that do not change between seed runs.
 */
const GASTRONOMY_SLUG = 'la-parrilla-del-puerto';
const EXPERIENCE_SLUG = 'excursion-rio-uruguay-concepcion';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Injects the session cookie returned from the Better Auth sign-in endpoint
 * into the Playwright browser context so subsequent navigations are
 * authenticated. Both cookies emitted by Better Auth
 * (`better-auth.session_token` and `better-auth.session_data`) must be
 * forwarded; `signInExistingUser` already handles the extraction.
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

test.describe('COMMERCE-01: commerce owner edits listings — both verticals @p0 @commerce', () => {
    /**
     * Tracks the gastronomy menuUrl value before the test so we can
     * restore it in afterEach (the seeded DB is shared; leaving a
     * test-value behind would break idempotency across re-runs without
     * a full reseed).
     */
    let originalMenuUrl: string | null = null;
    let originalRichDescription: string | null = null;

    test.afterEach(async () => {
        // Restore the gastronomy menuUrl to the seeded value.
        if (originalMenuUrl !== undefined) {
            await execSQL('UPDATE gastronomies SET menu_url = $1 WHERE slug = $2', [
                originalMenuUrl,
                GASTRONOMY_SLUG
            ]);
        }
        // Restore the experience richDescription to the seeded value.
        if (originalRichDescription !== undefined) {
            await execSQL('UPDATE experiences SET rich_description = $1 WHERE slug = $2', [
                originalRichDescription,
                EXPERIENCE_SLUG
            ]);
        }
        originalMenuUrl = null;
        originalRichDescription = null;
    });

    test('owner sees her listings, edits gastronomy menuUrl + experience richDescription, changes appear on public ficha', async ({
        page,
        context
    }) => {
        // ── Precondition: snapshot original seeded values ──────────────────────

        const gastronomyRows = await execSQL<{ id: string; menu_url: string | null }>(
            'SELECT id, menu_url FROM gastronomies WHERE slug = $1 LIMIT 1',
            [GASTRONOMY_SLUG]
        );
        const gastronomyId = gastronomyRows[0]?.id;
        if (!gastronomyId) {
            throw new Error(`Gastronomy '${GASTRONOMY_SLUG}' not found — run e2e:seed first`);
        }
        originalMenuUrl = gastronomyRows[0]?.menu_url ?? null;

        const experienceRows = await execSQL<{ id: string; rich_description: string | null }>(
            'SELECT id, rich_description FROM experiences WHERE slug = $1 LIMIT 1',
            [EXPERIENCE_SLUG]
        );
        const experienceId = experienceRows[0]?.id;
        if (!experienceId) {
            throw new Error(`Experience '${EXPERIENCE_SLUG}' not found — run e2e:seed first`);
        }
        originalRichDescription = experienceRows[0]?.rich_description ?? null;

        // ── Step 1: sign in as Julieta (COMMERCE_OWNER) ───────────────────────

        const sessionCookie = await signInExistingUser(
            { email: JULIETA.email, password: JULIETA.password },
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );
        await authenticateContext(context, sessionCookie);

        // ── Step 2: navigate to commerce listing index ─────────────────────────

        await page.goto(`${WEB_URL}/es/mi-cuenta/comercio/`, {
            waitUntil: 'domcontentloaded'
        });

        // The page must load without redirect (role guard accepts COMMERCE_OWNER).
        expect(page.url()).toContain('/mi-cuenta/comercio');

        // Her OWN listings appear in the index (the page renders listing.name in
        // .mc-list__name and the edit link href contains the listing ID).
        await expect(
            page.locator('.mc-list__name', { hasText: 'La Parrilla del Puerto' })
        ).toBeVisible();

        // The edit link for the gastronomy must be present in the DOM (href contains
        // the vertical segment + listing UUID).
        const gastronomyEditLink = page.locator(
            `a.mc-list__edit[href*="/gastronomy/${gastronomyId}/editar"]`
        );
        await expect(gastronomyEditLink).toBeVisible();

        // Experience listing also appears in the index.
        await expect(
            page.locator('.mc-list__name', { hasText: 'Excursión al Río Uruguay' })
        ).toBeVisible();

        const experienceEditLink = page.locator(
            `a.mc-list__edit[href*="/experience/${experienceId}/editar"]`
        );
        await expect(experienceEditLink).toBeVisible();

        // Listings owned by OTHER commerce owners must NOT appear.
        // La Cervecería del Río belongs to rodrigo (gastro-owner-rodrigo@local.test).
        await expect(
            page.locator('.mc-list__name', { hasText: 'La Cervecería del Río' })
        ).not.toBeVisible();

        // ── Step 3: edit gastronomy — change menuUrl ───────────────────────────

        const newMenuUrl = `https://e2e-test.example.com/menu-${Date.now()}`;

        await page.goto(`${WEB_URL}/es/mi-cuenta/comercio/gastronomy/${gastronomyId}/editar`, {
            waitUntil: 'domcontentloaded'
        });

        // The editor island is hydrated client:load — wait for the form to be visible.
        const editorForm = page.locator('form[aria-busy]');
        await expect(editorForm).toBeVisible();

        // The menuUrl input has id="ce-menuUrl" (set in CommerceListingEditor).
        const menuUrlInput = page.locator('#ce-menuUrl');
        await expect(menuUrlInput).toBeVisible();

        await menuUrlInput.clear();
        await menuUrlInput.fill(newMenuUrl);

        // The save button is enabled once a field is dirty.
        const saveButton = page.locator('button[type="submit"]', { hasText: /guardar cambios/i });
        await expect(saveButton).toBeEnabled();
        await saveButton.click();

        // Success feedback: an <output> element appears after the PATCH succeeds.
        await expect(page.locator('output')).toBeVisible({ timeout: 10_000 });

        // ── Step 3 assertion: public gastronomy ficha reflects new menuUrl ─────

        // GastronomyContactBlock.astro renders menuUrl as an anchor with class
        // gastro-contact__menu-btn. The page is SSR on-demand (prerender=false) so
        // a fresh navigation serves the current DB value.
        await page.goto(`${WEB_URL}/es/gastronomia/${GASTRONOMY_SLUG}/`, {
            waitUntil: 'domcontentloaded'
        });
        const menuLink = page.locator('a.gastro-contact__menu-btn');
        await expect(menuLink).toHaveAttribute('href', newMenuUrl);

        // ── Step 4: edit experience — change richDescription ──────────────────

        const newRichDescription = `E2E test update ${Date.now()}: tour description refreshed.`;

        await page.goto(`${WEB_URL}/es/mi-cuenta/comercio/experience/${experienceId}/editar`, {
            waitUntil: 'domcontentloaded'
        });

        // Wait for editor island hydration.
        await expect(page.locator('form[aria-busy]')).toBeVisible();

        // richDescription textarea has id="ce-richDescription".
        const richDescriptionTextarea = page.locator('#ce-richDescription');
        await expect(richDescriptionTextarea).toBeVisible();

        await richDescriptionTextarea.clear();
        await richDescriptionTextarea.fill(newRichDescription);

        const expSaveButton = page.locator('button[type="submit"]', {
            hasText: /guardar cambios/i
        });
        await expect(expSaveButton).toBeEnabled();
        await expSaveButton.click();

        await expect(page.locator('output')).toBeVisible({ timeout: 10_000 });

        // ── Step 4 assertion: public experience ficha reflects new description ─

        // ExperienceInfo.astro renders richDescription inside a div with class
        // exp-info__body (plain text) or exp-info__body--rich (rendered markdown).
        // We assert by text content of the containing element, locale-agnostic.
        await page.goto(`${WEB_URL}/es/experiencias/${EXPERIENCE_SLUG}/`, {
            waitUntil: 'domcontentloaded'
        });

        const expBody = page.locator('.exp-info__body');
        await expect(expBody).toContainText(newRichDescription);
    });
});
