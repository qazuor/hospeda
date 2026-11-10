/**
 * AC:6:10 — the venue review form offers each review dimension only while its
 * bound section is not `absent`, and the venue page hides a voted dimension
 * whose section became `absent` (HOS-1866 / 6.6, DEC-FAC-065 / DEC-FAC-072).
 *
 * Flow:
 *  1. A BOLICHE's dialog offers Servicio / Ambiente / Relación precio-calidad
 *     and NOT Comida; a RESTAURANT's dialog also offers Comida.
 *  2. Voting only Servicio in the RESTAURANT sends `rating: { service: 4 }`
 *     and nothing else (the body shape is the contract).
 *  3. With a persisted aggregate containing `food` in BOTH venues, the
 *     RESTAURANT page shows Comida + Servicio (not Ambiente, which has no
 *     votes) while the BOLICHE page shows Servicio and NOT Comida, because the
 *     API withholds a dimension bound to an `absent` section.
 *
 * The fixtures are created through the real owner self-service route and
 * published with SQL, like `venue-detail-jsonld-by-type.spec.ts`.
 *
 * Tags: @p0 @verticals
 *
 * @see apps/web/src/components/venue/VenueReviewDimensionFields.client.tsx
 * @see apps/web/src/lib/venue/review-dimensions-view.ts
 * @see apps/api/src/utils/public-listing-projector.ts
 */

