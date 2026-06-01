/**
 * SPEC-172 — Amenity + Feature chip regression smoke test.
 *
 * Preconditions:
 *   - The target DB (HOSPEDA_E2E_DATABASE_URL) has at least one non-deleted
 *     accommodation linked to >= 1 amenity via r_accommodation_amenity. When
 *     none exists the test skips with an explicit reason (seed variance, not
 *     a failure).
 *   - The admin app (port 3000) and API (port 3001) are running against that
 *     same DB.
 *
 * Guards three regressions introduced by SPEC-172 (boolean SWITCH toggles →
 * multi-select chip / EntitySelectField fields):
 *
 *  1. Pre-population: the amenities chip region renders AT LEAST as many
 *     selected chips as the accommodation's amenity count in the junction
 *     table (the form hydrates the `amenityIds` field from the relation).
 *  2. i18n resolution: no chip label is the literal "[object Object]" — what
 *     leaks when resolveI18nText() is skipped and a raw I18nText JSONB object
 *     is coerced to a string.
 *  3. No boolean switches in the amenities section: the old hasWifi / hasPool
 *     / etc. SWITCH fields (which had no backing DB column) are gone.
 *
 * Tags: @p1 @admin @spec172 @chips @regression
 *
 * Selector strategy (verified against source — these components carry no
 * data-testid except the accordion, so most hooks are structural):
 *   - Accordion section header: `[data-testid="accordion-header-amenities"]`
 *     (SectionAccordion; the amenities section starts collapsed).
 *   - Accordion open panel: `[data-testid="accordion-panel-amenities"]`.
 *   - Amenities combobox trigger: `#field-amenityIds` (EntitySelectField
 *     builds `id={`field-${configId}`}`; the amenities field config id is
 *     `amenityIds`, in
 *     apps/admin/src/features/accommodations/config/sections/amenities.consolidated.ts).
 *   - Amenities field subtree: the `div.space-y-2` containing the combobox.
 *   - Chips: `div.flex.flex-wrap.gap-1 > div` within that subtree (chips are
 *     plain divs with a <span> label — NOT shadcn Badge / data-slot=badge).
 *
 * @see SPEC-172
 */

import { expect, test } from '@playwright/test';
import { forceVerifyEmail, setUserRole } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';

interface BrowserCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
}

/**
 * Creates a verified SUPER_ADMIN and returns its session cookies as
 * Playwright cookie objects.
 *
 * Better Auth is configured with `requireEmailVerification: true`, so sign-up
 * does NOT issue a session cookie. The working flow is: sign-up → verify email
 * (direct SQL) → promote role → sign-in (which DOES issue the session cookie).
 * State-changing auth routes enforce CSRF via the Origin header, so both
 * requests send a trusted Origin (the web base URL is in trustedOrigins).
 */
async function createAdminSession(): Promise<{
    userId: string;
    cookies: BrowserCookie[];
}> {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const email = `e2e-spec172-${suffix}@hospeda-test.local`;
    const password = `Test-${suffix}-Aa1!`;
    const authHeaders = { 'content-type': 'application/json', origin: WEB_URL };

    const signupRes = await fetch(`${API_URL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email, password, name: 'SPEC172 Admin' })
    });
    if (!signupRes.ok) {
        throw new Error(`sign-up failed: ${signupRes.status} — ${await signupRes.text()}`);
    }
    const signupData = (await signupRes.json()) as { user?: { id?: string } };
    const userId = signupData.user?.id;
    if (!userId) {
        throw new Error('sign-up response missing user id');
    }

    await forceVerifyEmail(userId);
    await setUserRole(userId, 'SUPER_ADMIN');

    const signinRes = await fetch(`${API_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email, password })
    });
    if (!signinRes.ok) {
        throw new Error(`sign-in failed: ${signinRes.status} — ${await signinRes.text()}`);
    }

    // undici exposes each Set-Cookie separately via getSetCookie(); take the
    // `name=value` head of every better-auth cookie and attach it to localhost.
    const setCookies = signinRes.headers.getSetCookie();
    const cookies = setCookies
        .map((raw) => raw.split(';')[0]?.trim() ?? '')
        .filter((head) => head.startsWith('better-auth') && head.includes('='))
        .map((head) => {
            const eqIdx = head.indexOf('=');
            return {
                name: head.slice(0, eqIdx).trim(),
                value: head.slice(eqIdx + 1).trim(),
                domain: 'localhost',
                path: '/'
            };
        });
    if (cookies.length === 0) {
        throw new Error('sign-in did not return a better-auth session cookie');
    }

    return { userId, cookies };
}

/** EntitySelectField trigger id for the amenities field (config id `amenityIds`). */
const AMENITY_COMBOBOX_ID = 'field-amenityIds';

/** Accordion section id for the amenities/features card. */
const AMENITIES_SECTION_ID = 'amenities';

