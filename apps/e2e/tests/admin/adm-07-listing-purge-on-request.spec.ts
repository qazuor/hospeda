/**
 * TEST:V8a:11 (e2e admin, the action 23 half; AC:V8a:9) — the confirmation of
 * administrative action 23 says which listing, that its content does not come
 * back and that the featured placement is cancelled; confirming with a reason
 * purges the listing and queues the owner's confirmation mail marked as done
 * by support. (The action 24 half belongs to HOS-1494.)
 * Tags: @p1 @admin
 */

import { expect, test } from '@playwright/test';
import { createAccommodation, createUser, markAdminToursSeen } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('TEST:V8a:11 AC:V8a:9 action 23 confirmation @p1 @admin', () => {
    const userIdsToCleanup: string[] = [];

    test.afterEach(async () => {
        if (userIdsToCleanup.length > 0) {
            await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
            userIdsToCleanup.length = 0;
        }
    });

    test('says what it purges, needs a reason, and purges at the owner request', async ({
        page
    }) => {
        // Arrange
        const superAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(superAdmin.id);
        await markAdminToursSeen({ userId: superAdmin.id });

        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(owner.id);
        const accommodation = await createAccommodation({
            ownerId: owner.id,
            slugPrefix: 'adm-07'
        });
        const [row] = await execSQL<{ name: string }>(
            'SELECT name FROM accommodations WHERE id = $1',
            [accommodation.id]
        );
        const listingName = row?.name ?? '';
        expect(listingName).not.toBe('');

        await page.context().addCookies(
            superAdmin.sessionCookie.split('; ').map((cookie) => {
                const [name, ...value] = cookie.split('=');
                return { name: (name ?? '').trim(), value: value.join('='), url: ADMIN_URL };
            })
        );

        await page.goto(`${ADMIN_URL}/accommodations/${accommodation.id}`, {
            waitUntil: 'domcontentloaded'
        });

        // A loaded page is a prerequisite: an empty page must never satisfy it.
        await expect(
            page.getByTestId('entity-page-header').getByRole('heading', { name: listingName })
        ).toBeVisible({ timeout: 30_000 });

        // Act: open the action
        await page.getByTestId('listing-purge-on-request').click();
        const dialog = page.getByTestId('listing-purge-on-request-dialog');
        await expect(dialog).toBeVisible();

        // Assert: the confirmation says what is going to happen
        await expect(dialog).toContainText(listingName);
        await expect(dialog).toContainText('se borra y no vuelve');
        await expect(dialog).toContainText('se cancela');

        // Assert: no reason, no purge
        const confirm = page.getByTestId('listing-purge-on-request-confirm');
        await expect(confirm).toBeDisabled();
        await page.getByTestId('listing-purge-on-request-reason').fill('   ');
        await expect(confirm).toBeDisabled();

        // Act: give the reason and confirm
        await page
            .getByTestId('listing-purge-on-request-reason')
            .fill('Juan pidió por correo que borremos su ficha');
        const purgeResponse = page.waitForResponse(
            (response) =>
                response.url().endsWith(`/api/v1/admin/accommodations/${accommodation.id}/purge`) &&
                response.request().method() === 'POST'
        );
        await confirm.click();

        // Assert: the route accepted it, the listing is PURGED, and the owner's
        // confirmation mail is queued marked as done by support.
        const response = await purgeResponse;
        expect(response.status()).toBe(200);

        const [listing] = await execSQL<{ publication_status: string }>(
            'SELECT publication_status FROM accommodations WHERE id = $1',
            [accommodation.id]
        );
        expect(listing?.publication_status).toBe('PURGED');

        const mails = await execSQL<{ by_support: string | null }>(
            `SELECT payload->>'bySupport' AS by_support
               FROM email_outbox
              WHERE recipient_user_id = $1
                AND template = 'verticals.listing-purged'
                AND payload->>'listingId' = $2`,
            [owner.id, accommodation.id]
        );
        expect(mails).toHaveLength(1);
        expect(mails[0]?.by_support).toBe('true');
    });
});