import type { BrowserContext, Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { VenueTypeEnum, VerticalEnum } from '@repo/schemas';
import {
    type CreatedUser,
    createUser,
    getAnyCityDestinationId,
    markProfileCompleted,
    signInExistingUser
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { ensureListingOwnerTrial } from '../../fixtures/listing-owner-trial.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';

const DIMENSION_LABELS = {
    food: 'Comida',
    service: 'Servicio',
    ambiance: 'Ambiente',
    value: 'Relación precio-calidad'
} as const;

interface CreatedVenue {
    readonly id: string;
    readonly slug: string;
}

interface VenueResponseBody {
    readonly data?: { readonly id?: string; readonly slug?: string };
}

/** Creates a venue through the owner self-service route. */
async function createVenue({
    sessionCookie,
    type,
    name
}: {
    readonly sessionCookie: string;
    readonly type: VenueTypeEnum;
    readonly name: string;
}): Promise<CreatedVenue> {
    const destinationId = await getAnyCityDestinationId();
    const response = await fetch(`${API_URL}/api/v1/protected/venues`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify({
            name,
            summary: 'E2E fixture for the venue review dimensions.',
            description:
                'A listing created by the HOS-1866 end-to-end fixture, long enough for the create schema.',
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

/** Publishes a venue (the public read answers only PUBLISHED, HOS-1641). */
async function publishVenue(venueId: string): Promise<void> {
    await execSQL(`UPDATE venues SET publication_status = 'PUBLISHED' WHERE id = $1`, [venueId]);
}

/** Writes a persisted dimension aggregate, as the recompute job would. */
async function seedRatingAggregate(venueId: string): Promise<void> {
    await execSQL(
        `UPDATE venues
         SET rating = $2::jsonb, reviews_count = 2, average_rating = 4
         WHERE id = $1`,
        [
            venueId,
            JSON.stringify({
                food: { average: 5, count: 1 },
                service: { average: 4, count: 2 }
            })
        ]
    );
}

/** Injects the sign-in session cookie into the Playwright context. */
async function authenticateContext(context: BrowserContext, sessionCookie: string): Promise<void> {
    const parsed = sessionCookie.split('; ').map((part) => {
        const eqIdx = part.indexOf('=');
        const name = eqIdx === -1 ? part.trim() : part.slice(0, eqIdx).trim();
        const value = eqIdx === -1 ? '' : part.slice(eqIdx + 1);
        return { name, value, url: WEB_URL };
    });
    await context.addCookies(parsed);
}

/** Opens the review dialog of a published venue and returns the dialog. */
async function openReviewDialog(page: Page, venue: CreatedVenue): Promise<Locator> {
    // Cache-bust the detail page so a previous navigation in the same worker
    // cannot serve a stale aggregate through the browser cache.
    await page.goto(`${WEB_URL}/es/comer-y-salir/${venue.slug}/?e2e=${Date.now()}`, {
        waitUntil: 'domcontentloaded'
    });

    // The island is client:visible and resolves the session client-side: scroll
    // it into view and wait for the authenticated CTA to appear.
    await page.locator('.venue-detail__review-form').scrollIntoViewIfNeeded();
    const trigger = page.getByRole('button', { name: 'Dejar reseña' });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    return dialog;
}

/** Tap one star of one dimension row inside the review dialog. */
async function voteDimension(
    dialog: Locator,
    dimension: keyof typeof DIMENSION_LABELS,
    star: number
): Promise<void> {
    await dialog
        .getByRole('radiogroup', { name: DIMENSION_LABELS[dimension] })
        .getByRole('radio', { name: `${star}` })
        .click();
}

test.describe('AC:6:10 review form dimensions follow the listing sections @p0 @verticals', () => {
    const userIds: string[] = [];
    const venueIds: string[] = [];

    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test.afterAll(async () => {
        for (const venueId of venueIds) {
            await execSQL('DELETE FROM venues WHERE id = $1', [venueId]);
        }
        venueIds.length = 0;
        if (userIds.length > 0) {
            await cleanupTestUsers(getDbPool(), userIds);
            userIds.length = 0;
        }
    });

    test('the BOLICHE form omits Comida and the RESTAURANT form offers it', async ({
        page,
        context
    }) => {
        test.setTimeout(120_000);

        const owner: CreatedUser = await createUser(
            {},
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );
        userIds.push(owner.id);
        await markProfileCompleted({ userId: owner.id });
        await ensureListingOwnerTrial(getDbPool(), owner.id, VerticalEnum.VENUE);

        const reviewer = await createUser();
        userIds.push(reviewer.id);
        await markProfileCompleted({ userId: reviewer.id });
        const reviewerCookie = await signInExistingUser(
            { email: reviewer.email, password: reviewer.password },
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );

        const suffix = Date.now();
        const boliche = await createVenue({
            sessionCookie: owner.sessionCookie,
            type: VenueTypeEnum.BOLICHE,
            name: `Boliche reseñas ${suffix}`
        });
        venueIds.push(boliche.id);
        await publishVenue(boliche.id);

        const restaurant = await createVenue({
            sessionCookie: owner.sessionCookie,
            type: VenueTypeEnum.RESTAURANT,
            name: `Restaurante reseñas ${suffix}`
        });
        venueIds.push(restaurant.id);
        await publishVenue(restaurant.id);

        await authenticateContext(context, reviewerCookie);

        // ── 1. Offered dimensions follow the section map ────────────────────
        const bolicheDialog = await openReviewDialog(page, boliche);
        await expect(
            bolicheDialog.getByRole('radiogroup', { name: DIMENSION_LABELS.service })
        ).toBeVisible();
        await expect(
            bolicheDialog.getByRole('radiogroup', { name: DIMENSION_LABELS.ambiance })
        ).toBeVisible();
        await expect(
            bolicheDialog.getByRole('radiogroup', { name: DIMENSION_LABELS.value })
        ).toBeVisible();
        await expect(
            bolicheDialog.getByRole('radiogroup', { name: DIMENSION_LABELS.food })
        ).toHaveCount(0);

        const restaurantDialog = await openReviewDialog(page, restaurant);
        for (const dimension of ['food', 'service', 'ambiance', 'value'] as const) {
            await expect(
                restaurantDialog.getByRole('radiogroup', { name: DIMENSION_LABELS[dimension] })
            ).toBeVisible();
        }

        // ── 2. Only the voted dimension travels in `rating` ─────────────────
        await restaurantDialog
            .getByRole('radiogroup', { name: /calificación general/i })
            .getByRole('radio', { name: '5' })
            .click();
        await voteDimension(restaurantDialog, 'service', 4);

        const postRequest = page.waitForRequest(
            (request) =>
                request.method() === 'POST' &&
                request.url().includes(`/venues/${restaurant.id}/reviews`)
        );
        await restaurantDialog.getByRole('button', { name: 'Enviar reseña' }).click();
        const request = await postRequest;

        expect(request.postDataJSON()).toEqual({
            overallRating: 5,
            rating: { service: 4 }
        });
        expect((await request.response())?.status()).toBe(201);

        // ── 3. The page hides a voted dimension whose section is absent ─────
        await seedRatingAggregate(restaurant.id);
        await seedRatingAggregate(boliche.id);

        await page.goto(`${WEB_URL}/es/comer-y-salir/${restaurant.slug}/?e2e=${Date.now()}`, {
            waitUntil: 'domcontentloaded'
        });
        const restaurantAverages = page.locator('.venue-detail__dimension-averages');
        await expect(restaurantAverages).toBeVisible();
        await expect(restaurantAverages).toContainText(DIMENSION_LABELS.food);
        await expect(restaurantAverages).toContainText(DIMENSION_LABELS.service);
        await expect(restaurantAverages).not.toContainText(DIMENSION_LABELS.ambiance);

        await page.goto(`${WEB_URL}/es/comer-y-salir/${boliche.slug}/?e2e=${Date.now()}`, {
            waitUntil: 'domcontentloaded'
        });
        const bolicheAverages = page.locator('.venue-detail__dimension-averages');
        await expect(bolicheAverages).toBeVisible();
        await expect(bolicheAverages).toContainText(DIMENSION_LABELS.service);
        await expect(bolicheAverages).not.toContainText(DIMENSION_LABELS.food);
    });
});