interface AccommodationAmenityRow extends Record<string, unknown> {
    accommodation_id: string;
    amenity_count: string; // pg returns COUNT() as a string
}

/**
 * Returns the id + amenity count of the accommodation with the most linked
 * amenities (data-richest row), or null when the seed has none.
 */
async function findAccommodationWithAmenities(): Promise<{
    id: string;
    amenityCount: number;
} | null> {
    const rows = await execSQL<AccommodationAmenityRow>(
        `SELECT raa.accommodation_id, COUNT(raa.amenity_id)::text AS amenity_count
         FROM r_accommodation_amenity raa
         INNER JOIN accommodations a
             ON a.id = raa.accommodation_id AND a.deleted_at IS NULL
         GROUP BY raa.accommodation_id
         HAVING COUNT(raa.amenity_id) >= 1
         ORDER BY COUNT(raa.amenity_id) DESC
         LIMIT 1`
    );
    const row = rows[0];
    if (!row) {
        return null;
    }
    return { id: row.accommodation_id, amenityCount: Number(row.amenity_count) };
}

test.describe('SPEC-172: amenity & feature chips smoke @p1 @admin @spec172 @chips @regression', () => {
    const userIdsToCleanup: string[] = [];

    test.afterEach(async () => {
        if (userIdsToCleanup.length > 0) {
            await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
            userIdsToCleanup.length = 0;
        }
    });

    test('amenity chips pre-populate, labels are human-readable, no boolean switches remain', async ({
        page
    }) => {
        // ── Arrange: resolve a target accommodation that has amenities ─────
        const target = await findAccommodationWithAmenities();
        test.skip(
            target === null,
            'No accommodation with amenities in the target DB — run the seed to populate amenity relations'
        );
        if (target === null) {
            return; // narrows the type; test.skip already aborted above
        }

        // ── Arrange: a verified SUPER_ADMIN session ───────────────────────
        const { userId, cookies } = await createAdminSession();
        userIdsToCleanup.push(userId);

        // Inject the session cookie(s) so the admin app (same localhost host)
        // recognises the actor.
        await page.context().addCookies(cookies);

        // ── Act: open the edit page and expand the amenities section ───────
        // The edit form is a SectionAccordion; the amenities section is not
        // first, so it starts collapsed and must be expanded by clicking its
        // header before the combobox + chips are visible.
        await page.goto(`${ADMIN_URL}/accommodations/${target.id}/edit`);
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(new RegExp(`/${target.id}/edit`), { timeout: 30_000 });

        await page.getByTestId(`accordion-header-${AMENITIES_SECTION_ID}`).click();

        const amenityCombobox = page.locator(`#${AMENITY_COMBOBOX_ID}`);
        await expect(amenityCombobox).toBeVisible({ timeout: 20_000 });

        // Scope to the amenities EntitySelectField subtree (the div.space-y-2
        // that contains the combobox) to avoid catching the sibling features
        // field's chips.
        const amenityField = page.locator('div.space-y-2', { has: amenityCombobox });
        const amenityChips = amenityField.locator('div.flex.flex-wrap.gap-1 > div');

        // Wait for pre-population to finish (chips hydrate async via loadByIdsFn).
        await expect(amenityChips.first()).toBeVisible({ timeout: 15_000 });

        // ── Assert 1: chip count >= seeded amenity count (pre-population) ──
        const renderedChipCount = await amenityChips.count();
        expect(
            renderedChipCount,
            `expected >= ${target.amenityCount} amenity chip(s) from pre-population, got ${renderedChipCount}`
        ).toBeGreaterThanOrEqual(target.amenityCount);

        // ── Assert 2: no "[object Object]" anywhere (i18n resolution) ──────
        const bodyText = (await page.textContent('body')) ?? '';
        expect(
            bodyText,
            'Found "[object Object]" in the page — amenity/feature i18n name resolution broke'
        ).not.toContain('[object Object]');

        // ── Assert 3: no vestigial boolean SWITCH fields in the section ────
        // shadcn Switch renders role="switch". After SPEC-172 the amenities
        // panel holds only the amenityIds + featureIds entity-select fields.
        const amenitiesPanel = page.getByTestId(`accordion-panel-${AMENITIES_SECTION_ID}`);
        const switchCount = await amenitiesPanel.locator('[role="switch"]').count();
        expect(
            switchCount,
            `Found ${switchCount} [role="switch"] in the amenities panel — vestigial boolean toggles must be gone`
        ).toBe(0);

        // ── Assert 4 (secondary): combobox is searchable ──────────────────
        // The popover renders a shadcn Command whose search input carries
        // data-slot="command-input" (cmdk also injects a `cmdk-input` attr at
        // runtime; the data-slot is the stable, source-defined hook).
        await amenityCombobox.click();
        await expect(page.locator('[data-slot="command-input"]')).toBeVisible({
            timeout: 5_000
        });
        await page.keyboard.press('Escape');
    });
});
