/**
 * AC:6:3 — removing `nightlife` drops the venue from the nightlife collection
 * (HOS-1871, leaf 6.11 part 2).
 *
 * The owner publishes a RESTAURANT that carries both business lines, then edits
 * it down to `food` through the protected owner PATCH. The assertion is the one
 * the AC states: the next uncached read of `/rubro/noche/` no longer lists the
 * venue, the food collection still does, and the detail page keeps answering
 * 200. The purge is read from `revalidation_log` (the built API writes it
 * synchronously when `scheduleRevalidation` runs) before the page is read again.
 *
 * `?destinationId=` makes the collection render non-cacheable
 * (`hasOnlyPaginationParams` is false), so this spec observes the real next
 * render instead of a CDN copy.
 *
 * Tags: @p0 @verticals @cache
 *
 * Preconditions:
 *   - The E2E seed provides the venue catalog and the trial floors.
 *   - The API writes `revalidation_log` through the NoOp adapter.
 *
 * @see apps/web/src/pages/[lang]/comer-y-salir/rubro/[rubro]/index.astro
 * @see packages/service-core/src/services/listing/listing-revalidation.ts
 * @see apps/e2e/fixtures/revalidation-spy.ts
 */

import { expect, test } from '@playwright/test';
import { businessLineToUrlSlug, VenueTypeEnum, VerticalEnum } from '@repo/schemas';
import { type CreatedUser, createUser, markProfileCompleted } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { ensureListingOwnerTrial } from '../../fixtures/listing-owner-trial.ts';
import {
    assertRevalidationTriggered,
    captureRevalidationCheckpoint
} from '../../fixtures/revalidation-spy.ts';
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

/**
 * Creates a CITY destination private to this spec, so `?destinationId=` scopes
 * the collection to the fixture and nothing else in the shared E2E database.
 */
async function createCityDestination({
    token
}: {
    readonly token: string;
}): Promise<{ readonly id: string }> {
    const slug = `e2e-${token.toLowerCase()}`;
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO destinations (
             destination_type, path, slug, name, summary, description, location
         ) VALUES (
             'CITY', $1, $2, $3, $4, $5, $6::jsonb
         ) RETURNING id`,
        [
            `/${slug}`,
            slug,
            `E2E city ${token}`,
            'E2E fixture destination for the business-line purge.',
            'A city created by the HOS-1871 end-to-end fixture.',
            JSON.stringify({
                state: 'Entre Ríos',
                country: 'Argentina',
                coordinates: { lat: '-30.7604', long: '-57.9859' }
            })
        ]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('createCityDestination: insert returned no id');
    return { id };
}

/** Creates a venue through the owner self-service route. */
async function createVenue({
    sessionCookie,
    destinationId,
    type,
    name
}: {
    readonly sessionCookie: string;
    readonly destinationId: string;
    readonly type: VenueTypeEnum;
    readonly name: string;
}): Promise<CreatedVenue> {
    const response = await fetch(`${API_URL}/api/v1/protected/venues`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify({
            name,
            summary: 'E2E fixture for the business-line purge.',
            description:
                'A listing created by the HOS-1871 end-to-end fixture, long enough for the create schema.',
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

test.describe('AC:6:3 removing nightlife drops the venue from the nightlife collection @p0 @verticals @cache', () => {
    const userIds: string[] = [];
    const venueIds: string[] = [];
    const destinationIds: string[] = [];

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
        for (const destinationId of destinationIds) {
            await execSQL('DELETE FROM destinations WHERE id = $1', [destinationId]);
        }
        destinationIds.length = 0;
    });

    test('the venue leaves the nightlife collection after the owner removes the line', async ({
        page
    }) => {
        test.setTimeout(180_000);

        // ── Setup: owner on a live trial, a RESTAURANT with both lines ─────
        const owner: CreatedUser = await createUser(
            {},
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );
        userIds.push(owner.id);
        await markProfileCompleted({ userId: owner.id });
        await ensureListingOwnerTrial(getDbPool(), owner.id, VerticalEnum.VENUE);

        const token = `HOS1871-${Date.now()}`;
        const name = `Resto bar ${token}`;
        const { id: destinationId } = await createCityDestination({ token });
        destinationIds.push(destinationId);

        const venue = await createVenue({
            sessionCookie: owner.sessionCookie,
            destinationId,
            type: VenueTypeEnum.RESTAURANT,
            name
        });
        venueIds.push(venue.id);

        await execSQL('UPDATE venues SET business_lines = $2::text[] WHERE id = $1', [
            venue.id,
            ['food', 'nightlife']
        ]);
        await execSQL("UPDATE venues SET publication_status = 'PUBLISHED' WHERE id = $1", [
            venue.id
        ]);

        const nightlifeSlug = businessLineToUrlSlug({ value: 'nightlife' }).urlSlug;
        const foodSlug = businessLineToUrlSlug({ value: 'food' }).urlSlug;
        const scoped = (path: string): string =>
            `${WEB_URL}${path}?destinationId=${encodeURIComponent(destinationId)}`;
        const nightlifeUrl = scoped(`/es/comer-y-salir/rubro/${nightlifeSlug}/`);
        const foodUrl = scoped(`/es/comer-y-salir/rubro/${foodSlug}/`);
        const detailUrl = `${WEB_URL}/es/comer-y-salir/${venue.slug}/`;

        // ── Before: the nightlife collection lists the venue ───────────────
        const before = await page.goto(nightlifeUrl, { waitUntil: 'domcontentloaded' });
        expect(before?.status(), `GET ${nightlifeUrl}`).toBe(200);
        await expect(page.locator('body')).toContainText(name);

        // ── Act: the owner removes the nightlife line ─────────────────────
        const since = captureRevalidationCheckpoint();
        const patch = await fetch(`${API_URL}/api/v1/protected/venues/${venue.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', cookie: owner.sessionCookie },
            body: JSON.stringify({ businessLines: ['food'] })
        });
        expect(patch.status, 'owner PATCH must succeed').toBe(200);

        // The purge must address the collection and both venue tags before the
        // next read can be trusted.
        await assertRevalidationTriggered({
            since,
            entityType: 'venue',
            entityId: venue.id,
            targets: ['list-venue', `venue-${venue.slug}`],
            timeoutMs: 20_000
        });

        // ── After: gone from nightlife, still in food, detail intact ──────
        const nightlifeAfter = await page.goto(nightlifeUrl, { waitUntil: 'domcontentloaded' });
        expect(nightlifeAfter?.status(), `GET ${nightlifeUrl}`).toBe(200);
        await expect(page.locator('body')).not.toContainText(name);

        const foodAfter = await page.goto(foodUrl, { waitUntil: 'domcontentloaded' });
        expect(foodAfter?.status(), `GET ${foodUrl}`).toBe(200);
        await expect(page.locator('body')).toContainText(name);

        const detail = await page.goto(detailUrl, { waitUntil: 'domcontentloaded' });
        expect(detail?.status(), `GET ${detailUrl}`).toBe(200);
    });
});
