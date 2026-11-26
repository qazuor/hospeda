/**
 * HOS-2495 — a venue owner in trial edits photos with the shared editor, capped
 * by the photo allowance the API enforces.
 *
 * Preconditions: the E2E stack (api/web on the dedicated ports, Postgres
 * :15433). No Cloudinary: photo rows are seeded with SQL, and the refused
 * upload is the gallery `addMedia` call, which step 7 refuses before any
 * provider is touched.
 *
 * Flow:
 *  1. The owner (live venue trial, cap 15) opens `fotos` with a cover and 15
 *     approved gallery photos: the cap line names 15, the gallery is full, the
 *     upload control is disabled, and nothing raw from the API is on screen.
 *  2. A 16th photo through the API is refused with 403 `LIMIT_REACHED`.
 *  3. With a 16th approved row present, its tile carries «No se muestra:
 *     superás tu tope» and the summary counts it. Moving it up pushes the 15th
 *     past the cap; after a reload the order persisted and the badge moved.
 *
 * Actor: a fresh owner account. Cleanup: the venue and the user.
 *
 * Tags: @p1 @verticals
 *
 * @see apps/web/src/components/host/editor/PhotoSection.client.tsx
 * @see apps/web/src/components/host/editor/photo-cap-view.ts
 * @see apps/api/src/utils/listing-access/photo-allowance.ts
 */

import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { VenueTypeEnum, VerticalEnum } from '@repo/schemas';
import {
    type CreatedUser,
    createUser,
    getAnyCityDestinationId,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { listingEditorUrl } from '../../fixtures/listing-editor-helpers.ts';
import { ensureListingOwnerTrial } from '../../fixtures/listing-owner-trial.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';

/** The venue trial cap (the lowest sellable venue plan, `venue-basico`). */
const TRIAL_CAP = 15;
const OVER_CAP_BADGE = 'No se muestra: superás tu tope';

interface VenueResponseBody {
    readonly data?: { readonly id?: string };
}

/** Creates a venue through the owner self-service route. */
async function createVenue({
    sessionCookie,
    name
}: {
    readonly sessionCookie: string;
    readonly name: string;
}): Promise<string> {
    const response = await fetch(`${API_URL}/api/v1/protected/venues`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify({
            name,
            summary: 'E2E fixture for the listing photo cap.',
            description:
                'A listing created by the HOS-2495 end-to-end fixture, long enough for the create schema.',
            type: VenueTypeEnum.RESTAURANT,
            destinationId: await getAnyCityDestinationId()
        })
    });
    if (response.status !== 201) {
        throw new Error(`createVenue failed: ${response.status} — ${await response.text()}`);
    }
    const id = ((await response.json()) as VenueResponseBody).data?.id;
    if (!id) throw new Error('createVenue: response carried no id');
    return id;
}

/** Inserts one approved, visible photo row. */
async function seedPhoto({
    venueId,
    index,
    isFeatured = false
}: {
    readonly venueId: string;
    readonly index: number;
    readonly isFeatured?: boolean;
}): Promise<string> {
    const [row] = await execSQL<{ id: string }>(
        `INSERT INTO venue_media
             (venue_id, url, public_id, alt, is_featured, sort_order, state, moderation_state)
         VALUES ($1, $2, $3, $4, $5, $6, 'visible', 'APPROVED')
         RETURNING id`,
        [
            venueId,
            `https://res.cloudinary.com/demo/image/upload/sample.jpg?e2e=${index}`,
            `hospeda/e2e/hos2495/${venueId}/${index}`,
            `Foto ${index}`,
            isFeatured,
            index
        ]
    );
    if (!row) throw new Error('seedPhoto: no row returned');
    return row.id;
}

/** Injects the sign-in session cookie into the Playwright context. */
async function authenticateContext(context: BrowserContext, sessionCookie: string): Promise<void> {
    await context.addCookies(
        sessionCookie.split('; ').map((part) => {
            const eqIdx = part.indexOf('=');
            return {
                name: eqIdx === -1 ? part.trim() : part.slice(0, eqIdx).trim(),
                value: eqIdx === -1 ? '' : part.slice(eqIdx + 1),
                url: WEB_URL
            };
        })
    );
}

/** Opens the photos page and waits until the allowance answered. */
async function openPhotos(page: Page, venueId: string): Promise<void> {
    await page.goto(
        listingEditorUrl({
            webUrl: WEB_URL,
            vertical: 'venue',
            listingId: venueId,
            section: 'fotos'
        }),
        {
            waitUntil: 'domcontentloaded'
        }
    );
    await expect(
        page.getByText(`Subí hasta ${TRIAL_CAP} fotos de tu ficha de Comer y salir.`)
    ).toBeVisible({
        timeout: 20_000
    });
}

