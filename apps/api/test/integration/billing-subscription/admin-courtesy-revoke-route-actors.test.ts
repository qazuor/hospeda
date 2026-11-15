import { courtesyGrants, eq, getDb, subscriptionPauses, subscriptions } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { grantTemporaryCourtesy } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    retireSelfCancelRows,
    routeClock,
    routeFake,
    seedSelfActive
} from './self-cancel-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (original) => ({
    ...(await original<Record<string, unknown>>()),
    auditLog: audit
}));
let app: ReturnType<typeof initApp>;
const adminId = '00000000-0000-4000-8000-000000000090';
const body = { expectedStatus: 'PAUSED', confirmed: true, note: 'Admin revocation' };
const headers = (id: string, granted: boolean) =>
    actorHeaders({
        id,
        role: granted ? 'SUPER_ADMIN' : 'ADMIN',
        permissions: granted
            ? [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_GRANT_COMPLIMENTARY]
            : [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]
    });
const post = (id: string, actorId: string, granted: boolean) =>
    app.request(`/api/v1/admin/billing-subscription/${id}/courtesy/revoke`, {
        method: 'POST',
        headers: headers(actorId, granted),
        body: JSON.stringify(body)
    });
async function seedCourtesy() {
    const row = await seedSelfActive(fake, clock);
    const granted = await grantTemporaryCourtesy(
        {
            subscriptionId: row.subscriptionId,
            months: 1,
            grantedBy: row.ownerId,
            reason: 'Route test'
        },
        { provider: fake, clock }
    );
    expect(granted.outcome).toBe('GRANTED');
    if (granted.outcome !== 'GRANTED') throw new Error('Courtesy grant failed');
    return { ...row, grantId: granted.courtesyGrantId };
}
async function snapshot(id: string) {
    const [row] = await getDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    const pauses = await getDb()
        .select({ reason: subscriptionPauses.reason, actualEndAt: subscriptionPauses.actualEndAt })
        .from(subscriptionPauses)
        .where(eq(subscriptionPauses.subscriptionId, id));
    return { status: row?.status, pauses };
}
beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(() => {
    clock.set(NOW);
    injectPaymentProvider({ provider: fake });
    audit.mockClear();
});
afterEach(async () => {
    await getDb().delete(courtesyGrants).where(eq(courtesyGrants.reason, 'Route test'));
    await retireSelfCancelRows();
    vi.restoreAllMocks();
});
afterAll(async () => {
    await testDb.teardown();
});

describe('TEST:B9b:15 AC:B9b:13 administrative courtesy revocation actors', () => {
    it('refuses an admin without the complimentary permission and preserves the courtesy', async () => {
        const row = await seedCourtesy();
        const before = await snapshot(row.subscriptionId);
        const response = await post(
            row.subscriptionId,
            '00000000-0000-4000-8000-000000000091',
            false
        );
        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe('FORBIDDEN');
        expect(await snapshot(row.subscriptionId)).toEqual(before);
        expect(before.status).toBe('PAUSED');
        expect(before.pauses).toEqual([{ reason: 'COURTESY', actualEndAt: null }]);
    });

    it('refuses the subject even with the permission', async () => {
        const row = await seedCourtesy();
        const before = await snapshot(row.subscriptionId);
        const response = await post(row.subscriptionId, row.ownerId, true);
        expect(response.status).toBe(403);
        expect((await response.json()).error.reason).toBe('ADMINISTRATIVE_ACTION_FORBIDDEN');
        expect(await snapshot(row.subscriptionId)).toEqual(before);
    });

    it('resumes and audits the complete ACC_1 act with the administrator as actor', async () => {
        const row = await seedCourtesy();
        const response = await post(row.subscriptionId, adminId, true);
        expect(response.status).toBe(200);
        const data = (await response.json()).data;
        expect(data.outcome).toBe('RESUMED');
        const [stored] = await getDb()
            .select({ status: subscriptions.status, nextChargeAt: subscriptions.nextChargeAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, row.subscriptionId));
        expect(stored?.status).toBe('ACTIVE');
        expect(audit).toHaveBeenCalledWith({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: adminId,
            action: 'update',
            resourceType: 'subscription',
            resourceId: row.subscriptionId,
            metadata: {
                administrativeAction: 'ACC_1',
                act: 'REVOKE_COURTESY',
                outcome: 'RESUMED',
                subjectId: row.ownerId,
                courtesyGrantId: row.grantId,
                nextChargeAt: stored?.nextChargeAt?.toISOString() ?? null,
                note: body.note
            }
        });
    });
});
