/**
 * AC:G:13 and AC:G:14 — cached venue detail HTML has no today marker, and the
 * browser highlights the Buenos Aires weekday after the visible grid hydrates.
 * Tags: @p0 @verticals
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
const SUNDAY_LATE_IN_BUENOS_AIRES = new Date('2026-11-09T02:30:00.000Z');

interface CreatedVenue {
    readonly id: string;
    readonly slug: string;
}
interface VenueResponseBody {
    readonly data?: { readonly id?: string; readonly slug?: string };
}

test.describe('AC:G:13/14 client-side opening-hours today row @p0 @verticals', () => {
    const userIds: string[] = [];
    const venueIds: string[] = [];

    test.beforeEach(async ({ page }) => seedCookieConsent(page));

    test.afterAll(async () => {
        for (const venueId of venueIds)
            await execSQL('DELETE FROM venues WHERE id = $1', [venueId]);
        venueIds.length = 0;
        if (userIds.length > 0) {
            await cleanupTestUsers(getDbPool(), userIds);
            userIds.length = 0;
        }
    });

    test('serves no today marker and marks the Buenos Aires Sunday in the browser', async ({
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
        const name = `OpeningHoursToday${Date.now()}`;
        const response = await fetch(`${API_URL}/api/v1/protected/venues`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: owner.sessionCookie },
            body: JSON.stringify({
                name,
                summary: 'E2E fixture for opening hours.',
                description:
                    'A published venue used to verify the public weekly opening hours grid.',
                type: VenueTypeEnum.RESTAURANT,
                destinationId: await getAnyCityDestinationId()
            })
        });
        if (response.status !== 201)
            throw new Error(`createVenue failed: ${response.status} ${await response.text()}`);
        const body = (await response.json()) as VenueResponseBody;
        const venue: CreatedVenue = { id: body.data?.id ?? '', slug: body.data?.slug ?? '' };
        if (!venue.id || !venue.slug) throw new Error('createVenue: response carried no id/slug');
        venueIds.push(venue.id);

        const openDay = { closed: false, shifts: [{ open: '09:00', close: '18:00' }] };
        await execSQL(
            `UPDATE venues SET publication_status = 'PUBLISHED', opening_hours = $2::jsonb WHERE id = $1`,
            [
                venue.id,
                JSON.stringify({
                    timezone: 'America/Argentina/Buenos_Aires',
                    days: {
                        mon: openDay,
                        tue: openDay,
                        wed: openDay,
                        thu: openDay,
                        fri: openDay,
                        sat: openDay,
                        sun: openDay
                    }
                })
            ]
        );

        const detailUrl = `${WEB_URL}/es/comer-y-salir/${venue.slug}/`;
        const htmlResponse = await request.get(detailUrl);
        expect(htmlResponse.status(), `GET ${detailUrl}`).toBe(200);
        expect(await htmlResponse.text()).not.toContain('data-today');

        await page.clock.install({ time: SUNDAY_LATE_IN_BUENOS_AIRES });
        await page.goto(detailUrl, { waitUntil: 'domcontentloaded' });
        const sunday = page.locator('[data-day="sunday"]');
        await sunday.scrollIntoViewIfNeeded();
        const todayRows = page.locator('[data-today="true"]');
        await expect(todayRows).toHaveCount(1, { timeout: 15_000 });
        await expect(todayRows).toHaveAttribute('data-day', 'sunday');
        await expect(todayRows.getByText('Hoy')).toBeVisible();
    });
});
