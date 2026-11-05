/**
 * LISTING-OWNER-06 — a `locked` section keeps its data read-only and an
 * `absent` section still resolves to the hub (HOS-1787 leaf 5.2, AC:5:2).
 *
 * Actors: fresh owners created per test. They intentionally get NO trial:
 * the venue BASE plan version carries no `manage_venue_menu` (migration 0144),
 * so a DRAFT venue's menu section resolves `locked`. The locked cases assert
 * that state through `GET /api/v1/protected/venues/:id/sections` before they
 * act, so a fixture that no longer resolves `locked` fails with a measurement
 * instead of silently passing.
 *
 * Tags: @p0 @listing-owner
 *
 * What the three cases prove:
 *  1. A BOLICHE has only the `nightlife` business line, so `menu` is `absent`
 *     from its registry and `…/editar/carta/` must land on the hub instead of
 *     rendering a section the listing does not have. (Leaf 5.1 already filters
 *     the registry; this is its end-to-end guard.)
 *  2. A RESTAURANT with `menu: locked` and dishes inserted by SQL shows them
 *     read-only, renders the upsell on first paint, and "Vaciar" sends the
 *     `delete` intent (`PUT` with an empty list) which answers 2xx and clears
 *     the rows.
 *  3. The same locked carta answers 403 `ENTITLEMENT_REQUIRED` to a `write`
 *     (a PUT carrying a dish): emptying is allowed, editing is not
 *     (DEC-FAC-041).
 *
 * The owners are never trial-enabled and never reused: the effective set is
 * cached per user, so flipping a plan mid-test would read a stale answer.
 *
 * @see packages/verticals/src/listing-sections/resolve-listing-sections.ts
 * @see apps/api/src/routes/venue/protected/putMenu.ts
 * @see apps/web/src/components/venue/VenueSectionLockedPanel.client.tsx
 */

