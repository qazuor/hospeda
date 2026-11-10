/**
 * AC:6:11 — venue collections only offer filters with published listings
 * (HOS-1787 leaf 6.10).
 *
 * The public filter options are computed over a WHOLE collection, not over one
 * destination, so the shared E2E database's other listings cannot be scoped
 * away with `?destinationId=`. Instead this spec creates its own tiny catalog —
 * one amenity and two features with a token-unique slug — and attaches them
 * only to its own fixtures. Every assertion names one of those ids, so it is
 * unaffected by whatever else is published.
 *
 * One owner publishes a BOLICHE (with amenity C1 and feature X1) and a CAFE
 * (with feature X2), each on the line its type preselects. The CHECK constraint
 * guarantees the resulting type split regardless of the shared database: a
 * BOLICHE can never be on the food line and a CAFE can never be on the night
 * line, so the chips of one collection can never offer the other's type.
 *
 * The business-line values and their URL slugs are derived from
 * `listPublicBusinessLines`; this spec writes no catalog value by hand.
 *
 * Tags: @p0 @verticals
 *
 * @see apps/web/src/pages/[lang]/comer-y-salir/rubro/[rubro]/index.astro
 * @see apps/web/src/pages/[lang]/comer-y-salir/index.astro
 * @see apps/web/src/lib/venue/venue-listing-filters.ts
 * @see apps/api/src/routes/venue/public/getFilterOptions.ts
 */

import { expect, test } from '@playwright/test';
import { listPublicBusinessLines, VenueTypeEnum, VerticalEnum } from '@repo/schemas';
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

interface FilterOptionsBody {
    readonly data?: {
        readonly types?: readonly string[];
        readonly amenityIds?: readonly string[];
        readonly featureIds?: readonly string[];
    };
}

/** Creates a CITY destination private to this spec. */
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
            'E2E fixture destination for the venue collection filters.',
            'A city created by the HOS-1870 end-to-end fixture.',
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
            summary: 'E2E fixture for the venue collection filters.',
            description:
                'A listing created by the HOS-1870 end-to-end fixture, long enough for the create schema.',
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

/**
 * Display weight for the fixture catalog rows. It MUST stay inside the
 * schema range (`displayWeight` is `.min(1).max(100)` on both
 * `AmenitySchema` and `FeatureSchema`). The column has no CHECK, so SQL accepts
 * anything, but the public catalog routes validate every item against
 * `*PublicSchema`. One out-of-range row turns the whole
 * `/api/v1/public/{amenities,features}` list into a 500. The page then renders
 * an empty sidebar, and every other spec reading those catalogs fails while
 * the row exists.
 */
const FIXTURE_DISPLAY_WEIGHT = 100;

/** Inserts a venue-scoped amenity with a token-unique slug. */
async function createAmenity({ token }: { readonly token: string }): Promise<string> {
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO amenities (slug, type, applicable_verticals, display_weight)
         VALUES ($1, 'ENTERTAINMENT', '{venue}', $2)
         RETURNING id`,
        [`e2e-${token.toLowerCase()}-amenity`, FIXTURE_DISPLAY_WEIGHT]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('createAmenity: insert returned no id');
    return id;
}

/** Inserts a venue-scoped feature with a token-unique slug. */
async function createFeature({
    token,
    suffix
}: {
    readonly token: string;
    readonly suffix: string;
}): Promise<string> {
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO features (slug, applicable_verticals, display_weight, category)
         VALUES ($1, '{venue}', $2, 'CUISINE')
         RETURNING id`,
        [`e2e-${token.toLowerCase()}-${suffix}`, FIXTURE_DISPLAY_WEIGHT]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('createFeature: insert returned no id');
    return id;
}

/** Reads the business lines the create route persisted for a venue. */
async function readBusinessLines({ venueId }: { readonly venueId: string }): Promise<string[]> {
    const rows = await execSQL<{ business_lines: string[] }>(
        'SELECT business_lines FROM venues WHERE id = $1',
        [venueId]
    );
    return rows[0]?.business_lines ?? [];
}

