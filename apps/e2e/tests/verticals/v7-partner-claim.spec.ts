import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { PartnerApplicationApproveSchema } from '@repo/schemas';
import type { CreatedUser } from '../../fixtures/api-helpers.ts';
import { createUser } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { attachSession } from '../../fixtures/listing-notices.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const applicationIds: string[] = [];
const partnerIds: string[] = [];
const userIds: string[] = [];

test.describe('TEST:V7:22 AC:V7:7 partner claim by link with a session @p0', () => {
    test.afterAll(async () => {
        if (applicationIds.length) {
            const applications = await execSQL<{ email: string }>(
                'SELECT email FROM partner_application WHERE id = ANY($1::uuid[])',
                [applicationIds]
            );
            if (applications.length) {
                await execSQL('DELETE FROM email_outbox WHERE recipient_email = ANY($1::text[])', [
                    applications.map(({ email }) => email)
                ]);
            }
            // domain_event is append-only (migration 0131 and trigger 056 reject DELETE).
            await execSQL('DELETE FROM partner_application WHERE id = ANY($1::uuid[])', [
                applicationIds
            ]);
        }
        if (userIds.length) {
            await execSQL('DELETE FROM user_role WHERE user_id = ANY($1::uuid[])', [userIds]);
        }
        if (partnerIds.length) {
            await execSQL('DELETE FROM partners WHERE id = ANY($1::uuid[])', [partnerIds]);
        }
        if (userIds.length) await cleanupTestUsers(getDbPool(), userIds);
    });

    test('approves an application and lets the signed-in claimant own the Partner', async ({
        page
    }) => {
        const admin: CreatedUser = await createUser(
            { role: 'SUPER_ADMIN' },
            { apiBaseUrl: API_URL }
        );
        userIds.push(admin.id);
        const applicant: CreatedUser = await createUser({}, { apiBaseUrl: API_URL });
        userIds.push(applicant.id);
        const claimant: CreatedUser = await createUser({}, { apiBaseUrl: API_URL });
        userIds.push(claimant.id);

        const [application] = await execSQL<{ id: string }>(
            `INSERT INTO partner_application (email, status, created_at, resolved_at, partner_id, deadlines_version)
             VALUES ($1, 'PENDING', now(), NULL, NULL, NULL)
             RETURNING id`,
            [applicant.email]
        );
        if (!application) throw new Error('Expected the seeded partner application.');
        applicationIds.push(application.id);

        const approvalInput = PartnerApplicationApproveSchema.parse({
            name: `Partner claim e2e ${randomUUID()}`,
            type: 'business',
            reason: 'Approved by the HOS-1486 end-to-end test.'
        });
        const approval = await fetch(
            `${API_URL}/api/v1/admin/partner-applications/${application.id}/approve`,
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    cookie: admin.sessionCookie
                },
                body: JSON.stringify(approvalInput)
            }
        );
        expect(approval.status).toBe(200);
        const approvalBody = (await approval.json()) as {
            readonly data?: { readonly partnerId?: string };
        };
        const partnerId = approvalBody.data?.partnerId;
        if (!partnerId)
            throw new Error('The admin approval response did not include a Partner id.');
        partnerIds.push(partnerId);

        const secret = randomBytes(32).toString('base64url');
        const secretHash = createHash('sha256').update(secret, 'utf8').digest('hex');
        await execSQL('UPDATE partners SET claim_secret_hash = $2 WHERE id = $1', [
            partnerId,
            secretHash
        ]);

        const claimUrl = `${WEB_URL}/es/partners/reclamar/#partner=${partnerId}&secret=${encodeURIComponent(secret)}`;
        // The consent backdrop intercepts the click on the sign-in button.
        await seedCookieConsent(page);
        await page.goto(claimUrl);
        await expect(
            page.getByText(
                'Para reclamar el Partner, iniciá sesión con la cuenta con la que lo vas a administrar. Esa cuenta queda como dueña.'
            )
        ).toBeVisible();
        await expect.poll(() => new URL(page.url()).hash).toBe('');
        await page.getByRole('button', { name: 'Iniciar sesión' }).click();
        await expect(page).toHaveURL(/\/es\/auth\/signin\/\?returnUrl=/);
        expect(page.url()).toContain('returnUrl');
        expect(page.url().includes(secret)).toBe(false);
        expect(page.url()).not.toContain(partnerId);

        const returnUrl = new URL(page.url()).searchParams.get('returnUrl');
        expect(returnUrl).toBe('/es/partners/reclamar/');
        await attachSession({ page, sessionCookie: claimant.sessionCookie });
        await page.goto(`${WEB_URL}${returnUrl}`);
        await page.getByRole('button', { name: 'Reclamar el Partner' }).click();
        await expect(
            page.getByText('Listo: el Partner quedó vinculado a tu cuenta.')
        ).toBeVisible();

        const owner = await execSQL<{ owner_user_id: string | null }>(
            'SELECT owner_user_id FROM partners WHERE id = $1',
            [partnerId]
        );
        expect(owner[0]?.owner_user_id).toBe(claimant.id);
        const claimantRole = await execSQL<{ has_role: boolean }>(
            `SELECT EXISTS (
                 SELECT 1 FROM user_role WHERE user_id = $1 AND role = 'PARTNER_OWNER'
             ) AS has_role`,
            [claimant.id]
        );
        expect(claimantRole[0]?.has_role).toBe(true);
        const applicantRole = await execSQL<{ has_role: boolean }>(
            `SELECT EXISTS (
                 SELECT 1 FROM user_role WHERE user_id = $1 AND role = 'PARTNER_OWNER'
             ) AS has_role`,
            [applicant.id]
        );
        expect(applicantRole[0]?.has_role).toBe(false);
        const applicationState = await execSQL<{ status: string }>(
            'SELECT status FROM partner_application WHERE id = $1',
            [application.id]
        );
        expect(applicationState[0]?.status).toBe('APPROVED');
        const hashUnchanged = await execSQL<{ unchanged: boolean }>(
            'SELECT claim_secret_hash = $2 AS unchanged FROM partners WHERE id = $1',
            [partnerId, secretHash]
        );
        expect(hashUnchanged[0]?.unchanged).toBe(true);

        const replayPage = await page.context().newPage();
        const otherClaimant: CreatedUser = await createUser({}, { apiBaseUrl: API_URL });
        userIds.push(otherClaimant.id);
        await attachSession({ page: replayPage, sessionCookie: otherClaimant.sessionCookie });
        await replayPage.goto(claimUrl);
        await replayPage.getByRole('button', { name: 'Reclamar el Partner' }).click();
        await expect(
            replayPage.getByText(
                'Este Partner ya tiene dueño; si no fuiste vos, escribinos a soporte'
            )
        ).toBeVisible();

        await replayPage.close();

        // A hash-only change on the same path does not reload the page, so the
        // tampered link opens in a fresh page, as a pasted link would.
        const tamperedPage = await page.context().newPage();
        await attachSession({ page: tamperedPage, sessionCookie: otherClaimant.sessionCookie });
        await tamperedPage.goto(
            `${WEB_URL}/es/partners/reclamar/#partner=${partnerId}&secret=${encodeURIComponent(`${secret}x`)}`
        );
        await tamperedPage.getByRole('button', { name: 'Reclamar el Partner' }).click();
        await expect(
            tamperedPage.getByText('No encontramos este Partner. Revisá que el link esté completo.')
        ).toBeVisible();
        await tamperedPage.close();
    });
});
