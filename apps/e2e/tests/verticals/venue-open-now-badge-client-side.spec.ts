/**
 * AC:6:7 — a cached listing carries no "open now" badge in its HTML; the
 * browser computes it after hydration (HOS-1787 leaf 6.3, DEC-FAC-052).
 *
 * Two published venues are created through the real owner self-service route
 * and get their schedule through SQL: one open every day (`00:00`–`23:59`), one
 * closed every day. The plain HTTP response of the listing must carry both
 * cards' names but no badge text; the browser, with a fixed clock at midday in
 * Buenos Aires, must show the badge for each.
 *
 * The listing is requested with `?q=<token>` because the default sort/page size
 * could leave the fixtures off page 1 on a populated database. `q` is not a
 * pagination param, so that response is not edge-cached — the card markup it
 * serves is the same, and the island's SSR emptiness is also pinned by the
 * component test (`TEST:6.3:3`).
 *
 * Tags: @p0 @verticals
 *
 * @see apps/web/src/components/venue/VenueOpenNowBadge.client.tsx
 * @see apps/web/src/lib/venue/open-now-in-zone.ts
 */

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
import { ensureListingOwnerTrial } from '../../fixtures/listing-owner-trial.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

/** Midday in Buenos Aires (UTC-3). */
const NOON_IN_VENUE_ZONE = new Date('2026-03-10T15:00:00.000Z');

interface CreatedVenue {
    readonly id: string;
    readonly slug: string;
}

interface VenueResponseBody {
    readonly data?: { readonly id?: string; readonly slug?: string };
}

/** A day of the public `openingHours` JSONB shape. */
interface OpeningHoursDay {
    readonly closed: boolean;
    readonly shifts: ReadonlyArray<{ readonly open: string; readonly close: string }>;
}

/**
 * Builds a full-week schedule with the same day on every weekday.
 *
 * @param day - The schedule each day carries.
 * @returns The complete block stored in `venues.opening_hours`.
 */
function buildWeek(day: OpeningHoursDay): {
    readonly timezone: string;
    readonly days: Record<string, OpeningHoursDay>;
} {
    return {
        timezone: 'America/Argentina/Buenos_Aires',
        days: {
            mon: day,
            tue: day,
            wed: day,
            thu: day,
            fri: day,
            sat: day,
            sun: day
        }
    };
}

/** Creates a venue through the owner self-service route. */
async function createVenue({
    sessionCookie,
    name
}: {
    readonly sessionCookie: string;
    readonly name: string;
}): Promise<CreatedVenue> {
    const destinationId = await getAnyCityDestinationId();
    const response = await fetch(`${API_URL}/api/v1/protected/venues`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify({
            name,
            summary: 'E2E fixture for the client-side open-now badge.',
            description:
                'A listing created by the HOS-1863 end-to-end fixture, long enough for the create schema.',
            type: VenueTypeEnum.RESTAURANT,
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

/** Publishes a venue and gives it a weekly schedule. */
async function publishVenueWithHours(
    venueId: string,
    openingHours: ReturnType<typeof buildWeek>
): Promise<void> {
    await execSQL(
        `UPDATE venues
            SET publication_status = 'PUBLISHED', opening_hours = $2::jsonb
          WHERE id = $1`,
        [venueId, JSON.stringify(openingHours)]
    );
}

test.describe('AC:6:7 client-side open-now badge @p0 @verticals', () => {
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

    test('AC:6:7 cached listing carries no open-now badge in its HTML and the browser computes it @p0 @verticals', async ({
        page,
        request
    }) => {
        test.setTimeout(120_000);

        const owner: CreatedUser = await createUser(
            {},
            { apiBaseUrl: API_URL, webBaseUrl: WEB_URL }
        );
        userIds.push(owner.id);
        await markProfileCompleted({ userId: owner.id });
        await ensureListingOwnerTrial(getDbPool(), owner.id, VerticalEnum.VENUE);

        const token = `OpenNowBadge${Date.now()}`;
        const openName = `${token} Siempre abierto`;
        const closedName = `${token} Siempre cerrado`;

        const openVenue = await createVenue({
            sessionCookie: owner.sessionCookie,
            name: openName
        });
        venueIds.push(openVenue.id);
        await publishVenueWithHours(
            openVenue.id,
            buildWeek({ closed: false, shifts: [{ open: '00:00', close: '23:59' }] })
        );

        const closedVenue = await createVenue({
            sessionCookie: owner.sessionCookie,
            name: closedName
        });
        venueIds.push(closedVenue.id);
        await publishVenueWithHours(closedVenue.id, buildWeek({ closed: true, shifts: [] }));

        const listUrl = `${WEB_URL}/es/comer-y-salir/?q=${encodeURIComponent(token)}`;

        // ── The served HTML has both cards and no badge ──────────────────────
        const response = await request.get(listUrl);
        expect(response.status(), `GET ${listUrl}`).toBe(200);
        const html = await response.text();
        expect(html).toContain(openName);
        expect(html).toContain(closedName);
        expect(html).not.toContain('Abierto ahora');
        expect(html).not.toContain('Cerrado ahora');
        expect(html).not.toContain('venue-card__open-badge');

        // ── The browser computes both badges from the fixed clock ────────────
        await page.clock.install({ time: NOON_IN_VENUE_ZONE });
        await page.goto(listUrl, { waitUntil: 'domcontentloaded' });

        const openCard = page.locator('article.venue-card', { hasText: openName });
        const closedCard = page.locator('article.venue-card', { hasText: closedName });

        await expect(openCard.getByText('Abierto ahora')).toBeVisible({ timeout: 15_000 });
        await expect(closedCard.getByText('Cerrado ahora')).toBeVisible({ timeout: 15_000 });
    });
});
