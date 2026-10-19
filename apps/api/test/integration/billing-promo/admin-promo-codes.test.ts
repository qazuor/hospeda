import { eq, getDb, promoRedemptions } from '@repo/db';
import { AdminPromoCodeCloseResponseSchema, AdminPromoCodeSchema } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    adminPromoClock,
    adminPromoHeaders,
    adminPromoPath,
    adminPromoPermissions,
    cleanupAdminPromoFixtures,
    createAdminPromoApp,
    promoCreateBody,
    promoRowsByCode,
    seedPromoAdminUser,
    trackPromoCode
} from './admin-promo-codes-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

describe('TEST:B9b:9 (support) AC:B9b:9 HOS-1591 admin action 21 routes', () => {
    let app: ReturnType<typeof createAdminPromoApp>;
    let adminId: string;

    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = createAdminPromoApp();
        adminId = await seedPromoAdminUser('super');
    });
    afterEach(async () => {
        await cleanupAdminPromoFixtures();
        audit.mockClear();
    });
    afterAll(async () => {
        await cleanupAdminPromoFixtures();
        await testDb.teardown();
    });

    it('(a-g) creates, rejects duplicates and invalid input, closes, blocks redemption, lists and audits', async () => {
        const code = `API-${crypto.randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
        const headers = adminPromoHeaders({
            id: adminId,
            role: 'SUPER_ADMIN',
            permissions: adminPromoPermissions
        });
        const createdResponse = await app.request(adminPromoPath, {
            method: 'POST',
            headers,
            body: JSON.stringify(promoCreateBody(code))
        });
        expect(createdResponse.status).toBe(201);
        const created = AdminPromoCodeSchema.parse((await createdResponse.json()).data);
        trackPromoCode(created.id);
        expect(created).toMatchObject({
            code,
            effect: {
                kind: 'DISCOUNT',
                discountKind: 'FIXED',
                value: 500,
                durationKind: 'N_CHARGES',
                durationCharges: 3
            },
            allVerticals: false,
            totalQuota: 20,
            availability: 'OPEN'
        });
        expect(await promoRowsByCode(code)).toHaveLength(1);

        const duplicate = await app.request(adminPromoPath, {
            method: 'POST',
            headers,
            body: JSON.stringify(promoCreateBody(code))
        });
        expect(duplicate.status).toBe(409);
        expect((await duplicate.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'PROMO_CODE_ALREADY_EXISTS'
        });

        const invalidCode = `bad-${crypto.randomUUID()}`;
        const invalid = await app.request(adminPromoPath, {
            method: 'POST',
            headers,
            body: JSON.stringify(promoCreateBody(invalidCode))
        });
        expect(invalid.status).toBe(400);
        expect(await promoRowsByCode(invalidCode)).toHaveLength(0);

        const previousUserId = await seedPromoAdminUser('previous-redeemer');
        await getDb().insert(promoRedemptions).values({
            promoCodeId: created.id,
            userId: previousUserId,
            subscriptionId: null,
            remainingCharges: null,
            redeemedAt: adminPromoClock.now()
        });
        const closePath = `${adminPromoPath}/${created.id}/close`;
        const closedResponse = await app.request(closePath, { method: 'POST', headers });
        expect(closedResponse.status).toBe(200);
        const closed = AdminPromoCodeCloseResponseSchema.parse((await closedResponse.json()).data);
        expect(closed).toMatchObject({
            promoCodeId: created.id,
            closedBy: adminId,
            redemptionCount: 1
        });
        const previousRedemptions = await getDb()
            .select()
            .from(promoRedemptions)
            .where(eq(promoRedemptions.promoCodeId, created.id));
        expect(previousRedemptions).toHaveLength(1);
        expect(previousRedemptions[0]?.remainingCharges).toBeNull();

        const repeated = await app.request(closePath, { method: 'POST', headers });
        expect(repeated.status).toBe(409);
        expect((await repeated.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'PROMO_CODE_ALREADY_CLOSED'
        });
        const missing = await app.request(`${adminPromoPath}/${crypto.randomUUID()}/close`, {
            method: 'POST',
            headers
        });
        expect(missing.status).toBe(404);
        expect((await missing.json()).error).toMatchObject({
            code: 'NOT_FOUND',
            reason: 'PROMO_CODE_NOT_FOUND'
        });

        const ownerId = await seedPromoAdminUser('redeem-owner');
        const redeemed = await app.request('/api/v1/protected/billing/promo-codes/redeem', {
            method: 'POST',
            headers: adminPromoHeaders({ id: ownerId, role: 'USER', permissions: [] }),
            body: JSON.stringify({ code, vertical: 'accommodation' })
        });
        expect(redeemed.status).toBe(422);
        expect((await redeemed.json()).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: 'PROMO_CODE_NOT_AVAILABLE'
        });

        const listed = await app.request(`${adminPromoPath}?page=1&pageSize=100`, {
            headers
        });
        expect(listed.status).toBe(200);
        const listedBody = await listed.json();
        const row = listedBody.data.items.find((item: { id: string }) => item.id === created.id);
        expect(AdminPromoCodeSchema.parse(row)).toMatchObject({
            id: created.id,
            availability: 'CLOSED',
            redemptionCount: 1
        });

        const writes = audit.mock.calls
            .map(([entry]) => entry as Record<string, unknown>)
            .filter((entry) => entry.auditEvent === AuditEventType.BILLING_MUTATION);
        expect(writes).toHaveLength(2);
        expect(writes[0]).toMatchObject({
            action: 'create',
            resourceType: 'promo_code',
            resourceId: created.id,
            metadata: expect.objectContaining({ administrativeAction: 'ACC_21', code })
        });
        expect(writes[1]).toMatchObject({
            action: 'update',
            resourceType: 'promo_code',
            resourceId: created.id,
            metadata: expect.objectContaining({
                administrativeAction: 'ACC_21',
                operation: 'close'
            })
        });
    });
});
