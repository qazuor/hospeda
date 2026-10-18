import { eq, getDb, promoCodes } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    adminPromoHeaders,
    adminPromoPath,
    cleanupAdminPromoFixtures,
    createAdminPromoApp,
    promoCreateBody,
    promoRowsByCode,
    seedOpenPromoCode,
    seedPromoAdminUser
} from './admin-promo-codes-fixtures';

describe('TEST:B9b:9 (support) AC:B9b:9 HOS-1591 only SUPER_ADMIN may create, close or list codes', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    afterEach(cleanupAdminPromoFixtures);
    afterAll(async () => {
        await cleanupAdminPromoFixtures();
        await testDb.teardown();
    });

    it('returns 403 to admins with no action permission or neighboring permissions, and 401 to a guest', async () => {
        const app = createAdminPromoApp();
        const actorId = await seedPromoAdminUser('actor');
        const closableCode = `ACT-${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
        const closableId = await seedOpenPromoCode(closableCode);
        const actors = [
            {
                role: 'ADMIN',
                permissions: [PermissionEnum.ACCESS_PANEL_ADMIN],
                expectedStatus: 403
            },
            {
                role: 'ADMIN',
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.BILLING_GRANT_COMPLIMENTARY
                ],
                expectedStatus: 403
            },
            { role: '', permissions: [], expectedStatus: 401 }
        ] as const;

        for (const [index, actor] of actors.entries()) {
            const code = `DEN-${index}-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
            const headers = actor.role
                ? adminPromoHeaders({
                      id: actorId,
                      role: actor.role,
                      permissions: actor.permissions
                  })
                : adminPromoHeaders();
            const created = await app.request(adminPromoPath, {
                method: 'POST',
                headers,
                body: JSON.stringify(promoCreateBody(code))
            });
            const closed = await app.request(`${adminPromoPath}/${closableId}/close`, {
                method: 'POST',
                headers
            });
            const listed = await app.request(adminPromoPath, { headers });
            expect([created.status, closed.status, listed.status]).toEqual([
                actor.expectedStatus,
                actor.expectedStatus,
                actor.expectedStatus
            ]);
            expect(await promoRowsByCode(code)).toHaveLength(0);
            const [stillOpen] = await getDb()
                .select({ closedAt: promoCodes.closedAt })
                .from(promoCodes)
                .where(eq(promoCodes.id, closableId));
            expect(stillOpen?.closedAt).toBeNull();
        }
    });

    it('returns the factory 403 before parsing an invalid admin body', async () => {
        const app = createAdminPromoApp();
        const actorId = await seedPromoAdminUser('invalid-admin');
        const code = `bad-${crypto.randomUUID()}`;
        const response = await app.request(adminPromoPath, {
            method: 'POST',
            headers: adminPromoHeaders({
                id: actorId,
                role: 'ADMIN',
                permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
            }),
            body: JSON.stringify(promoCreateBody(code))
        });
        expect(response.status).toBe(403);
        expect(await promoRowsByCode(code)).toHaveLength(0);
    });
});
