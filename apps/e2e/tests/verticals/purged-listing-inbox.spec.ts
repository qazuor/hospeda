/**
 * TEST:V8a:6 (AC:V8a:5), the e2e half — HOS-1492 (V8a.1b), rows 27 and 28 of
 * `V/19` §4.
 *
 * A tourist holds a price alert and a conversation about an accommodation; its
 * owner deletes it through the real PB12 route. Then the tourist's alerts show
 * the alert closed because that listing no longer exists (without saying why
 * it stopped existing), the closing mail is queued, and BOTH inboxes — the
 * tourist's and the owner's — show the whole conversation under «Esta ficha ya
 * no existe» with no reply form.
 *
 * Own users and listing only; never touches the global catalog. Not `@p0`.
 */

import { expect, test } from '@playwright/test';
import {
    createAccommodation,
    createUser,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    attachSession,
    cleanupListingNoticeRows,
    purgeOwnListing,
    readPublicationStatus,
    seedConversation,
    seedPriceAlert
} from '../../fixtures/listing-notices.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';

const GUEST_MESSAGE = '¿Aceptan mascotas en marzo?';
const OWNER_MESSAGE = 'Sí, hasta dos perros chicos.';

test.describe('Inboxes of a purged listing @verticals', () => {
    test('TEST:V8a:6 the alert closes with its mail queued and both threads are read-only, whole, and say the listing no longer exists', async ({
        page
    }) => {
        // Arrange
        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        const tourist = await createUser({}, { apiBaseUrl: API_URL });
        const userIds = [owner.id, tourist.id];
        let listingId = '';
        try {
            await markProfileCompleted({ userId: owner.id });
            await markProfileCompleted({ userId: tourist.id });
            const listing = await createAccommodation({
                ownerId: owner.id,
                slugPrefix: 'v8a-purged-inbox',
                lifecycleState: 'ACTIVE'
            });
            listingId = listing.id;
            const { alertId } = await seedPriceAlert({ userId: tourist.id, listingId });
            const { conversationId } = await seedConversation({
                guestId: tourist.id,
                ownerId: owner.id,
                listingId,
                guestBody: GUEST_MESSAGE,
                ownerBody: OWNER_MESSAGE
            });

            // Act: the owner deletes the listing (PB12, the real route).
            await purgeOwnListing({ ownerCookie: owner.sessionCookie, listingId });

            // Assert: the state and the queued mail, read back by SQL.
            expect(await readPublicationStatus({ listingId })).toBe('PURGED');
            const alerts = await execSQL<{ is_active: boolean }>(
                'SELECT is_active FROM tourist_price_alerts WHERE id = $1',
                [alertId]
            );
            expect(alerts).toEqual([{ is_active: false }]);
            const mails = await execSQL<{ alert_id: string; listing_id: string; vertical: string }>(
                `SELECT payload->>'alertId' AS alert_id,
                        payload->>'listingId' AS listing_id,
                        payload->>'vertical' AS vertical
                   FROM email_outbox
                  WHERE recipient_user_id = $1 AND template = 'verticals.price-alert-closed'`,
                [tourist.id]
            );
            expect(mails).toEqual([
                { alert_id: alertId, listing_id: listingId, vertical: 'accommodation' }
            ]);

            // Assert: the tourist's alerts list shows it closed, without a reason.
            await seedCookieConsent(page);
            await attachSession({ page, sessionCookie: tourist.sessionCookie });
            await page.goto(`${WEB_URL}/es/mi-cuenta/alertas/`);
            const closedList = page.getByRole('list', { name: 'Tus alertas de precio cerradas' });
            await expect(closedList).toContainText(
                'Esta alerta se cerró porque esa ficha ya no existe.'
            );
            for (const word of ['inactividad', 'borró el dueño', 'moderad']) {
                await expect(closedList).not.toContainText(word);
            }
            await expect(
                page.getByRole('list', { name: 'Tus alertas de precio activas' })
            ).toHaveCount(0);

            // Assert: the tourist's thread.
            await page.goto(`${WEB_URL}/es/mi-cuenta/consultas/${conversationId}/`);
            await expect(page.getByTestId('listing-gone-notice')).toHaveText(
                'Esta ficha ya no existe.'
            );
            await expect(page.getByText(GUEST_MESSAGE)).toBeVisible();
            await expect(page.getByText(OWNER_MESSAGE)).toBeVisible();
            await expect(page.locator('#reply-body')).toHaveCount(0);

            // Assert: the owner's thread.
            await page.context().clearCookies();
            await seedCookieConsent(page);
            await attachSession({ page, sessionCookie: owner.sessionCookie });
            await page.goto(`${WEB_URL}/es/mi-cuenta/consultas-propietario/${conversationId}/`);
            await expect(page.getByTestId('listing-gone-notice')).toHaveText(
                'Esta ficha ya no existe.'
            );
            await expect(page.getByText(GUEST_MESSAGE)).toBeVisible();
            await expect(page.getByText(OWNER_MESSAGE)).toBeVisible();
            await expect(page.locator('#reply-body')).toHaveCount(0);
        } finally {
            try {
                await cleanupListingNoticeRows({
                    userIds,
                    listingIds: listingId === '' ? [] : [listingId]
                });
            } finally {
                await cleanupTestUsers(getDbPool(), userIds);
            }
        }
    });
});
