import { randomUUID } from 'node:crypto';
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

test.describe('TEST:V8b:1 AC:V8b:1 partner owner sees row 22 with and without the moderation reason @p0', () => {
    test.afterAll(async () => {
        if (partnerIds.length)
            await execSQL('DELETE FROM partners WHERE id = ANY($1::uuid[])', [partnerIds]);
        if (userIds.length)
            await execSQL('DELETE FROM user_role WHERE user_id = ANY($1::uuid[])', [userIds]);
        if (userIds.length) await cleanupTestUsers(getDbPool(), userIds);
    });

    test('shows the notice for absent presence and the moderation reason for moderated presence', async ({
        page
    }) => {
        const admin: CreatedUser = await createUser(
            { role: 'SUPER_ADMIN' },
            { apiBaseUrl: API_URL }
        );
        userIds.push(admin.id);
        const owner1: CreatedUser = await createUser({}, { apiBaseUrl: API_URL });
        userIds.push(owner1.id);
        const owner2: CreatedUser = await createUser({}, { apiBaseUrl: API_URL });
        userIds.push(owner2.id);
        await markProfileCompleted({ userId: owner1.id });
        await markProfileCompleted({ userId: owner2.id });
        const reason = `Row 22 moderation ${randomUUID()}`;
        const insertPartner = async (ownerId: string, name: string) => {
            const id = randomUUID();
            const slug = `v8b-row22-${randomUUID()}`;
            await execSQL(
                `INSERT INTO partners (id, owner_user_id, slug, name, type, description, content_approved_at, created_at, updated_at) VALUES ($1, $2, $3, $4, 'business', 'Row 22 fixture', now(), now(), now())`,
                [id, ownerId, slug, name]
            );
            partnerIds.push(id);
            return { id, slug };
        };
        const first = await insertPartner(owner1.id, `Row 22 ${randomUUID()}`);
        const second = await insertPartner(owner2.id, `Row 22 ${randomUUID()}`);
        const moderation = await fetch(
            `${API_URL}/api/v1/admin/partners/${second.id}/presence-moderation`,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json', cookie: admin.sessionCookie },
                body: JSON.stringify({ action: 'MODERATE', reason })
            }
        );
        expect(moderation.status).toBe(200);

        await seedCookieConsent(page);
        await attachSession({ page, sessionCookie: owner1.sessionCookie });
        await page.goto(`${WEB_URL}/es/mi-cuenta/partner/`);
        const firstNotice = page.getByTestId('partner-presence-notice');
        await expect(firstNotice).toBeVisible();
        await expect(firstNotice.getByTestId('partner-presence-moderated')).toHaveCount(0);

        await attachSession({ page, sessionCookie: owner2.sessionCookie });
        await page.goto(`${WEB_URL}/es/mi-cuenta/partner/`);
        const secondNotice = page.getByTestId('partner-presence-notice');
        await expect(secondNotice).toBeVisible();
        await expect(secondNotice.getByTestId('partner-presence-moderated')).toBeVisible();
        await expect(secondNotice.getByTestId('partner-presence-moderation-reason')).toHaveText(
            reason
        );
        expect(first.slug).not.toBe(second.slug);
    });
});
