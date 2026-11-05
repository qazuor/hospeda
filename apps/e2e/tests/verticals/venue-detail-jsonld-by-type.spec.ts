/**
 * AC:6:5 — the venue detail JSON-LD `@type` and `hasMenu` follow the venue's
 * own type, never a business line (HOS-1787 leaf 6.1, F-V1-040).
 *
 * A BOLICHE's `menu` section is `absent` (its type owns only the nightlife
 * line), so even with seeded carta rows and a `menu_url` the public payload
 * carries no menu content: the page must render `NightClub` with NO `hasMenu`
 * key. The RESTAURANT control is trial-enabled and publishes the same carta,
 * so it must render `Restaurant` with `hasMenu` pointing at its `/carta/` page.
 *
 * The two fixtures are created through the real owner self-service route and
 * published with SQL; the assertions read the SSR HTML of the public page.
 *
 * Tags: @p0 @verticals
 *
 * @see apps/web/src/lib/seo/venue-jsonld.ts
 * @see apps/web/src/lib/venue/venue-detail-sections.ts
 */

import { expect, type Page, test } from '@playwright/test';
import { VenueTypeEnum, VerticalEnum } from '@repo/schemas';
import {
    type CreatedUser,
    createUser,
    getAnyCityDestinationId,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
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
            summary: 'E2E fixture for the venue detail JSON-LD type.',
            description:
                'A listing created by the HOS-1861 end-to-end fixture, long enough for the create schema.',
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

/** Publishes a venue (the public read answers only PUBLISHED, HOS-1641). */
async function publishVenue(venueId: string): Promise<void> {
    await execSQL(`UPDATE venues SET publication_status = 'PUBLISHED' WHERE id = $1`, [venueId]);
}

/** Reads every JSON-LD node from the rendered page and returns the venue one. */
async function readVenueJsonLd({
    page,
    name,
    url
}: {
    readonly page: Page;
    readonly name: string;
    readonly url: string;
}): Promise<Record<string, unknown>> {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `GET ${url}`).toBe(200);

    const nodes = await page.evaluate(() =>
        Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
            .map((script) => script.textContent ?? '')
            .flatMap((text) => {
                try {
                    return [JSON.parse(text) as unknown];
                } catch {
                    return [];
                }
            })
    );

    const venueNode = nodes.find(
        (node) =>
            typeof node === 'object' &&
            node !== null &&
            (node as Record<string, unknown>).name === name
    );
    if (!venueNode) throw new Error(`No JSON-LD node found for venue ${name}`);
    return venueNode as Record<string, unknown>;
}

test.describe('AC:6:5 venue detail JSON-LD type and hasMenu by venue type @p0 @verticals', () => {
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

    test('a BOLICHE publishes NightClub without hasMenu while a RESTAURANT publishes Restaurant with the carta URL', async ({
        page
    }) => {
        test.setTimeout(120_000);

        const owner: CreatedUser = await createUser(
            {},
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );
        userIds.push(owner.id);
        await markProfileCompleted({ userId: owner.id });
        await ensureListingOwnerTrial(getDbPool(), owner.id, VerticalEnum.VENUE);

        const suffix = Date.now();
        const bolicheName = `Boliche JSON-LD ${suffix}`;
        const restaurantName = `Restaurante JSON-LD ${suffix}`;

        const boliche = await createVenue({
            sessionCookie: owner.sessionCookie,
            type: VenueTypeEnum.BOLICHE,
            name: bolicheName
        });
        venueIds.push(boliche.id);
        await seedMenu(boliche.id);
        await execSQL('UPDATE venues SET menu_url = $2 WHERE id = $1', [
            boliche.id,
            'https://boliche.example/carta'
        ]);
        await publishVenue(boliche.id);

        const restaurant = await createVenue({
            sessionCookie: owner.sessionCookie,
            type: VenueTypeEnum.RESTAURANT,
            name: restaurantName
        });
        venueIds.push(restaurant.id);
        await seedMenu(restaurant.id);
        await publishVenue(restaurant.id);

        // ── BOLICHE: NightClub, no hasMenu ───────────────────────────────────
        const bolicheUrl = `${WEB_URL}/es/comer-y-salir/${boliche.slug}/`;
        const bolicheNode = await readVenueJsonLd({
            page,
            name: bolicheName,
            url: bolicheUrl
        });
        expect(bolicheNode['@type']).toBe('NightClub');
        expect('hasMenu' in bolicheNode).toBe(false);

        // ── RESTAURANT: Restaurant, hasMenu = the carta URL ─────────────────
        const restaurantUrl = `${WEB_URL}/es/comer-y-salir/${restaurant.slug}/`;
        const restaurantNode = await readVenueJsonLd({
            page,
            name: restaurantName,
            url: restaurantUrl
        });
        expect(restaurantNode['@type']).toBe('Restaurant');
        expect(String(restaurantNode.hasMenu)).toBe(
            `${WEB_URL}/es/comer-y-salir/${restaurant.slug}/carta/`
        );

        // ── Visible breadcrumb: no retired place name ───────────────────────
        for (const url of [bolicheUrl, restaurantUrl]) {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
            await expect(breadcrumb).toContainText('Comer y salir');
            await expect(breadcrumb).not.toContainText('Gastronomía');
        }
    });
});
