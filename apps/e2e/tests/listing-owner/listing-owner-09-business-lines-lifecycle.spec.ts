/**
 * LISTING-OWNER-09 — the business-line lifecycle (HOS-1787 leaf 5.7).
 *
 * AC:5:4 — removing `nightlife` hides `nightInfo` (with a notice and its count)
 * before the save, the section slug lands on the hub, and re-adding the line
 * restores the stored values. A BOLICHE cannot uncheck its only line.
 *
 * AC:5:6 — an owner who removed `food` sees the carta summary on the hub, can
 * empty it (the `delete` intent), but cannot edit it: a `PUT` carrying a dish
 * answers 409 `SECTION_ABSENT`.
 *
 * Owners are fresh per test and trial-enabled so `nightInfo` and the carta are
 * `available` before the line is removed. The effective set is cached per
 * user, so every assertion that depends on the new selection reloads the page.
 *
 * Tags: @p0 @listing-owner
 *
 * @see packages/verticals/src/listing-sections/resolve-listing-sections.ts
 * @see apps/web/src/components/listing/editor/BusinessLinesField.client.tsx
 * @see apps/web/src/components/listing/HiddenByBusinessLinesSummary.client.tsx
 */

import { type BrowserContext, expect, test } from '@playwright/test';
import { VerticalEnum } from '@repo/schemas';
import {
    type CreatedUser,
    createUser,
    getAnyCityDestinationId,
    markProfileCompleted,
    refreshSession
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    listingEditorUrl,
    saveListingEditor,
    waitForListingEditorHydration
} from '../../fixtures/listing-editor-helpers.ts';
import { ensureListingOwnerTrial } from '../../fixtures/listing-owner-trial.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

interface CreatedVenue {
    readonly id: string;
    readonly slug: string;
}

interface VenueResponseBody {
    readonly data?: { readonly id?: string; readonly slug?: string };
}

/** Copies a Better Auth session cookie onto the Playwright browser context. */
async function authenticateContext(context: BrowserContext, sessionCookie: string): Promise<void> {
    const parsed = sessionCookie.split('; ').map((part) => {
        const eqIdx = part.indexOf('=');
        const name = eqIdx === -1 ? part.trim() : part.slice(0, eqIdx).trim();
        const value = eqIdx === -1 ? '' : part.slice(eqIdx + 1);
        return { name, value, url: WEB_URL };
    });
    await context.addCookies(parsed);
}

/** Creates a venue through the owner self-service route. */
async function createVenue({
    sessionCookie,
    type,
    name
}: {
    readonly sessionCookie: string;
    readonly type: 'BAR' | 'BOLICHE';
    readonly name: string;
}): Promise<CreatedVenue> {
    const destinationId = await getAnyCityDestinationId();
    const response = await fetch(`${API_URL}/api/v1/protected/venues`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify({
            name,
            summary: 'E2E fixture for the business-line lifecycle.',
            description:
                'A listing created by the HOS-1859 end-to-end fixture, long enough for the create schema.',
            type,
            destinationId
        })
    });
    if (response.status !== 201) {
        throw new Error(
            `createVenue failed: ${response.status} ${response.statusText} — ${await response.text()}`
        );
    }
    const body = (await response.json()) as VenueResponseBody;
    const id = body.data?.id;
    const slug = body.data?.slug;
    if (!id || !slug) throw new Error('createVenue: response carried no id/slug');
    return { id, slug };
}

/** A fresh, trial-enabled owner with one venue of the requested type. */
async function createOwnerWithVenue({
    type,
    name
}: {
    readonly type: 'BAR' | 'BOLICHE';
    readonly name: string;
}): Promise<{ owner: CreatedUser; sessionCookie: string; venue: CreatedVenue }> {
    const owner = await createUser({}, { apiBaseUrl: API_URL, webBaseUrl: WEB_URL });
    await markProfileCompleted({ userId: owner.id });
    const venue = await createVenue({ sessionCookie: owner.sessionCookie, type, name });
    await ensureListingOwnerTrial(getDbPool(), owner.id, VerticalEnum.VENUE);
    // The trial is written after sign-up; a fresh session is the reliable way to
    // see the plan in the editor (the effective set is cached per user).
    const sessionCookie = await refreshSession(owner, {
        apiBaseUrl: API_URL,
        webBaseUrl: WEB_URL
    });
    return { owner, sessionCookie, venue };
}