import { type BrowserContext, expect, test } from '@playwright/test';
import {
    type CreatedUser,
    createUser,
    getAnyCityDestinationId
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { listingEditorUrl } from '../../fixtures/listing-editor-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

interface CreatedVenue {
    readonly id: string;
    readonly slug: string;
}

interface SectionsResponseBody {
    readonly data?: {
        readonly sections?: Readonly<Record<string, { readonly state?: string }>>;
    };
}

interface VenueResponseBody {
    readonly data?: { readonly id?: string; readonly slug?: string };
}

interface ErrorBody {
    readonly error?: { readonly code?: string };
}

// ---------------------------------------------------------------------------
// Helpers (local to this spec: the shared fixtures are owned by other leaves)
// ---------------------------------------------------------------------------

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

/**
 * Creates a venue through the owner self-service route, which ALSO grants the
 * account its VENUE_OWNER role in the same transaction. The listing is born
 * DRAFT and `businessLines` is left to the type's preselect (2.3).
 */
async function createVenue({
    sessionCookie,
    type,
    name
}: {
    readonly sessionCookie: string;
    readonly type: 'RESTAURANT' | 'BOLICHE';
    readonly name: string;
}): Promise<CreatedVenue> {
    const destinationId = await getAnyCityDestinationId();
    const response = await fetch(`${API_URL}/api/v1/protected/venues`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify({
            name,
            summary: 'E2E fixture for the locked/absent editor sections.',
            description:
                'A listing created by the HOS-1854 end-to-end fixture, long enough for the create schema.',
            type,
            // The owner schema keeps it optional, but the route re-parses with
            // the admin schema, which requires it (see `create.ts`).
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
    if (!id || !slug) {
        throw new Error('createVenue: response carried no id/slug');
    }
    return { id, slug };
}

/** A fresh owner with no trial and a DRAFT venue of the requested type. */
async function createOwnerWithVenue({
    type,
    name
}: {
    readonly type: 'RESTAURANT' | 'BOLICHE';
    readonly name: string;
}): Promise<{ owner: CreatedUser; venue: CreatedVenue }> {
    const owner = await createUser({}, { apiBaseUrl: API_URL, webBaseUrl: WEB_URL });
    const venue = await createVenue({ sessionCookie: owner.sessionCookie, type, name });
    return { owner, venue };
}

/** Reads the owner's resolved section states, the way the editor page does. */
async function readSectionStates(
    venueId: string,
    sessionCookie: string
): Promise<Readonly<Record<string, { readonly state?: string }>>> {
    const response = await fetch(`${API_URL}/api/v1/protected/venues/${venueId}/sections`, {
        headers: { cookie: sessionCookie }
    });
    if (!response.ok) {
        throw new Error(`GET sections failed: ${response.status} — ${await response.text()}`);
    }
    const body = (await response.json()) as SectionsResponseBody;
    return body.data?.sections ?? {};
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('AC:5:2 owner sees absent sections go to the hub and locked sections read-only @p0 @listing-owner', () => {
    const userIds: string[] = [];
    const venueIds: string[] = [];

    test.afterEach(async () => {
        // `venue_menu_*` cascade from the venue; `cleanupTestUsers` does not
        // know about venues (its table list predates this vertical), so the
        // listing is removed first or the user delete would orphan it.
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

    test('an absent section slug lands on the hub', async ({ page, context }) => {
        test.setTimeout(60_000);

        // A BOLICHE's only business line is `nightlife`: `menu` is absent.
        const { owner, venue } = await createOwnerWithVenue({
            type: 'BOLICHE',
            name: `Boliche locked-absent ${Date.now()}`
        });
        userIds.push(owner.id);
        venueIds.push(venue.id);

        await authenticateContext(context, owner.sessionCookie);

        await page.goto(
            listingEditorUrl({
                webUrl: WEB_URL,
                vertical: 'venue',
                listingId: venue.id,
                section: 'carta'
            }),
            { waitUntil: 'domcontentloaded' }
        );

        // The hub is `…/editar/`; the absent slug must not render a page.
        await expect(page).toHaveURL(new RegExp(`/venue/${venue.id}/editar/?$`));
        await expect(page.locator('.editor-hub')).toBeVisible();
    });

    test('a locked carta with data is read-only, shows the upsell, and can be emptied', async ({
        page,
        context
    }) => {
        test.setTimeout(90_000);

        const { owner, venue } = await createOwnerWithVenue({
            type: 'RESTAURANT',
            name: `Restaurant locked menu ${Date.now()}`
        });
        userIds.push(owner.id);
        venueIds.push(venue.id);

        // Measurement the case depends on: a no-trial DRAFT venue's menu is
        // locked because the BASE venue plan carries no `manage_venue_menu`.
        const sections = await readSectionStates(venue.id, owner.sessionCookie);
        expect(
            sections.menu?.state,
            'fixture precondition: a no-trial DRAFT venue must resolve menu=locked'
        ).toBe('locked');

        // Dishes are inserted directly: the write they would otherwise need is
        // exactly the 403 this case is about.
        const sectionRows = await execSQL<{ id: string }>(
            `INSERT INTO venue_menu_sections (venue_id, name, display_order)
             VALUES ($1, $2, 0)
             RETURNING id`,
            [venue.id, 'Entradas']
        );
        const sectionId = sectionRows[0]?.id;
        if (!sectionId) throw new Error('menu section insert returned no id');

        await execSQL(
            `INSERT INTO venue_menu_items
                 (section_id, venue_id, name, description, price_cents, is_available, display_order)
             VALUES ($1, $2, $3, $4, $5, true, 0)`,
            [sectionId, venue.id, 'Empanadas', 'De carne cortada a cuchillo', 250_000]
        );

        await authenticateContext(context, owner.sessionCookie);

        await page.goto(
            listingEditorUrl({
                webUrl: WEB_URL,
                vertical: 'venue',
                listingId: venue.id,
                section: 'carta'
            }),
            { waitUntil: 'load' }
        );

        // The stored dish is on screen, but nothing is editable and there is
        // no Save button: this is the read-only half of DEC-FAC-025.
        await expect(page.getByText('Empanadas')).toBeVisible({ timeout: 20_000 });
        await expect(page.locator('#editor-menu input')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Guardar carta' })).toHaveCount(0);

        // Proactive upsell, present before any refusal could have produced it.
        await expect(page.getByTestId('venue-section-locked-notice')).toBeVisible();

        // Emptying is the one allowed write. The PUT body must be EMPTY — an
        // empty replacement classifies as `delete` (DEC-FAC-041).
        await page.getByTestId('venue-section-vaciar').click();
        const putResponsePromise = page.waitForResponse(
            (response) =>
                response.url().includes(`/api/v1/protected/venues/${venue.id}/menu`) &&
                response.request().method() === 'PUT'
        );
        await page.getByRole('dialog').getByRole('button', { name: 'Vaciar la sección' }).click();

        const putResponse = await putResponsePromise;
        expect(putResponse.status(), 'an empty PUT is a delete and must pass').toBe(200);

        const remaining = await execSQL<{ count: number }>(
            'SELECT count(*)::int AS count FROM venue_menu_items WHERE venue_id = $1',
            [venue.id]
        );
        expect(remaining[0]?.count ?? -1).toBe(0);
    });

    test('a write to a locked carta answers 403 ENTITLEMENT_REQUIRED', async ({
        page,
        context
    }) => {
        test.setTimeout(60_000);

        const { owner, venue } = await createOwnerWithVenue({
            type: 'RESTAURANT',
            name: `Restaurant locked refuse ${Date.now()}`
        });
        userIds.push(owner.id);
        venueIds.push(venue.id);

        const sections = await readSectionStates(venue.id, owner.sessionCookie);
        expect(
            sections.menu?.state,
            'fixture precondition: a no-trial DRAFT venue must resolve menu=locked'
        ).toBe('locked');

        await authenticateContext(context, owner.sessionCookie);

        // Requested from the page's own request context, with the owner's
        // session, exactly the shape the editor's Save would send.
        const response = await page.request.put(
            `${API_URL}/api/v1/protected/venues/${venue.id}/menu`,
            {
                data: {
                    sections: [{ name: 'Entradas', items: [{ name: 'Empanadas' }] }]
                },
                headers: { cookie: owner.sessionCookie }
            }
        );

        expect(response.status(), 'editing a locked section must be refused').toBe(403);
        const body = (await response.json()) as ErrorBody;
        expect(body.error?.code).toBe('ENTITLEMENT_REQUIRED');

        const rows = await execSQL<{ count: number }>(
            'SELECT count(*)::int AS count FROM venue_menu_items WHERE venue_id = $1',
            [venue.id]
        );
        expect(rows[0]?.count ?? -1).toBe(0);
    });
});
