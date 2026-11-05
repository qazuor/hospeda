import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { CreatedUser } from '../../fixtures/api-helpers.ts';
import { createUser, markProfileCompleted } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { attachSession } from '../../fixtures/listing-notices.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const partnerIds: string[] = [];
const userIds: string[] = [];

test.describe('TEST:V8b:4 AC:V8b:4 an account that owns a Partner claims a second one and sees row 33 @p0 @verticals', () => {
    test.afterAll(async () => {
        if (partnerIds.length)
            await execSQL('DELETE FROM partners WHERE id = ANY($1::uuid[])', [partnerIds]);
        if (userIds.length)
            await execSQL('DELETE FROM user_role WHERE user_id = ANY($1::uuid[])', [userIds]);
        if (userIds.length) await cleanupTestUsers(getDbPool(), userIds);
    });

    test('shows row 33 and leaves the claim link available to another account', async ({
        page,
        browser
    }) => {
        const ownerA: CreatedUser = await createUser({}, { apiBaseUrl: API_URL });
        userIds.push(ownerA.id);
        await markProfileCompleted({ userId: ownerA.id });
        const partnerAId = randomUUID();
        const partnerASlug = `v8b-row33-${randomUUID()}`;
        await execSQL(
            `INSERT INTO partners (id, owner_user_id, slug, name, type, created_at, updated_at) VALUES ($1, $2, $3, $4, 'business', now(), now())`,
            [partnerAId, ownerA.id, partnerASlug, `V8b Row 33 A ${randomUUID()}`]
        );
        partnerIds.push(partnerAId);

        const claimant2: CreatedUser = await createUser({}, { apiBaseUrl: API_URL });
        userIds.push(claimant2.id);
        await markProfileCompleted({ userId: claimant2.id });
        const partnerBId = randomUUID();
        const partnerBSlug = `v8b-row33-${randomUUID()}`;
        await execSQL(
            `INSERT INTO partners (id, owner_user_id, slug, name, type, created_at, updated_at) VALUES ($1, NULL, $2, $3, 'business', now(), now())`,
            [partnerBId, partnerBSlug, `V8b Row 33 B ${randomUUID()}`]
        );
        partnerIds.push(partnerBId);
        const secret = randomBytes(32).toString('base64url');
        const secretHash = createHash('sha256').update(secret, 'utf8').digest('hex');
        await execSQL('UPDATE partners SET claim_secret_hash = $2 WHERE id = $1', [
            partnerBId,
            secretHash
        ]);
        const claimUrl = `${WEB_URL}/es/partners/reclamar/#partner=${partnerBId}&secret=${encodeURIComponent(secret)}`;

        await seedCookieConsent(page);
        await attachSession({ page, sessionCookie: ownerA.sessionCookie });
        await page.goto(claimUrl);
        await page.getByRole('button', { name: 'Reclamar el Partner' }).click();
        const row33 =
            'Tu cuenta ya es dueña de un Partner. Cada cuenta administra un solo Partner: el segundo negocio se reclama con otra cuenta. Si necesitás ayuda, escribinos a soporte.';
        await expect(page.getByText(row33)).toBeVisible();
        const supportLink = page.getByRole('link', { name: 'Escribir a soporte' });
        await expect(supportLink).toBeVisible();
        await expect(supportLink).toHaveAttribute('href', /\/es\/contacto/);
        await expect(page.getByText('Listo: el Partner quedó vinculado a tu cuenta.')).toHaveCount(
            0
        );
        expect(page.url()).not.toContain(secret);

        const partnerB = await execSQL<{
            owner_user_id: string | null;
            claim_secret_hash: string | null;
        }>('SELECT owner_user_id, claim_secret_hash FROM partners WHERE id = $1', [partnerBId]);
        expect(partnerB).toEqual([{ owner_user_id: null, claim_secret_hash: secretHash }]);
        const claimedEvents = await execSQL<{ count: number }>(
            "SELECT count(*)::int AS count FROM domain_event WHERE entity_id = $1 AND event_type = 'partner.claimed'",
            [partnerBId]
        );
        expect(claimedEvents).toEqual([{ count: 0 }]);
        const partnerA = await execSQL<{ owner_user_id: string | null }>(
            'SELECT owner_user_id FROM partners WHERE id = $1',
            [partnerAId]
        );
        expect(partnerA).toEqual([{ owner_user_id: ownerA.id }]);

        const claimantContext = await browser.newContext();
        try {
            const claimantPage = await claimantContext.newPage();
            await seedCookieConsent(claimantPage);
            await attachSession({ page: claimantPage, sessionCookie: claimant2.sessionCookie });
            await claimantPage.goto(claimUrl);
            await claimantPage.getByRole('button', { name: 'Reclamar el Partner' }).click();
            await expect(
                claimantPage.getByText('Listo: el Partner quedó vinculado a tu cuenta.')
            ).toBeVisible();
            await expect(
                claimantPage.getByRole('link', { name: 'Ir a Mi Cuenta de Partner' })
            ).toBeVisible();
            const claimedPartner = await execSQL<{ owner_user_id: string | null }>(
                'SELECT owner_user_id FROM partners WHERE id = $1',
                [partnerBId]
            );
            expect(claimedPartner).toEqual([{ owner_user_id: claimant2.id }]);
        } finally {
            await claimantContext.close();
        }
    });
});