/** Seeds a nightInfo section with four non-empty fields. */
async function seedNightInfo(venueId: string): Promise<void> {
    await execSQL(
        `UPDATE venues
            SET entry_kind = 'paid',
                entry_note_i18n = $2::jsonb,
                entry_price_from = 500000,
                min_age = 18,
                dress_code = 'casual'
          WHERE id = $1`,
        [venueId, JSON.stringify({ es: 'Hasta las 2', en: '', pt: '' })]
    );
}

/** Seeds one course with one dish in the carta. */
async function seedMenu(venueId: string): Promise<void> {
    const sectionRows = await execSQL<{ id: string }>(
        `INSERT INTO venue_menu_sections (venue_id, name, display_order)
         VALUES ($1, $2, 0)
         RETURNING id`,
        [venueId, 'Entradas']
    );
    const sectionId = sectionRows[0]?.id;
    if (!sectionId) throw new Error('menu section insert returned no id');

    await execSQL(
        `INSERT INTO venue_menu_items
             (section_id, venue_id, name, description, price_cents, is_available, display_order)
         VALUES ($1, $2, $3, $4, $5, true, 0)`,
        [sectionId, venueId, 'Empanadas', 'De carne cortada a cuchillo', 250_000]
    );
}

test.describe('HOS-1859 business-line lifecycle @p0 @listing-owner', () => {
    const userIds: string[] = [];
    const venueIds: string[] = [];

    test.afterEach(async () => {
        for (const venueId of venueIds) {
            await execSQL('DELETE FROM venues WHERE id = $1', [venueId]);
        }
        venueIds.length = 0;
        if (userIds.length > 0) {
            await cleanupTestUsers(getDbPool(), userIds);
            userIds.length = 0;
        }
    });

    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test('AC:5:4 removing a business line hides its sections and re-adding restores them @p0 @listing-owner', async ({
        page,
        context
    }) => {
        test.setTimeout(120_000);

        const { owner, sessionCookie, venue } = await createOwnerWithVenue({
            type: 'BAR',
            name: `Bar business lines ${Date.now()}`
        });
        userIds.push(owner.id);
        venueIds.push(venue.id);
        await seedNightInfo(venue.id);
        await authenticateContext(context, sessionCookie);

        // ── Remove nightlife: the notice names nightInfo BEFORE the save ────
        await page.goto(
            listingEditorUrl({
                webUrl: WEB_URL,
                vertical: 'venue',
                listingId: venue.id,
                section: 'datos'
            }),
            { waitUntil: 'load' }
        );
        await waitForListingEditorHydration({ page });

        await expect(page.getByTestId('business-line-nightlife')).toBeChecked();
        await page.getByTestId('business-line-nightlife').uncheck();

        const notice = page.getByTestId('business-line-removal-notice');
        await expect(notice).toBeVisible({ timeout: 15_000 });
        await expect(notice).toContainText('Info para salir');
        await expect(notice).toContainText('5');

        const saveResponse = await saveListingEditor({
            page,
            pathPattern: /\/api\/v1\/protected\/venues\//
        });
        expect(saveResponse.status()).toBe(200);

        // ── The hidden section's slug now lands on the hub ────────────────
        await page.goto(
            listingEditorUrl({
                webUrl: WEB_URL,
                vertical: 'venue',
                listingId: venue.id,
                section: 'de-noche'
            }),
            { waitUntil: 'load' }
        );
        await expect(page).toHaveURL(new RegExp(`/venue/${venue.id}/editar/?$`));
        await expect(page.locator('.editor-hub')).toBeVisible();

        // ── Re-add nightlife: the stored values come back ─────────────────
        await page.goto(
            listingEditorUrl({
                webUrl: WEB_URL,
                vertical: 'venue',
                listingId: venue.id,
                section: 'datos'
            }),
            { waitUntil: 'load' }
        );
        await waitForListingEditorHydration({ page });
        await page.getByTestId('business-line-nightlife').check();

        const restoreResponse = await saveListingEditor({
            page,
            pathPattern: /\/api\/v1\/protected\/venues\//
        });
        expect(restoreResponse.status()).toBe(200);

        await page.goto(
            listingEditorUrl({
                webUrl: WEB_URL,
                vertical: 'venue',
                listingId: venue.id,
                section: 'de-noche'
            }),
            { waitUntil: 'load' }
        );
        await expect(page.getByLabel('Edad mínima')).toHaveValue('18', { timeout: 20_000 });

        // ── A BOLICHE cannot uncheck its only line ────────────────────────
        const boliche = await createOwnerWithVenue({
            type: 'BOLICHE',
            name: `Boliche business lines ${Date.now()}`
        });
        userIds.push(boliche.owner.id);
        venueIds.push(boliche.venue.id);
        await authenticateContext(context, boliche.sessionCookie);

        await page.goto(
            listingEditorUrl({
                webUrl: WEB_URL,
                vertical: 'venue',
                listingId: boliche.venue.id,
                section: 'datos'
            }),
            { waitUntil: 'load' }
        );
        await waitForListingEditorHydration({ page });
        await expect(page.getByTestId('business-line-nightlife')).toBeDisabled();
    });

    test('AC:5:6 owner who removed food sees the menu summary and can empty it but not edit it @p0 @listing-owner', async ({
        page,
        context
    }) => {
        test.setTimeout(120_000);

        const { owner, sessionCookie, venue } = await createOwnerWithVenue({
            type: 'BAR',
            name: `Bar hidden menu ${Date.now()}`
        });
        userIds.push(owner.id);
        venueIds.push(venue.id);
        await seedMenu(venue.id);
        await authenticateContext(context, sessionCookie);

        // ── Remove food ───────────────────────────────────────────────────
        await page.goto(
            listingEditorUrl({
                webUrl: WEB_URL,
                vertical: 'venue',
                listingId: venue.id,
                section: 'datos'
            }),
            { waitUntil: 'load' }
        );
        await waitForListingEditorHydration({ page });
        await page.getByTestId('business-line-food').uncheck();

        const saveResponse = await saveListingEditor({
            page,
            pathPattern: /\/api\/v1\/protected\/venues\//
        });
        expect(saveResponse.status()).toBe(200);

        // ── The hub shows the saved-but-hidden carta with its count ────────
        await page.goto(
            listingEditorUrl({
                webUrl: WEB_URL,
                vertical: 'venue',
                listingId: venue.id,
                section: 'hub'
            }),
            { waitUntil: 'load' }
        );
        const summary = page.getByTestId('hidden-by-business-lines');
        await expect(summary).toBeVisible({ timeout: 15_000 });
        await expect(summary).toContainText('Carta');
        await expect(summary).toContainText('1');

        // ── The carta's slug lands on the hub instead of the editor ────────
        await page.goto(
            listingEditorUrl({
                webUrl: WEB_URL,
                vertical: 'venue',
                listingId: venue.id,
                section: 'carta'
            }),
            { waitUntil: 'load' }
        );
        await expect(page).toHaveURL(new RegExp(`/venue/${venue.id}/editar/?$`));

        // ── "Vaciar" empties the section through the delete intent ────────
        await page.goto(
            listingEditorUrl({
                webUrl: WEB_URL,
                vertical: 'venue',
                listingId: venue.id,
                section: 'hub'
            }),
            { waitUntil: 'load' }
        );
        await page.getByTestId('hidden-section-vaciar-menu').click();
        const clearResponsePromise = page.waitForResponse(
            (response) =>
                response.url().includes(`/api/v1/protected/venues/${venue.id}/menu`) &&
                response.request().method() === 'PUT'
        );
        await page.getByRole('dialog').getByRole('button', { name: 'Vaciar la sección' }).click();
        expect((await clearResponsePromise).status()).toBe(200);

        const remaining = await execSQL<{ count: number }>(
            'SELECT count(*)::int AS count FROM venue_menu_items WHERE venue_id = $1',
            [venue.id]
        );
        expect(remaining[0]?.count ?? -1).toBe(0);

        // ── Editing a hidden section is still refused ─────────────────────
        const writeResponse = await page.request.put(
            `${API_URL}/api/v1/protected/venues/${venue.id}/menu`,
            {
                data: { sections: [{ name: 'Entradas', items: [{ name: 'Empanadas' }] }] },
                headers: { cookie: sessionCookie }
            }
        );
        expect(writeResponse.status()).toBe(409);
        const body = (await writeResponse.json()) as { error?: { reason?: string } };
        expect(body.error?.reason).toBe('SECTION_ABSENT');
    });
});
