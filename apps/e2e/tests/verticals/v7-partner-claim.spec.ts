import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { PartnerApplicationApproveSchema } from '@repo/schemas';
import type { CreatedUser } from '../../fixtures/api-helpers.ts';
import { createUser, markProfileCompleted, signupUser } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { attachSession } from '../../fixtures/listing-notices.ts';
import { cleanupManualArrearsRows } from '../../fixtures/manual-arrears.ts';
import { activatePartnerPlan, assignPartnerSlug } from '../../fixtures/partner-lifecycle.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const applicationIds: string[] = [];
const partnerIds: string[] = [];
const userIds: string[] = [];
const applicationEmails: string[] = [];

test.describe('TEST:V7:22 AC:V7:19 AC:V7:7 Partner application, claim, and Gold public page @p0 @verticals', () => {
    test.afterAll(async () => {
        // The helper removes payment rows and test users; deleting users nulls Partner owners.
        if (userIds.length) await cleanupManualArrearsRows({ userIds });
        if (partnerIds.length)
            await execSQL('DELETE FROM partners WHERE id = ANY($1::uuid[])', [partnerIds]);
        if (applicationEmails.length)
            await execSQL('DELETE FROM email_outbox WHERE recipient_email = ANY($1::text[])', [
                applicationEmails
            ]);
        if (applicationIds.length)
            await execSQL('DELETE FROM partner_application WHERE id = ANY($1::uuid[])', [
                applicationIds
            ]);
        // domain_event is append-only (migration 0131 and trigger 056 reject DELETE).
        if (userIds.length) await cleanupTestUsers(getDbPool(), userIds);
    });

    test('submits PP1, approves, claims, and exposes the Gold page only after MP1', async ({
        page
    }) => {
        const admin: CreatedUser = await createUser(
            { role: 'SUPER_ADMIN' },
            { apiBaseUrl: API_URL }
        );
        userIds.push(admin.id);
        const email = `v7-${randomUUID()}@hospeda-test.local`;
        const partnerName = `V7 Gold ${randomUUID()}`;
        await seedCookieConsent(page);
        await page.goto(`${WEB_URL}/es/sumate/partner/`);
        await page.locator('#partner-application-email').fill(email);
        const submitResponse = page.waitForResponse(
            (response) =>
                response.url().includes('/api/v1/public/partner-applications') &&
                response.request().method() === 'POST'
        );
        await expect(page.getByRole('button', { name: /sum|enviar|postul/i })).toBeEnabled();
        await page.getByRole('button', { name: /sum|enviar|postul/i }).click();
        const pp1 = await submitResponse;
        expect(pp1.status()).toBe(200);
        await expect(page.getByRole('status')).toBeVisible();

        const [application] = await execSQL<{
            id: string;
            status: string;
            partner_id: string | null;
        }>('SELECT id, status, partner_id FROM partner_application WHERE email = $1', [email]);
        if (!application) throw new Error('Expected PP1 to create one application.');
        expect(application).toEqual({
            id: expect.any(String),
            status: 'PENDING',
            partner_id: null
        });
        applicationIds.push(application.id);
        applicationEmails.push(email);
        const leads = await execSQL<{ id: string }>(
            'SELECT id FROM alliance_leads WHERE email = $1',
            [email]
        );
        expect(leads).toEqual([]);

        const claimant: CreatedUser = await signupUser(
            { email, name: `V7 claimant ${randomUUID()}` },
            { apiBaseUrl: API_URL }
        );
        userIds.push(claimant.id);
        await markProfileCompleted({ userId: claimant.id });
        const approvalInput = PartnerApplicationApproveSchema.parse({
            name: partnerName,
            type: 'business',
            reason: `Approved by TEST:V7:22 ${randomUUID()}`
        });
        const approval = await fetch(
            `${API_URL}/api/v1/admin/partner-applications/${application.id}/approve`,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json', cookie: admin.sessionCookie },
                body: JSON.stringify(approvalInput)
            }
        );
        expect(approval.status).toBe(200);
        const approvalBody = (await approval.json()) as {
            readonly data?: { readonly partnerId?: string };
        };
        const partnerId = approvalBody.data?.partnerId;
        if (!partnerId) throw new Error('The PP2 response did not include the Partner id.');
        partnerIds.push(partnerId);
        const slug = await assignPartnerSlug(partnerId);

        const secret = randomBytes(32).toString('base64url');
        const secretHash = createHash('sha256').update(secret, 'utf8').digest('hex');
        await execSQL('UPDATE partners SET claim_secret_hash = $2 WHERE id = $1', [
            partnerId,
            secretHash
        ]);
        const claimUrl = `${WEB_URL}/es/partners/reclamar/#partner=${partnerId}&secret=${encodeURIComponent(secret)}`;
        await seedCookieConsent(page);
        await page.goto(claimUrl);
        await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
        await page.getByRole('button', { name: 'Iniciar sesión' }).click();
        await expect(page).toHaveURL(/\/es\/auth\/signin\/\?returnUrl=/);
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
        const role = await execSQL<{ has_role: boolean }>(
            `SELECT EXISTS (SELECT 1 FROM user_role WHERE user_id = $1 AND role = 'PARTNER_OWNER') AS has_role`,
            [claimant.id]
        );
        expect(role[0]?.has_role).toBe(true);

        const withoutPlan = await fetch(`${API_URL}/api/v1/public/partners/${slug}`);
        expect(withoutPlan.status).toBe(404);
        await seedCookieConsent(page);
        const absentPage = await page.goto(`${WEB_URL}/es/partners/${slug}/`);
        expect(absentPage?.status()).toBe(404);

        await activatePartnerPlan({
            apiUrl: API_URL,
            adminCookie: admin.sessionCookie,
            partnerId,
            plan: 'partner-gold'
        });
        await expect
            .poll(async () => (await fetch(`${API_URL}/api/v1/public/partners/${slug}`)).status)
            .toBe(200);
        await seedCookieConsent(page);
        await page.goto(`${WEB_URL}/es/partners/${slug}/`);
        await expect(page.locator('h1')).toHaveText(partnerName);

        const silverEmail = `v7-silver-${randomUUID()}@hospeda-test.local`;
        applicationEmails.push(silverEmail);
        const silverSubmission = await fetch(`${API_URL}/api/v1/public/partner-applications`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                email: silverEmail,
                cfTurnstileToken: '1x0000000000000000000000000000000AA'
            })
        });
        expect(silverSubmission.status).toBe(200);
        const [silverApplication] = await execSQL<{ id: string; status: string }>(
            'SELECT id, status FROM partner_application WHERE email = $1',
            [silverEmail]
        );
        if (!silverApplication) throw new Error('Expected the Silver application.');
        applicationIds.push(silverApplication.id);
        expect(silverApplication.status).toBe('PENDING');
        const silverOwner = await signupUser(
            { email: silverEmail, name: `V7 Silver claimant ${randomUUID()}` },
            { apiBaseUrl: API_URL }
        );
        userIds.push(silverOwner.id);
        const silverName = `V7 Silver ${randomUUID()}`;
        const silverApproval = await fetch(
            `${API_URL}/api/v1/admin/partner-applications/${silverApplication.id}/approve`,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json', cookie: admin.sessionCookie },
                body: JSON.stringify(
                    PartnerApplicationApproveSchema.parse({
                        name: silverName,
                        type: 'business',
                        reason: `Silver control ${randomUUID()}`
                    })
                )
            }
        );
        expect(silverApproval.status).toBe(200);
        const silverApprovalBody = (await silverApproval.json()) as {
            readonly data?: { readonly partnerId?: string };
        };
        const silverPartnerId = silverApprovalBody.data?.partnerId;
        if (!silverPartnerId) throw new Error('The Silver PP2 response omitted the Partner id.');
        partnerIds.push(silverPartnerId);
        const silverSlug = await assignPartnerSlug(silverPartnerId);
        const silverSecret = randomBytes(32).toString('base64url');
        await execSQL('UPDATE partners SET claim_secret_hash = $2 WHERE id = $1', [
            silverPartnerId,
            createHash('sha256').update(silverSecret, 'utf8').digest('hex')
        ]);
        await seedCookieConsent(page);
        await attachSession({ page, sessionCookie: silverOwner.sessionCookie });
        await page.goto(
            `${WEB_URL}/es/partners/reclamar/#partner=${silverPartnerId}&secret=${encodeURIComponent(silverSecret)}`
        );
        await page.getByRole('button', { name: 'Reclamar el Partner' }).click();
        await expect(
            page.getByText('Listo: el Partner quedó vinculado a tu cuenta.')
        ).toBeVisible();
        await activatePartnerPlan({
            apiUrl: API_URL,
            adminCookie: admin.sessionCookie,
            partnerId: silverPartnerId,
            plan: 'partner-silver'
        });
        const silverPage = await fetch(`${API_URL}/api/v1/public/partners/${silverSlug}`);
        expect(silverPage.status).toBe(404);
        await seedCookieConsent(page);
        const absentSilverPage = await page.goto(`${WEB_URL}/es/partners/${silverSlug}/`);
        expect(absentSilverPage?.status()).toBe(404);

        const replayPage = await page.context().newPage();
        const otherClaimant: CreatedUser = await createUser({}, { apiBaseUrl: API_URL });
        userIds.push(otherClaimant.id);
        await seedCookieConsent(replayPage);
        await attachSession({ page: replayPage, sessionCookie: otherClaimant.sessionCookie });
        await replayPage.goto(claimUrl);
        await replayPage.getByRole('button', { name: 'Reclamar el Partner' }).click();
        await expect(
            replayPage.getByText(
                'Este Partner ya tiene dueño; si no fuiste vos, escribinos a soporte'
            )
        ).toBeVisible();
        await replayPage.close();

        const tamperedPage = await page.context().newPage();
        await seedCookieConsent(tamperedPage);
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
