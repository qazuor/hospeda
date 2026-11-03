import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { CreatedUser } from '../../fixtures/api-helpers.ts';
import { createUser, markAdminToursSeen } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const applicationIds: string[] = [];
const partnerIds: string[] = [];
const ownedUserIds: string[] = [];
const applicantEmails = {
    pendingNew: `adm15-new-${randomUUID()}@example.test`,
    pendingOld: `adm15-old-${randomUUID()}@example.test`,
    unclaimed: `adm15-unclaimed-${randomUUID()}@example.test`,
    claimed: `adm15-claimed-${randomUUID()}@example.test`,
    rejected: `adm15-rejected-${randomUUID()}@example.test`
};
const applicantEmailList = Object.values(applicantEmails);

test.describe('TEST:V8b:2 AC:V8b:2 partner application panel lists, marks overdue and resolves @p0 @admin', () => {
    test.afterAll(async () => {
        if (applicantEmailList.length) {
            await execSQL('DELETE FROM email_outbox WHERE recipient_email = ANY($1::varchar[])', [
                applicantEmailList
            ]);
            const createdUsers = await execSQL<{ id: string }>(
                'SELECT id FROM users WHERE email = ANY($1::varchar[])',
                [applicantEmailList]
            );
            ownedUserIds.push(...createdUsers.map(({ id }) => id));
        }
        if (applicationIds.length) {
            await execSQL(
                "DELETE FROM domain_event WHERE entity_type = 'partner_application' AND entity_id = ANY($1::text[])",
                [applicationIds]
            );
            await execSQL('DELETE FROM partner_application WHERE id = ANY($1::uuid[])', [
                applicationIds
            ]);
        }
        if (partnerIds.length)
            await execSQL('DELETE FROM partners WHERE id = ANY($1::uuid[])', [partnerIds]);
        if (ownedUserIds.length) await cleanupTestUsers(getDbPool(), [...new Set(ownedUserIds)]);
    });

    test('shows the three panel views and resolves each available action', async ({ page }) => {
        const admin: CreatedUser = await createUser(
            { role: 'SUPER_ADMIN' },
            { apiBaseUrl: API_URL }
        );
        const owner: CreatedUser = await createUser({}, { apiBaseUrl: API_URL });
        ownedUserIds.push(admin.id, owner.id);
        await markAdminToursSeen({ userId: admin.id });

        const partnerRows = await execSQL<{ id: string; owner_user_id: string | null }>(
            `INSERT INTO partners (slug, name, type, owner_user_id)
             VALUES ($1, 'Partner sin reclamar HOS-1496', 'business', NULL),
                    ($2, 'Partner reclamado HOS-1496', 'business', $3)
             RETURNING id, owner_user_id`,
            [`adm15-unclaimed-${randomUUID()}`, `adm15-claimed-${randomUUID()}`, owner.id]
        );
        partnerIds.push(...partnerRows.map(({ id }) => id));
        const unclaimedPartner = partnerRows.find(({ owner_user_id }) => owner_user_id === null);
        const claimedPartner = partnerRows.find(({ owner_user_id }) => owner_user_id === owner.id);
        if (!unclaimedPartner || !claimedPartner)
            throw new Error('Expected both seeded Partner ownership states.');
        const deadline = await execSQL<{ version: number }>(
            'SELECT max(version) AS version FROM vertical_deadline_version'
        );
        const deadlineVersion = deadline[0]?.version;
        if (!deadlineVersion)
            throw new Error('Expected a configured deadline version for rejection wait.');
        const seeded = await execSQL<{ id: string; email: string }>(
            `INSERT INTO partner_application (email, status, created_at, resolved_at, partner_id, deadlines_version)
             VALUES ($1, 'PENDING', now(), NULL, NULL, NULL),
                    ($2, 'PENDING', now() - interval '8 days', NULL, NULL, NULL),
                    ($3, 'APPROVED', now() - interval '2 days', now() - interval '1 day', $4, NULL),
                    ($5, 'APPROVED', now() - interval '2 days', now() - interval '1 day', $6, NULL),
                    ($7, 'REJECTED', now() - interval '2 days', now() - interval '1 day', NULL, $8)
             RETURNING id, email`,
            [
                applicantEmails.pendingNew,
                applicantEmails.pendingOld,
                applicantEmails.unclaimed,
                unclaimedPartner.id,
                applicantEmails.claimed,
                claimedPartner.id,
                applicantEmails.rejected,
                deadlineVersion
            ]
        );
        applicationIds.push(...seeded.map(({ id }) => id));
        const applicationId = (email: string) => seeded.find((row) => row.email === email)?.id;
        const pendingNewId = applicationId(applicantEmails.pendingNew);
        const pendingOldId = applicationId(applicantEmails.pendingOld);
        const unclaimedId = applicationId(applicantEmails.unclaimed);
        const claimedId = applicationId(applicantEmails.claimed);
        const rejectedId = applicationId(applicantEmails.rejected);
        if (!pendingNewId || !pendingOldId || !unclaimedId || !claimedId || !rejectedId)
            throw new Error('Expected five seeded application rows.');
        const useAdminSession = async () =>
            page.context().addCookies(
                admin.sessionCookie.split('; ').map((cookie) => {
                    const [name, ...value] = cookie.split('=');
                    return { name: (name ?? '').trim(), value: value.join('='), url: ADMIN_URL };
                })
            );
        await useAdminSession();
        await page.goto(`${ADMIN_URL}/platform/partner-applications`, {
            waitUntil: 'domcontentloaded'
        });
        const table = page.getByTestId('partner-application-panel-table');
        const oldRow = table.getByTestId(`partner-application-row-${pendingOldId}`);
        const newRow = table.getByTestId(`partner-application-row-${pendingNewId}`);
        await expect(oldRow).toBeVisible();
        await expect(
            oldRow.getByTestId(`partner-application-overdue-${pendingOldId}`)
        ).toBeVisible();
        await expect(newRow).toBeVisible();
        await expect(newRow.getByTestId(`partner-application-overdue-${pendingNewId}`)).toHaveCount(
            0
        );

        await page.getByRole('tab', { name: 'Aprobadas sin reclamar' }).click();
        const approvedTable = page.getByTestId('partner-application-panel-table');
        const unclaimedRow = approvedTable.getByTestId(`partner-application-row-${unclaimedId}`);
        await expect(unclaimedRow).toBeVisible();
        await expect(unclaimedRow).toContainText('Partner sin reclamar HOS-1496');
        await expect(approvedTable.getByText(applicantEmails.claimed)).toHaveCount(0);
        await expect(approvedTable.getByTestId(`partner-application-row-${claimedId}`)).toHaveCount(
            0
        );

        await page.getByRole('tab', { name: 'Pendientes' }).click();
        const newPendingRow = page
            .getByTestId('partner-application-panel-table')
            .getByTestId(`partner-application-row-${pendingNewId}`);
        await newPendingRow.getByRole('button', { name: 'Aprobar' }).click();
        const approveDialog = page.getByTestId('partner-application-action-dialog');
        await approveDialog.getByLabel('Nombre del Partner').fill('Partner aprobado HOS-1496');
        await approveDialog.getByLabel('Tipo de Partner').selectOption('business');
        await approveDialog.getByLabel('Motivo').fill('Aprobado en prueba e2e');
        await approveDialog.getByRole('button', { name: 'Aprobar', exact: true }).click();
        await expect
            .poll(
                async () =>
                    (
                        await execSQL<{ status: string; partner_id: string | null }>(
                            'SELECT status, partner_id FROM partner_application WHERE id = $1',
                            [pendingNewId]
                        )
                    )[0]
            )
            .toMatchObject({ status: 'APPROVED', partner_id: expect.any(String) });
        const approvedPartner = await execSQL<{ partner_id: string }>(
            'SELECT partner_id FROM partner_application WHERE id = $1',
            [pendingNewId]
        );
        if (approvedPartner[0]?.partner_id) partnerIds.push(approvedPartner[0].partner_id);

        const oldPendingRow = page
            .getByTestId('partner-application-panel-table')
            .getByTestId(`partner-application-row-${pendingOldId}`);
        await oldPendingRow.getByRole('button', { name: 'Rechazar' }).click();
        const rejectDialog = page.getByTestId('partner-application-action-dialog');
        await rejectDialog.getByLabel('Motivo').fill('Falta información');
        await rejectDialog.getByRole('button', { name: 'Rechazar', exact: true }).click();
        await expect
            .poll(
                async () =>
                    (
                        await execSQL<{ status: string }>(
                            'SELECT status FROM partner_application WHERE id = $1',
                            [pendingOldId]
                        )
                    )[0]?.status
            )
            .toBe('REJECTED');

        await page.getByRole('tab', { name: 'Rechazadas con espera' }).click();
        const rejectedRow = page
            .getByTestId('partner-application-panel-table')
            .getByTestId(`partner-application-row-${rejectedId}`);
        await expect(rejectedRow).toBeVisible();
        await rejectedRow.getByRole('button', { name: 'Anular la espera' }).click();
        const cancelDialog = page.getByTestId('partner-application-action-dialog');
        await cancelDialog.getByLabel('Motivo').fill('La espera ya no corresponde');
        await cancelDialog.getByRole('button', { name: 'Anular la espera', exact: true }).click();
        await expect
            .poll(
                async () =>
                    (
                        await execSQL<{ wait_cancelled_at: Date | null }>(
                            'SELECT wait_cancelled_at FROM partner_application WHERE id = $1',
                            [rejectedId]
                        )
                    )[0]?.wait_cancelled_at
            )
            .not.toBeNull();
    });
});
