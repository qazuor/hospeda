import { courtesyGrants, eq, getDb, subscriptions } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { grantTemporaryCourtesy, pauseSubscription } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { buildPausePorts } from '../../../src/routes/billing-subscription/pause-ports';
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
const reason = 'Revoke preview test';
const headers = () =>
    actorHeaders({
        id: adminId,
        role: 'SUPER_ADMIN',
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_GRANT_COMPLIMENTARY]
    });
const preview = (id: string) =>
    app.request(`/api/v1/admin/billing-subscription/${id}/courtesy/revoke-preview`, {
        headers: headers()
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
    adminId = await seedUser('courtesy-revoke-preview-admin');
});
afterEach(async () => {
    await getDb().delete(courtesyGrants).where(eq(courtesyGrants.reason, reason));
    await retireSelfCancelRows();
    vi.restoreAllMocks();
});
afterAll(async () => {
    await testDb.teardown();
});

describe('AC:B9b:14 administrative courtesy revoke preview', () => {
    it('shows the live end and a future cycle-aligned charge for PAUSED COURTESY', async () => {
        const row = await seedSelfActive(fake, clock);
        const granted = await grantTemporaryCourtesy(
            { subscriptionId: row.subscriptionId, months: 2, grantedBy: adminId, reason },
            { provider: fake, clock }
        );
        expect(granted.outcome).toBe('GRANTED');
        await getDb()
            .update(subscriptions)
            .set({ nextChargeAt: new Date('2026-08-14T12:00:00.000Z') })
            .where(eq(subscriptions.id, row.subscriptionId));
        const response = await preview(row.subscriptionId);
        expect(response.status).toBe(200);
        const data = (await response.json()).data;
        expect(data).toMatchObject({
            inForce: true,
            status: 'PAUSED',
            cycle: 'monthly',
            courtesy: {
                courtesyGrantId: granted.outcome === 'GRANTED' ? granted.courtesyGrantId : '',
                endsAt: granted.outcome === 'GRANTED' ? granted.endsAt.toISOString() : ''
            },
            predictedNextChargeAt: '2026-10-14T12:00:00.000Z'
        });
        expect(new Date(data.predictedNextChargeAt).getTime()).toBeGreaterThan(NOW.getTime());
        expect(audit).toHaveBeenCalledWith({
            auditEvent: AuditEventType.BILLING_READ,
            actorId: adminId,
            resourceType: 'subscription',
            resourceId: row.subscriptionId,
            metadata: { subjectId: row.ownerId }
        });
    });

    it('reports no courtesy for a customer-request pause', async () => {
        const row = await seedSelfActive(fake, clock);
        const paused = await pauseSubscription(
            { subscriptionId: row.subscriptionId, requestedMonths: 1 },
            {
                ...buildPausePorts(),
                planPolicy: async () => ({
                    graceDays: 7,
                    allowsPause: true,
                    current: true,
                    sellable: true
                })
            }
        );
        expect(paused.outcome).toBe('PAUSED');
        const response = await preview(row.subscriptionId);
        expect(response.status).toBe(200);
        expect((await response.json()).data).toMatchObject({
            inForce: false,
            reason: 'COURTESY_NOT_IN_FORCE',
            courtesy: null,
            predictedNextChargeAt: null
        });
    });

    it('returns 404 for an unknown subscription', async () => {
        const response = await preview(crypto.randomUUID());
        expect(response.status).toBe(404);
        expect((await response.json()).error.reason).toBe('SUBSCRIPTION_NOT_FOUND');
    });
});
