/**
 * ADM-05 — The admin panel offers no impersonation (HOS-1352 V5, AC:V5:10).
 *
 * TEST:V5:12 — E2E admin: the panel does not show the impersonate button.
 *
 * Actors: a SUPER_ADMIN (the role that used to hold `USER_IMPERSONATE`, so the
 *         one that used to see the button) looking at another account.
 * Tags: @p1 @admin
 *
 * Impersonation leaves the product entirely (DEC-AUTH-003 point 4): the
 * plugin actions, the `USER_IMPERSONATE` permission and the panel button. This
 * spec opens the user pages whose header used to render the button — the
 * detail view and the edit view — and asserts that neither offers it. Each
 * check first waits for an action that IS still there (the delete button), so
 * an empty or still-loading page cannot pass the negative assertion.
 *
 * The users LIST row action is covered by the static guard
 * `apps/admin/test/no-impersonation.guard.test.ts`, not here: in the e2e
 * environment the list renders no rows for a fresh SUPER_ADMIN (observed in
 * nightly run 37724822524), so a row-scoped check could only wait on nothing.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';
import { createUser, markAdminToursSeen } from '../../fixtures/api-helpers.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

/** Every label the impersonate affordance ever carried, in es / en / pt. */
const IMPERSONATE_LABEL = /suplant|impersonat|personific/i;

async function expectNoImpersonateControl(scope: Locator | Page): Promise<void> {
    await expect(scope.getByRole('button', { name: IMPERSONATE_LABEL })).toHaveCount(0);
    await expect(scope.getByTitle(IMPERSONATE_LABEL)).toHaveCount(0);
}

test.describe('ADM-05: no impersonation in the admin panel @p1 @admin', () => {
    const userIdsToCleanup: string[] = [];

    test.afterEach(async () => {
        if (userIdsToCleanup.length > 0) {
            await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
            userIdsToCleanup.length = 0;
        }
    });

    test('TEST:V5:12 — a SUPER_ADMIN sees no impersonate button on a user', async ({ page }) => {
        // ── Arrange ────────────────────────────────────────────────────────
        const superAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(superAdmin.id);
        await markAdminToursSeen({ userId: superAdmin.id });

        const target = await createUser({}, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(target.id);

        await page.context().addCookies(
            superAdmin.sessionCookie.split('; ').map((c) => {
                const [name, ...rest] = c.split('=');
                return { name: (name ?? '').trim(), value: rest.join('='), url: ADMIN_URL };
            })
        );

        // ── Act + Assert 1: the user detail header ────────────────────────
        await page.goto(`${ADMIN_URL}/access/users/${target.id}`, {
            waitUntil: 'domcontentloaded'
        });
        const headerActions = page.getByTestId('header-extra-actions');
        await expect(headerActions).toBeVisible({ timeout: 30_000 });
        // The delete action still renders here: the header is really loaded.
        await expect(headerActions.getByRole('button').first()).toBeVisible();
        await expectNoImpersonateControl(headerActions);
        await expectNoImpersonateControl(page);

        // ── Act + Assert 2: the user edit header ──────────────────────────
        await page.goto(`${ADMIN_URL}/access/users/${target.id}/edit`, {
            waitUntil: 'domcontentloaded'
        });
        const editHeaderActions = page.getByTestId('header-extra-actions');
        await expect(editHeaderActions).toBeVisible({ timeout: 30_000 });
        await expect(editHeaderActions.getByRole('button').first()).toBeVisible();
        await expectNoImpersonateControl(editHeaderActions);
        await expectNoImpersonateControl(page);
    });
});
