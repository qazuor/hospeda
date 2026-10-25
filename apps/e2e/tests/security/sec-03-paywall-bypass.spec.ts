/** SEC-03 — direct API writes enforce the effective-set promotion gate. */

import { expect, test } from '@playwright/test';
import { OwnerPromotionCreateRequestSchema } from '@repo/schemas';
import { createUser, markProfileCompleted } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { seedActivePlanHolder } from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const OWNER_PROMOTIONS_PATH = `${API_URL}/api/v1/protected/owner-promotions`;

test.describe('SEC-03: owner promotion gate blocks direct API bypass @p0 @security @billing', () => {
    const userIds: string[] = [];
    const createdPromotionIds: string[] = [];

    test.afterEach(async () => {
        if (createdPromotionIds.length > 0) {
            await execSQL('DELETE FROM owner_promotions WHERE id = ANY($1::uuid[])', [
                createdPromotionIds
            ]);
            createdPromotionIds.length = 0;
        }
        if (userIds.length > 0) {
            await cleanupTestUsers(getDbPool(), [...userIds]);
            userIds.length = 0;
        }
    });

    test('rejects a host without the gate key and accepts owner-basico as positive control', async () => {
        // Arrange
        const body = OwnerPromotionCreateRequestSchema.parse({
            slug: `hos1880-promo-${crypto.randomUUID()}`,
            title: 'HOS-1880 gate contract promotion',
            discountType: 'percentage',
            discountValue: 10,
            validFrom: new Date().toISOString(),
            touristAudience: 'plus'
        });
        const ownerA = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIds.push(ownerA.id);
        await markProfileCompleted({ userId: ownerA.id });

        // Act: authentication and HOST permission pass; the effective-set gate denies this write.
        const denied = await fetch(OWNER_PROMOTIONS_PATH, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                cookie: ownerA.sessionCookie,
                Origin: process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321'
            },
            body: JSON.stringify(body)
        });
        const deniedBody = await denied.text();
        expect(
            denied.status,
            `owner without create_promotions returned ${denied.status}: ${deniedBody}`
        ).toBe(403);
        expect(deniedBody).toContain('ENTITLEMENT_REQUIRED');
        expect(deniedBody).toContain('create_promotions');
        const ownerARows = await execSQL<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM owner_promotions WHERE owner_id = $1',
            [ownerA.id]
        );
        expect(
            Number(ownerARows[0]?.count ?? 0),
            'denied owner must create no promotion rows'
        ).toBe(0);

        const ownerB = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIds.push(ownerB.id);
        await markProfileCompleted({ userId: ownerB.id });
        await seedActivePlanHolder({ userId: ownerB.id, slug: 'owner-basico' });

        // Assert positive control on the same valid body.
        const accepted = await fetch(OWNER_PROMOTIONS_PATH, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                cookie: ownerB.sessionCookie,
                Origin: process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321'
            },
            body: JSON.stringify(body)
        });
        const acceptedBody = (await accepted.json()) as {
            data?: { id?: string };
            id?: string;
        };
        expect(
            accepted.status,
            `owner-basico control failed: ${JSON.stringify(acceptedBody)}`
        ).toBe(201);
        const ownerBRows = await execSQL<{ id: string }>(
            'SELECT id FROM owner_promotions WHERE owner_id = $1 AND slug = $2',
            [ownerB.id, body.slug]
        );
        const createdId = ownerBRows[0]?.id ?? acceptedBody.data?.id ?? acceptedBody.id;
        if (createdId) createdPromotionIds.push(createdId);
        expect(ownerBRows).toHaveLength(1);
    });
});