/** Fetches the public filter options, optionally scoped to one collection. */
async function getFilterOptions({
    request,
    businessLine
}: {
    readonly request: import('@playwright/test').APIRequestContext;
    readonly businessLine?: string;
}): Promise<{
    readonly types: readonly string[];
    readonly amenityIds: readonly string[];
    readonly featureIds: readonly string[];
}> {
    const query = businessLine ? `?businessLine=${encodeURIComponent(businessLine)}` : '';
    const response = await request.get(`${API_URL}/api/v1/public/venues/filter-options${query}`);
    expect(response.status(), `GET /venues/filter-options${query}`).toBe(200);
    const body = (await response.json()) as FilterOptionsBody;
    const data = body.data;
    if (!data) throw new Error('getFilterOptions: response carried no data');
    return {
        types: data.types ?? [],
        amenityIds: data.amenityIds ?? [],
        featureIds: data.featureIds ?? []
    };
}

/** Fetches a page's raw SSR HTML. */
async function getHtml({
    request,
    path
}: {
    readonly request: import('@playwright/test').APIRequestContext;
    readonly path: string;
}): Promise<string> {
    const response = await request.get(`${WEB_URL}${path}`);
    expect(response.status(), `GET ${path}`).toBe(200);
    return response.text();
}

/**
 * Fetches a page until its SSR HTML contains `needle`, outlasting the SSR
 * catalog cache (60 s). Returns the HTML that contained it.
 */
async function waitForHtmlContaining({
    request,
    path,
    needle
}: {
    readonly request: import('@playwright/test').APIRequestContext;
    readonly path: string;
    readonly needle: string;
}): Promise<string> {
    let html = '';
    await expect
        .poll(
            async () => {
                html = await getHtml({ request, path });
                return html.includes(needle);
            },
            { message: `${path} never served ${needle}`, timeout: 90_000, intervals: [5_000] }
        )
        .toBe(true);
    return html;
}

