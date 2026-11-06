/**
 * AC:6:2 — venue business-line collections: sitemap, noindex when empty, 404 and
 * crawl policy (HOS-1787 leaf 6.9).
 *
 * One owner publishes a BOLICHE in a CITY destination built for this spec. The
 * destination scopes every assertion (`?destinationId=<uuid>`), so the shared
 * E2E database's other venues cannot make an empty collection look populated:
 *
 *  - the collection of the published line is indexable and appears in the sitemap
 *    with the three locales and their hreflang alternates;
 *  - the other line's collection has no listing in this destination, so it is
 *    `noindex,follow` (the filtered view keeps its "no results" copy; the
 *    collection-specific empty state and its publish CTA are covered by the
 *    source and i18n tests);
 *  - an unknown segment is a hard 404;
 *  - robots.txt blocks the `businessLine` query param.
 *
 * Absence of an UNFILTERED collection from the sitemap, and its `noindex`, are
 * covered by the unit suite: the shared E2E database may hold other venues.
 *
 * Tags: @p0 @verticals
 *
 * @see apps/web/src/pages/[lang]/comer-y-salir/rubro/[rubro]/index.astro
 * @see apps/web/src/pages/sitemap-dynamic.xml.ts
 * @see packages/schemas/src/catalog/business-lines.ts
 */

import { expect, test } from '@playwright/test';
import { businessLineToUrlSlug, VenueTypeEnum, VerticalEnum } from '@repo/schemas';
import { type CreatedUser, createUser, markProfileCompleted } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { ensureListingOwnerTrial } from '../../fixtures/listing-owner-trial.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const SITE_URL = WEB_URL.replace(/\/$/, '');

interface CreatedVenue {
    readonly id: string;
    readonly slug: string;
}

interface VenueResponseBody {
    readonly data?: { readonly id?: string; readonly slug?: string };
}

/** Creates a CITY destination private to this spec, so `?destinationId=` isolates it. */
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
            'E2E fixture destination for the venue collection crawl spec.',
            'A city created by the HOS-1869 end-to-end fixture.',
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
            summary: 'E2E fixture for the venue collection crawl spec.',
            description:
                'A listing created by the HOS-1869 end-to-end fixture, long enough for the create schema.',
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

test.describe('AC:6:2 venue collections: sitemap, noindex when empty, 404 and crawl policy @p0 @verticals', () => {
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

    test('advertises only populated collections and noindexes the empty one', async ({
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

        const token = `HOS1869-${Date.now()}`;
        const { id: destinationId } = await createCityDestination({ token });
        destinationIds.push(destinationId);

        const boliche = await createVenue({
            sessionCookie: owner.sessionCookie,
            destinationId,
            type: VenueTypeEnum.BOLICHE,
            name: `Boliche ${token}`
        });
        venueIds.push(boliche.id);

        // A BOLICHE carries the nightlife line only (BUSINESS_LINE_RULES.venue);
        // setting it explicitly keeps the fixture independent of create defaults.
        await execSQL('UPDATE venues SET business_lines = $2::text[] WHERE id = $1', [
            boliche.id,
            ['nightlife']
        ]);
        await execSQL(`UPDATE venues SET publication_status = 'PUBLISHED' WHERE id = $1`, [
            boliche.id
        ]);

        const nightSlug = businessLineToUrlSlug({ value: 'nightlife' }).urlSlug;
        const foodSlug = businessLineToUrlSlug({ value: 'food' }).urlSlug;
        const populatedPath = `/es/comer-y-salir/rubro/${nightSlug}/`;
        const emptyPath = `/es/comer-y-salir/rubro/${foodSlug}/`;
        const scoped = (path: string): string =>
            `${WEB_URL}${path}?destinationId=${encodeURIComponent(destinationId)}`;

        // ── 1. An unknown segment is a hard 404 ──────────────────────────────
        const unknown = await request.get(`${WEB_URL}/es/comer-y-salir/rubro/inexistente/`, {
            maxRedirects: 0
        });
        expect(unknown.status()).toBe(404);

        // ── 2. The sitemap advertises the populated collection + alternates ──
        await expect
            .poll(
                async () => {
                    const response = await request.get(`${WEB_URL}/sitemap-dynamic.xml`, {
                        headers: { 'cache-control': 'no-cache' }
                    });
                    return response.text();
                },
                { timeout: 30_000, intervals: [500, 1_000, 2_000] }
            )
            .toContain(`<loc>${SITE_URL}/es/comer-y-salir/rubro/${nightSlug}/</loc>`);

        const sitemap = await request.get(`${WEB_URL}/sitemap-dynamic.xml`, {
            headers: { 'cache-control': 'no-cache' }
        });
        const sitemapBody = await sitemap.text();
        for (const [code, prefix] of [
            ['es', '/es'],
            ['en', '/en'],
            ['pt', '/pt']
        ] as const) {
            expect(sitemapBody).toContain(
                `<xhtml:link rel="alternate" hreflang="${code}" href="${SITE_URL}${prefix}/comer-y-salir/rubro/${nightSlug}/"`
            );
        }
        expect(sitemapBody).toContain(
            `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/es/comer-y-salir/rubro/${nightSlug}/"`
        );

        // ── 3. The populated collection is indexable ─────────────────────────
        const populatedResponse = await page.goto(scoped(populatedPath), {
            waitUntil: 'domcontentloaded'
        });
        expect(populatedResponse?.status()).toBe(200);
        await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
            'content',
            'index,follow,max-image-preview:large'
        );

        // ── 4. The empty collection is noindex ───────────────────────────────
        // `destinationId` is an active filter, so this render keeps the shared
        // "no results" state (the collection-specific empty state only replaces
        // the genuinely unfiltered one). The noindex rule applies to every
        // zero-result render.
        const emptyResponse = await page.goto(scoped(emptyPath), {
            waitUntil: 'domcontentloaded'
        });
        expect(emptyResponse?.status()).toBe(200);
        await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
            'content',
            'noindex,follow'
        );
        await expect(page.locator('body')).toContainText(
            'No se encontraron locales con los filtros seleccionados.'
        );
        await expect(page.locator('body')).not.toContainText('Publicá tu local');

        // ── 5. robots.txt blocks the businessLine query param ────────────────
        const robots = await request.get(`${WEB_URL}/robots.txt`);
        expect(robots.status()).toBe(200);
        expect(await robots.text()).toContain('Disallow: /*?*businessLine=');
    });
});