/** Ids of the gallery tiles carrying the over-cap badge, in display order. */
async function overCapTileIds(page: Page): Promise<string[]> {
    return page
        .locator('[data-sortable-id]')
        .filter({ has: page.getByTestId('photo-over-cap-badge') })
        .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-sortable-id') ?? ''));
}

test.describe('HOS-2495 listing photo cap @p1 @verticals', () => {
    test.describe.configure({ mode: 'serial' });

    let owner: CreatedUser;
    let venueId: string;
    const galleryIds: string[] = [];

    test.beforeAll(async () => {
        owner = await createUser({}, { apiBaseUrl: API_URL, webBaseUrl: WEB_URL });
        await markProfileCompleted({ userId: owner.id });
        await ensureListingOwnerTrial(getDbPool(), owner.id, VerticalEnum.VENUE);
        venueId = await createVenue({
            sessionCookie: owner.sessionCookie,
            name: `Fotos con tope ${Date.now()}`
        });
        await seedPhoto({ venueId, index: 0, isFeatured: true });
        for (let index = 1; index <= TRIAL_CAP; index += 1) {
            galleryIds.push(await seedPhoto({ venueId, index }));
        }
    });

    test.afterAll(async () => {
        if (venueId) await execSQL('DELETE FROM venues WHERE id = $1', [venueId]);
        if (owner) await cleanupTestUsers(getDbPool(), [owner.id]);
    });

    test.beforeEach(async ({ page, context }) => {
        await seedCookieConsent(page);
        await authenticateContext(context, owner.sessionCookie);
    });

    test('the allowance names the trial cap, and a full gallery stops uploads', async ({
        page
    }) => {
        const allowance = await fetch(
            `${API_URL}/api/v1/protected/venues/${venueId}/photo-allowance`,
            { headers: { cookie: owner.sessionCookie } }
        );
        expect(allowance.status).toBe(200);
        const body = (await allowance.json()) as {
            readonly data: { readonly status: string; readonly cap: number; readonly used: number };
        };
        expect(body.data).toMatchObject({ status: 'LIMITED', cap: TRIAL_CAP, used: TRIAL_CAP });

        await openPhotos(page, venueId);

        await expect(page.getByText(`Galería de fotos (máx. ${TRIAL_CAP})`)).toBeVisible();
        await expect(page.locator('[data-sortable-id]')).toHaveCount(TRIAL_CAP);
        await expect(page.getByText(/Límite de galería alcanzado/)).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Agregar fotos a la galería' })
        ).toBeDisabled();
        await expect(page.getByTestId('photo-over-cap-badge')).toHaveCount(0);
        const text = await page.locator('body').innerText();
        expect(text).not.toContain('Limit reached');
        expect(text).not.toContain('Entitlement required');
    });

    test('a photo beyond the cap is refused by the API with LIMIT_REACHED', async () => {
        const response = await fetch(`${API_URL}/api/v1/protected/venues/${venueId}/media`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: owner.sessionCookie },
            body: JSON.stringify({
                url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg?e2e=extra',
                publicId: `hospeda/e2e/hos2495/${venueId}/extra`
            })
        });
        expect(response.status).toBe(403);
        const body = (await response.json()) as { readonly error?: { readonly code?: string } };
        expect(body.error?.code).toBe('LIMIT_REACHED');
    });

    test('a photo past the cap is marked, and reordering moves the mark after a reload', async ({
        page
    }) => {
        const extraId = await seedPhoto({ venueId, index: TRIAL_CAP + 1 });
        const lastInsideId = galleryIds.at(-1);
        await openPhotos(page, venueId);

        await expect.poll(() => overCapTileIds(page)).toEqual([extraId]);
        await expect(page.getByText(OVER_CAP_BADGE)).toHaveCount(1);
        await expect(page.getByTestId('photo-over-cap-summary')).toContainText(
            '1 foto no se muestra porque superás tu tope'
        );

        const reorder = page.waitForResponse(
            (response) =>
                response.url().includes(`/venues/${venueId}/media/reorder`) && response.ok()
        );
        await page
            .getByRole('button', { name: `Mover foto ${TRIAL_CAP + 1} hacia arriba` })
            .click();
        await reorder;
        await expect.poll(() => overCapTileIds(page)).toEqual([lastInsideId]);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByText(`Galería de fotos (máx. ${TRIAL_CAP})`)).toBeVisible({
            timeout: 20_000
        });
        await expect.poll(() => overCapTileIds(page)).toEqual([lastInsideId]);
        const [moved] = await execSQL<{ sort_order: number }>(
            'SELECT sort_order FROM venue_media WHERE id = $1',
            [extraId]
        );
        const [pushed] = await execSQL<{ sort_order: number }>(
            'SELECT sort_order FROM venue_media WHERE id = $1',
            [lastInsideId]
        );
        expect(moved?.sort_order).toBeLessThan(pushed?.sort_order ?? -1);
    });
});