test.describe('AC:6:11 venue collections only offer filters with published listings @p0 @verticals', () => {
    const userIds: string[] = [];
    const venueIds: string[] = [];
    const destinationIds: string[] = [];
    const amenityIds: string[] = [];
    const featureIds: string[] = [];

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
        if (amenityIds.length > 0) {
            await execSQL('DELETE FROM amenities WHERE id = ANY($1::uuid[])', [amenityIds]);
            amenityIds.length = 0;
        }
        if (featureIds.length > 0) {
            await execSQL('DELETE FROM features WHERE id = ANY($1::uuid[])', [featureIds]);
            featureIds.length = 0;
        }
    });

    test('offers only the filters present on the collection published listings', async ({
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

        const token = `HOS1870-${Date.now()}`;
        const { id: destinationId } = await createCityDestination({ token });
        destinationIds.push(destinationId);

        // ── 1. Own catalog: one amenity and two features, venue-only ─────────
        const amenityC1 = await createAmenity({ token });
        amenityIds.push(amenityC1);
        const featureX1 = await createFeature({ token, suffix: 'feature-x1' });
        const featureX2 = await createFeature({ token, suffix: 'feature-x2' });
        featureIds.push(featureX1, featureX2);

        // ── 2. Venues: a BOLICHE with C1+X1 and a CAFE with X2 ───────────────
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
        venueIds.push(boliche.id, cafe.id);

        await execSQL('INSERT INTO r_venue_amenity (venue_id, amenity_id) VALUES ($1, $2)', [
            boliche.id,
            amenityC1
        ]);
        await execSQL('INSERT INTO r_venue_feature (venue_id, feature_id) VALUES ($1, $2)', [
            boliche.id,
            featureX1
        ]);
        await execSQL('INSERT INTO r_venue_feature (venue_id, feature_id) VALUES ($1, $2)', [
            cafe.id,
            featureX2
        ]);
        await execSQL(
            `UPDATE venues SET publication_status = 'PUBLISHED' WHERE id = ANY($1::uuid[])`,
            [venueIds]
        );

        // The create route preselects the lines from the type; read them back
        // instead of naming a catalog value here.
        const bolicheLine = (await readBusinessLines({ venueId: boliche.id }))[0];
        const cafeLine = (await readBusinessLines({ venueId: cafe.id }))[0];
        if (!bolicheLine || !cafeLine) {
            throw new Error('venues carry no business lines after create');
        }

        const publicLines = listPublicBusinessLines({ vertical: 'venue' });
        const slugByValue = new Map<string, string>(
            publicLines.map((line) => [line.value, line.urlSlug])
        );
        const bolicheSlug = slugByValue.get(bolicheLine);
        const cafeSlug = slugByValue.get(cafeLine);
        if (!bolicheSlug || !cafeSlug) {
            throw new Error('could not resolve the collection slug for the created venues');
        }

        const bolichePath = `/es/comer-y-salir/rubro/${bolicheSlug}/`;
        const cafePath = `/es/comer-y-salir/rubro/${cafeSlug}/`;

        // ── 3. API: each collection lists only its own catalog values ────────
        const bolicheOptions = await getFilterOptions({ request, businessLine: bolicheLine });
        expect(bolicheOptions.amenityIds).toContain(amenityC1);
        expect(bolicheOptions.featureIds).toContain(featureX1);
        expect(bolicheOptions.featureIds).not.toContain(featureX2);

        const cafeOptions = await getFilterOptions({ request, businessLine: cafeLine });
        expect(cafeOptions.featureIds).toContain(featureX2);
        expect(cafeOptions.featureIds).not.toContain(featureX1);
        expect(cafeOptions.amenityIds).not.toContain(amenityC1);

        // The sidebar is the catalog narrowed by the options above, so the
        // catalog read the pages make must serve the fixture rows. A failure
        // here names the real cause instead of timing out the HTML poll below.
        const catalogQuery = '?applicableVertical=venue&pageSize=100';
        for (const [path, ids] of [
            ['features', [featureX1, featureX2]],
            ['amenities', [amenityC1]]
        ] as const) {
            const catalogResponse = await request.get(
                `${API_URL}/api/v1/public/${path}${catalogQuery}`
            );
            expect(catalogResponse.status(), `GET /${path}${catalogQuery}`).toBe(200);
            const catalogBody = (await catalogResponse.json()) as {
                readonly data?: { readonly items?: readonly { readonly id?: string }[] };
            };
            const catalogIds = (catalogBody.data?.items ?? []).map((item) => item.id);
            for (const id of ids) {
                expect(catalogIds, `/${path} catalog serves ${id}`).toContain(id);
            }
        }

        // ── 4. HTML: the serialized sidebar carries only the collection values
        // The pages read the amenity/feature catalogs through the SSR in-process
        // cache (`SSR_PUBLIC_CACHE_TTL_MS`, 60 s), so a catalog row created a
        // moment ago only reaches the sidebar once that entry expires. Poll for
        // the positive value first: it proves the catalog refreshed, which is
        // what makes the negative assertions after it meaningful.
        const bolicheHtml = await waitForHtmlContaining({
            request,
            path: bolichePath,
            needle: featureX1
        });
        expect(bolicheHtml).not.toContain(featureX2);

        const cafeHtml = await waitForHtmlContaining({
            request,
            path: cafePath,
            needle: featureX2
        });
        expect(cafeHtml).not.toContain(featureX1);

        // ── 5. Type chips: never a type the collection cannot contain ────────
        // The CHECK constraint guarantees a BOLICHE is never on the food line
        // and a CAFE never on the night line, no matter what the shared DB has.
        expect(cafeHtml).not.toContain(`?type=${VenueTypeEnum.BOLICHE}`);
        expect(bolicheHtml).not.toContain(`?type=${VenueTypeEnum.CAFE}`);
        expect(bolicheHtml).toContain(`?type=${VenueTypeEnum.BOLICHE}`);

        // ── 6. The general listing still offers every published value ────────
        const generalHtml = await waitForHtmlContaining({
            request,
            path: '/es/comer-y-salir/',
            needle: featureX1
        });
        expect(generalHtml).toContain(featureX2);
    });
});
