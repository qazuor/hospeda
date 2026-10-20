/**
 * TEST:V8a:11 (e2e admin, the action 24 half; AC:V8a:11) — the confirmation of
 * administrative action 24 says whose account it is and that nothing is left
 * to charge and no listing remains; confirming with a reason closes the account
 * (pseudonymised, `deleted_at` stamped). An account that still owns a listing
 * outside PURGED is not offered a confirmation at all: the dialog says what is
 * missing. (The action 23 half lives in `adm-07`.)
 * Tags: @p1 @admin
 */

import { expect, type Page, test } from '@playwright/test';
import {
    type CreatedUser,
    createAccommodation,
    createUser,
    markAdminToursSeen
} from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

/** Signs the admin in on the panel origin. */
async function useAdminSession(page: Page, admin: CreatedUser): Promise<void> {
    await page.context().addCookies(
        admin.sessionCookie.split('; ').map((cookie) => {
            const [name, ...value] = cookie.split('=');
            return { name: (name ?? '').trim(), value: value.join('='), url: ADMIN_URL };
        })
    );
}

/** Reads the CURRENT name and mailbox of an account, as the preview shows them. */
async function readIdentity(userId: string): Promise<{ displayName: string; email: string }> {
    const [row] = await execSQL<{ display_name: string | null; email: string }>(
        'SELECT display_name, email FROM users WHERE id = $1',
        [userId]
    );
    return { displayName: row?.display_name ?? row?.email ?? '', email: row?.email ?? '' };
}

/** Opens the user detail page and the action 24 dialog. */
async function openClosureDialog(page: Page, userId: string) {
    const previewResponse = page.waitForResponse(
        (response) =>
            response.url().endsWith(`/api/v1/admin/users/${userId}/close-on-request`) &&
            response.request().method() === 'GET'
    );
    await page.goto(`${ADMIN_URL}/access/users/${userId}`, { waitUntil: 'domcontentloaded' });

    // A loaded page is a prerequisite: an empty page must never satisfy it.
    const button = page.getByTestId('account-close-on-request');
    await expect(button).toBeVisible({ timeout: 30_000 });

    await button.click();
    const dialog = page.getByTestId('account-close-on-request-dialog');
    await expect(dialog).toBeVisible();
    expect((await previewResponse).status()).toBe(200);
    return dialog;
}

test.describe('TEST:V8a:11 action 24 confirmation says whose account it is and that nothing is left to charge @p1 @admin', () => {
    const userIdsToCleanup: string[] = [];

    test.afterEach(async () => {
        if (userIdsToCleanup.length > 0) {
            await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
            userIdsToCleanup.length = 0;
        }
    });

    test('an account with nothing left: says whose it is, needs a reason, and closes it', async ({
        page
    }) => {
        // Arrange
        const superAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(superAdmin.id);
        await markAdminToursSeen({ userId: superAdmin.id });

        const account = await createUser({}, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(account.id);
        const identity = await readIdentity(account.id);
        expect(identity.email).not.toBe('');

        await useAdminSession(page, superAdmin);

        // Act: open the action
        const dialog = await openClosureDialog(page, account.id);

        // Assert: the confirmation says whose account it is and that nothing is left
        await expect(dialog).toContainText(identity.displayName);
        await expect(dialog).toContainText(identity.email);
        await expect(dialog).toContainText('No le queda cobro, ficha ni presencia de Partner');
        await expect(dialog).toContainText('se seudonimiza');

        // Assert: no reason, no closure
        const confirm = page.getByTestId('account-close-on-request-confirm');
        await expect(confirm).toBeDisabled();
        await page.getByTestId('account-close-on-request-reason').fill('   ');
        await expect(confirm).toBeDisabled();

        // Act: give the reason and confirm
        await page
            .getByTestId('account-close-on-request-reason')
            .fill('Juan pidió por correo que demos de baja su cuenta');
        const closeResponse = page.waitForResponse(
            (response) =>
                response.url().endsWith(`/api/v1/admin/users/${account.id}/close-on-request`) &&
                response.request().method() === 'POST'
        );
        await confirm.click();

        // Assert: the route accepted it, the panel went back to the list, and
        // the row is pseudonymised and stamped instead of deleted.
        expect((await closeResponse).status()).toBe(200);
        await expect(page).toHaveURL(/\/access\/users\/?(\?.*)?$/, { timeout: 30_000 });

        const [row] = await execSQL<{ deleted_at: Date | null; email: string }>(
            'SELECT deleted_at, email FROM users WHERE id = $1',
            [account.id]
        );
        expect(row?.deleted_at).not.toBeNull();
        expect(row?.email).toBe(`deleted-${account.id}@pseudonym.invalid`);
    });

    test('an account that still owns a listing: says listings are left and offers no confirm', async ({
        page
    }) => {
        // Arrange
        const superAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(superAdmin.id);
        await markAdminToursSeen({ userId: superAdmin.id });

        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(owner.id);
        await createAccommodation({ ownerId: owner.id, slugPrefix: 'adm-08' });

        await useAdminSession(page, superAdmin);

        // Act
        const dialog = await openClosureDialog(page, owner.id);

        // Assert: it says what is missing, and there is nothing to confirm
        await expect(page.getByTestId('account-close-on-request-blocked-listings')).toContainText(
            'fichas sin borrar'
        );
        await expect(dialog).not.toContainText('No le queda cobro');
        await expect(page.getByTestId('account-close-on-request-confirm')).toHaveCount(0);
        await expect(page.getByTestId('account-close-on-request-reason')).toHaveCount(0);

        const [row] = await execSQL<{ deleted_at: Date | null }>(
            'SELECT deleted_at FROM users WHERE id = $1',
            [owner.id]
        );
        expect(row?.deleted_at).toBeNull();
    });
});
