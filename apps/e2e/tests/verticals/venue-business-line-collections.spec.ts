/**
 * AC:6:1 — venue business-line collections list venues by line and paginate
 * (HOS-1787 leaf 6.8).
 *
 * Three fixtures share one owner: a RESTAURANT carrying both lines (the
 * resto-bar), a BOLICHE (nightlife only) and a CAFE (food only). They are
 * created in a dedicated CITY destination built for this spec, and every case
 * scopes the listing to that destination (`?destinationId=<uuid>`), so the
 * shared E2E database's other published venues cannot leak into the assertions.
 *
 * `destinationId` is the filter this surface actually applies: both the general
 * listing and the collection read it from the query string and forward it to the
 * public venue API. `q` and `ownerId` are deliberately NOT used here — the pages
 * never read `ownerId`, and `q` is dropped by `buildWhereClause` because it is
 * not a venue column.
 *
 * Tags: @p0 @verticals
 *
 * @see apps/web/src/pages/[lang]/comer-y-salir/index.astro
 * @see apps/web/src/pages/[lang]/comer-y-salir/rubro/[rubro]/index.astro
 * @see packages/db/src/utils/drizzle-helpers.ts (buildWhereClause)
 * @see packages/schemas/src/catalog/business-lines.ts
 */

import { expect, type Page, test } from '@playwright/test';
import { businessLineToUrlSlug, VenueTypeEnum, VerticalEnum } from '@repo/schemas';
import { type CreatedUser, createUser, markProfileCompleted } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
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

/**
 * Creates a CITY destination private to this spec, so `?destinationId=` scopes
 * the listing to the fixtures and nothing else in the shared E2E database.
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
            'E2E fixture destination for the venue business-line collections.',
            'A city created by the HOS-1868 end-to-end fixture.',
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
            summary: 'E2E fixture for the venue business-line collections.',
            description:
                'A listing created by the HOS-1868 end-to-end fixture, long enough for the create schema.',
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

/** Asserts the rendered listing contains every expected name and none of the absent ones. */
async function expectListing({
    page,
    url,
    present,
    absent
}: {
    readonly page: Page;
    readonly url: string;
    readonly present: readonly string[];
    readonly absent: readonly string[];
}): Promise<void> {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `GET ${url}`).toBe(200);

    const body = page.locator('body');
    for (const name of present) {
        await expect(body, `${url} must list ${name}`).toContainText(name);
    }
    for (const name of absent) {
        await expect(body, `${url} must NOT list ${name}`).not.toContainText(name);
    }
}

test.describe('AC:6:1 business-line collections list venues by line and paginate @p0 @verticals', () => {
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

    test('splits venues by business line and paginates each collection', async ({
        page,
        request
    }) => {
        test.setTimeout(180_000);

        const owner: CreatedUser = await createUser(
            {},
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );
        userIds.push(owner.id);
        await markProfileCompleted({ userId: owner.id });
        await ensureListingOwnerTrial(getDbPool(), owner.id, VerticalEnum.VENUE);

        const token = `HOS1868-${Date.now()}`;
        const { id: destinationId } = await createCityDestination({ token });
        destinationIds.push(destinationId);

        const restaBar = await createVenue({
            sessionCookie: owner.sessionCookie,
            destinationId,
            type: VenueTypeEnum.RESTAURANT,
            name: `Resto bar ${token}`
        });
        const boliche = await createVenue({
            sessionCookie: owner.sessionCookie,
            destinationId,
            type: VenueTypeEnum.BOLICHE,
            name: `Boliche ${token}`
        });
        const cafe = await createVenue({
            sessionCookie: owner.sessionCookie,
            destinationId,
            type: VenueTypeEnum.CAFE,
            name: `Cafe ${token}`
        });
        venueIds.push(restaBar.id, boliche.id, cafe.id);

        // The resto-bar is a RESTAURANT that also carries the nightlife line:
        // the CHECK constraint admits it (BUSINESS_LINE_RULES.venue).
        await execSQL('UPDATE venues SET business_lines = $2::text[] WHERE id = $1', [
            restaBar.id,
            ['food', 'nightlife']
        ]);
        await execSQL(
            `UPDATE venues SET publication_status = 'PUBLISHED' WHERE id = ANY($1::uuid[])`,
            [venueIds]
        );

        const foodSlug = businessLineToUrlSlug({ value: 'food' }).urlSlug;
        const nightlifeSlug = businessLineToUrlSlug({ value: 'nightlife' }).urlSlug;
        const foodPath = `/es/comer-y-salir/rubro/${foodSlug}/`;
        const nightlifePath = `/es/comer-y-salir/rubro/${nightlifeSlug}/`;

        const scoped = (path: string): string =>
            `${WEB_URL}${path}?destinationId=${encodeURIComponent(destinationId)}`;

        // ── Membership by line ────────────────────────────────────────────────
        await expectListing({
            page,
            url: scoped(foodPath),
            present: [restaBarName(token), cafeName(token)],
            absent: [bolicheName(token)]
        });
        await expectListing({
            page,
            url: scoped(nightlifePath),
            present: [restaBarName(token), bolicheName(token)],
            absent: [cafeName(token)]
        });
        await expectListing({
            page,
            url: scoped('/es/comer-y-salir/'),
            present: [restaBarName(token), bolicheName(token), cafeName(token)],
            absent: []
        });

        // ── Canonical: page 1 declares its own URL without /page/ ─────────────
        for (const path of [foodPath, nightlifePath]) {
            const response = await page.goto(`${WEB_URL}${path}`, {
                waitUntil: 'domcontentloaded'
            });
            expect(response?.status(), `GET ${path}`).toBe(200);
            const href = await page.locator('link[rel="canonical"]').first().getAttribute('href');
            expect(href, `${path}: canonical link`).not.toBeNull();
            expect(new URL(href as string, WEB_URL).pathname).toBe(path);
        }

        // ── /page/1/ folds into the canonical URL with a 301 ──────────────────
        const pageOne = await request.get(`${WEB_URL}${nightlifePath}page/1/`, {
            maxRedirects: 0
        });
        expect(pageOne.status()).toBe(301);
        const location = pageOne.headers().location;
        expect(location, '301 must carry a Location header').toBeTruthy();
        expect(new URL(location as string, WEB_URL).pathname).toBe(nightlifePath);

        // ── Out-of-range page and unknown line are hard 404s ──────────────────
        const outOfRange = await request.get(`${WEB_URL}${nightlifePath}page/9999/`, {
            maxRedirects: 0
        });
        expect(outOfRange.status()).toBe(404);

        const unknown = await request.get(`${WEB_URL}/es/comer-y-salir/rubro/inexistente/`, {
            maxRedirects: 0
        });
        expect(unknown.status()).toBe(404);
    });
});

function restaBarName(token: string): string {
    return `Resto bar ${token}`;
}

function bolicheName(token: string): string {
    return `Boliche ${token}`;
}

function cafeName(token: string): string {
    return `Cafe ${token}`;
}
