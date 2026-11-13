import { courtesyGrants, eq, getDb, subscriptions } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    adminPromoHeaders,
    adminPromoPath,
    cleanupAdminPromoFixtures,
    createAdminPromoApp,
    promoCreateBody,
    promoRowsByCode,
    seedPromoAdminUser,
    trackPromoCode
} from '../billing-promo/admin-promo-codes-fixtures';
import {
    actorHeaders,
    NOW,
    retireSelfCancelRows,
    routeClock,
    routeFake,
    seedSelfActive,
    seedUser
} from './self-cancel-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (original) => ({
    ...(await original<Record<string, unknown>>()),
    auditLog: audit
}));
let app: ReturnType<typeof initApp>;
let adminId: string;
const reason = 'Route actor grant';
const body = { expectedStatus: 'ACTIVE', months: 2, reason, confirmed: true };
const headers = (id: string, granted: boolean) =>
    actorHeaders({
        id,
        role: granted ? 'SUPER_ADMIN' : 'ADMIN',
        permissions: granted
            ? [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_GRANT_COMPLIMENTARY]
            : [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]
    });
const post = (subscriptionId: string, actorId: string, granted: boolean) =>
    app.request(`/api/v1/admin/billing-subscription/${subscriptionId}/courtesy/grant`, {
        method: 'POST',
        headers: headers(actorId, granted),
        body: JSON.stringify(body)
    });

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(async () => {
    clock.set(NOW);
    injectPaymentProvider({ provider: fake });
    audit.mockClear();
    adminId = await seedUser('courtesy-admin');
});
afterEach(async () => {
    await getDb().delete(courtesyGrants).where(eq(courtesyGrants.reason, reason));
    await retireSelfCancelRows();
    await cleanupAdminPromoFixtures();
    vi.restoreAllMocks();
});
afterAll(async () => {
    await testDb.teardown();
});

describe('TEST:B9b:10 AC:B9b:10 administrative courtesy and promo permissions', () => {
    it('rejects a valid courtesy grant without its permission and writes no grant', async () => {
        const row = await seedSelfActive(fake, clock);
        const response = await post(row.subscriptionId, adminId, false);
        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe('FORBIDDEN');
        const [stored] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, row.subscriptionId));
        const grants = await getDb()
            .select({ id: courtesyGrants.id })
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, row.subscriptionId));
        expect(stored?.status).toBe('ACTIVE');
        expect(grants).toEqual([]);
    });

    it('rejects the subject even when it holds the permission', async () => {
        const row = await seedSelfActive(fake, clock);
        const response = await post(row.subscriptionId, row.ownerId, true);
        expect(response.status).toBe(403);
        expect((await response.json()).error.reason).toBe('ADMINISTRATIVE_ACTION_FORBIDDEN');
        const grants = await getDb()
            .select({ id: courtesyGrants.id })
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, row.subscriptionId));
        expect(grants).toEqual([]);
    });

    it('grants and audits the complete ACC_1 act against the courtesy grant', async () => {
        const row = await seedSelfActive(fake, clock);
        const response = await post(row.subscriptionId, adminId, true);
        expect(response.status).toBe(200);
        const data = (await response.json()).data;
        expect(data.outcome).toBe('GRANTED');
        expect(audit).toHaveBeenCalledWith({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: adminId,
            action: 'create',
            resourceType: 'courtesy_grant',
            resourceId: data.courtesyGrantId,
            metadata: {
                administrativeAction: 'ACC_1',
                act: 'GRANT_COURTESY',
                transition: 'S9',
                subjectId: row.ownerId,
                subscriptionId: row.subscriptionId,
                months: 2,
                endsAt: data.endsAt,
                reason
            }
        });
    });

    it('rejects creating a code without action 21 permission and leaves no code row', async () => {
        const promoApp = createAdminPromoApp();
        const actorId = await seedPromoAdminUser('courtesy-code-denied');
        const code = `CT-${crypto.randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
        const response = await promoApp.request(adminPromoPath, {
            method: 'POST',
            headers: adminPromoHeaders({
                id: actorId,
                role: 'ADMIN',
                permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
            }),
            body: JSON.stringify(promoCreateBody(code))
        });
        expect(response.status).toBe(403);
        expect(await promoRowsByCode(code)).toEqual([]);
    });

    it('creates a code with action 21 permission and audits ACC_21', async () => {
        const promoApp = createAdminPromoApp();
        const actorId = await seedPromoAdminUser('courtesy-code-allowed');
        const code = `CT-${crypto.randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
        const response = await promoApp.request(adminPromoPath, {
            method: 'POST',
            headers: adminPromoHeaders({
                id: actorId,
                role: 'SUPER_ADMIN',
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.BILLING_MANAGE_PROMO_CODES
                ]
            }),
            body: JSON.stringify(promoCreateBody(code))
        });
        expect(response.status).toBe(201);
        const data = (await response.json()).data;
        trackPromoCode(data.id);
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId,
                action: 'create',
                resourceType: 'promo_code',
                resourceId: data.id,
                metadata: expect.objectContaining({ administrativeAction: 'ACC_21', code })
            })
        );
    });
});
