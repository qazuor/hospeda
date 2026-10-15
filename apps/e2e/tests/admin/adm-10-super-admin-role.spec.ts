/**
 * TEST:V5:18 — action 26 confirmation names the account and the seven rows it grants or removes.
 * Tags: @p1 @admin
 */

import { expect, type Page, test } from '@playwright/test';
import { type CreatedUser, createUser, markAdminToursSeen } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const ACTION_LABELS = [
    'Migrar a los clientes de un plan retirado',
    'Publicar una versión de plan',
    'Fijar el precio de un ciclo',
    'Publicar una versión de complemento',
    'Crear o cerrar un código promocional',
    'Cambiar un plazo',
    'Asignar o quitar el rol SUPER_ADMIN'
];

/** Signs the admin in on the panel origin. */
async function useAdminSession(page: Page, admin: CreatedUser): Promise<void> {
    await page.context().addCookies(
        admin.sessionCookie.split('; ').map((cookie) => {
            const [name, ...value] = cookie.split('=');
            return { name: (name ?? '').trim(), value: value.join('='), url: ADMIN_URL };
        })
    );
}

/** Reads the target account's current identity for confirmation assertions. */
async function readIdentity(userId: string): Promise<{ name: string; email: string }> {
    const rows = await execSQL<{ display_name: string | null; email: string }>(
        'SELECT display_name, email FROM users WHERE id = $1',
        [userId]
    );
    const row = rows.find((candidate) => candidate.email !== '');
    return { name: row?.display_name ?? row?.email ?? '', email: row?.email ?? '' };
}

/** Opens the permissions tab and chooses the SUPER_ADMIN role. */
async function openAssignDialog(page: Page, targetId: string) {
    await page.goto(`${ADMIN_URL}/access/users/${targetId}/permissions`, {
        waitUntil: 'domcontentloaded'
    });
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Super Admin' }).click();
    await page.getByRole('button', { name: 'Otorgar rol' }).click();
    return page.getByTestId('super-admin-role-dialog');
}

test.describe('TEST:V5:18 action 26 confirmation @p1 @admin', () => {
    const userIdsToCleanup: string[] = [];

    test.afterEach(async () => {
        if (userIdsToCleanup.length > 0) {
            await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
            userIdsToCleanup.length = 0;
        }
    });

    test('assigns SUPER_ADMIN after naming the account, actions, and audit reason', async ({
        page
    }) => {
        const actor = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(actor.id);
        await markAdminToursSeen({ userId: actor.id });
        const target = await createUser({}, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(target.id);
        const identity = await readIdentity(target.id);
        await useAdminSession(page, actor);

        const dialog = await openAssignDialog(page, target.id);
        await expect(dialog).toContainText(identity.name);
        await expect(dialog).toContainText(identity.email);
        for (const label of ACTION_LABELS) await expect(dialog).toContainText(label);
        const confirm = page.getByTestId('super-admin-role-confirm');
        await expect(confirm).toBeDisabled();
        await page.getByTestId('super-admin-role-reason').fill('Approved by the security owner');
        const responsePromise = page.waitForResponse(
            (response) =>
                response.url().endsWith(`/api/v1/admin/users/${target.id}/roles`) &&
                response.request().method() === 'POST'
        );
        await confirm.click();
        expect((await responsePromise).status()).toBe(200);

        const assignments = await execSQL<{ role: string }>(
            "SELECT role FROM user_role WHERE user_id = $1 AND role = 'SUPER_ADMIN'::role_enum",
            [target.id]
        );
        expect(assignments.some((row) => row.role === 'SUPER_ADMIN')).toBe(true);
        const audits = await execSQL<{
            action: string;
            by: string;
            reason: string;
            role: string;
            user_id: string;
        }>(
            "SELECT action, by, reason, role, user_id FROM user_role_audit WHERE user_id = $1 AND role = 'SUPER_ADMIN'::role_enum AND action = 'grant'::role_grant_action_enum",
            [target.id]
        );
        expect(
            audits.some(
                (row) => row.by === actor.id && row.reason === 'Approved by the security owner'
            )
        ).toBe(true);
    });

    test('removes SUPER_ADMIN after confirming the seven actions and audit reason', async ({
        page
    }) => {
        const actor = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(actor.id);
        await markAdminToursSeen({ userId: actor.id });
        const target = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(target.id);
        const identity = await readIdentity(target.id);
        await useAdminSession(page, actor);
        await page.goto(`${ADMIN_URL}/access/users/${target.id}/permissions`, {
            waitUntil: 'domcontentloaded'
        });

        await page.getByRole('button', { name: 'Revocar rol' }).last().click();
        const dialog = page.getByTestId('super-admin-role-dialog');
        await expect(dialog).toContainText(identity.name);
        await expect(dialog).toContainText(identity.email);
        await expect(dialog).toContainText('dejar de poder ejecutar');
        for (const label of ACTION_LABELS) await expect(dialog).toContainText(label);
        await page.getByTestId('super-admin-role-reason').fill('Access no longer required');
        const responsePromise = page.waitForResponse(
            (response) =>
                response.url().includes(`/api/v1/admin/users/${target.id}/roles/SUPER_ADMIN`) &&
                response.request().method() === 'DELETE'
        );
        await page.getByTestId('super-admin-role-confirm').click();
        expect((await responsePromise).status()).toBe(200);

        const assignments = await execSQL<{ role: string }>(
            "SELECT role FROM user_role WHERE user_id = $1 AND role = 'SUPER_ADMIN'::role_enum",
            [target.id]
        );
        expect(assignments.some((row) => row.role === 'SUPER_ADMIN')).toBe(false);
        const audits = await execSQL<{
            action: string;
            by: string;
            reason: string;
            role: string;
            user_id: string;
        }>(
            "SELECT action, by, reason, role, user_id FROM user_role_audit WHERE user_id = $1 AND role = 'SUPER_ADMIN'::role_enum AND action = 'revoke'::role_grant_action_enum",
            [target.id]
        );
        expect(
            audits.some((row) => row.by === actor.id && row.reason === 'Access no longer required')
        ).toBe(true);
    });
});
