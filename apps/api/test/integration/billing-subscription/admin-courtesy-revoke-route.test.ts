import {
    billingOptions,
    courtesyGrants,
    eq,
    getDb,
    planVersions,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
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
const adminId = '00000000-0000-4000-8000-000000000093';
const headers = () =>
    actorHeaders({
        id: adminId,
        role: 'SUPER_ADMIN',
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_GRANT_COMPLIMENTARY]
    });
const post = (id: string, body: unknown) =>
    app.request(`/api/v1/admin/billing-subscription/${id}/courtesy/revoke`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body)
    });
const confirmed = { expectedStatus: 'PAUSED', confirmed: true };
async function seedCourtesy() {
    const row = await seedSelfActive(fake, clock);
    const granted = await grantTemporaryCourtesy(
        {
            subscriptionId: row.subscriptionId,
            months: 1,
            grantedBy: row.ownerId,
            reason: 'Route refusal test'
        },
        { provider: fake, clock }
    );
    expect(granted.outcome).toBe('GRANTED');
    return row;
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
const mutationAudits = () =>
    audit.mock.calls.filter(([event]) => event.auditEvent === AuditEventType.BILLING_MUTATION);
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
    injectPaymentProvider({ provider: fake });
    await getDb().delete(courtesyGrants).where(eq(courtesyGrants.reason, 'Route refusal test'));
    await retireSelfCancelRows();
    vi.restoreAllMocks();
});
afterAll(async () => {
    await testDb.teardown();
});

describe('AC:B9b:13 administrative courtesy revocation refusals', () => {
    it('requires explicit confirmation in a strict body', async () => {
        const row = await seedCourtesy();
        const before = await snapshot(row.subscriptionId);
        const response = await post(row.subscriptionId, { expectedStatus: 'PAUSED' });
        expect(response.status).toBe(400);
        expect(await snapshot(row.subscriptionId)).toEqual(before);
    });
    it('rejects a stale expected status without changing the row', async () => {
        const row = await seedSelfActive(fake, clock);
        const before = await snapshot(row.subscriptionId);
        const response = await post(row.subscriptionId, confirmed);
        expect(response.status).toBe(409);
        expect((await response.json()).error.reason).toBe('ADMINISTRATIVE_ACTION_STATE_CHANGED');
        expect(await snapshot(row.subscriptionId)).toEqual(before);
        expect(mutationAudits()).toEqual([]);
    });
    it('rejects a customer-request pause before calling the fake', async () => {
        const row = await seedSelfActive(fake, clock);
        // The action-9 route opens this pause through the real S8 service.
        const [option] = await getDb()
            .select({ planVersionId: subscriptions.planVersionId })
            .from(subscriptions)
            .where(eq(subscriptions.id, row.subscriptionId));
        if (!option?.planVersionId) throw new Error('Missing version');
        const [oldVersion] = await getDb()
            .select({ planId: planVersions.planId })
            .from(planVersions)
            .where(eq(planVersions.id, option.planVersionId));
        if (!oldVersion) throw new Error('Missing plan');
        const [version] = await getDb()
            .insert(planVersions)
            .values({
                planId: oldVersion.planId,
                vertical: 'accommodation',
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: false,
                current: false,
                trialDays: 0,
                allowsPause: true
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('Missing pause-ready version');
        const [pauseOption] = await getDb()
            .insert(billingOptions)
            .values({ planVersionId: version.id, cycle: 'monthly', amount: 10000, currency: 'ARS' })
            .returning({ id: billingOptions.id });
        if (!pauseOption) throw new Error('Missing pause-ready option');
        await getDb()
            .update(subscriptions)
            .set({ planVersionId: version.id, billingOptionId: pauseOption.id })
            .where(eq(subscriptions.id, row.subscriptionId));
        const result = await pauseSubscription(
            { subscriptionId: row.subscriptionId, requestedMonths: 1 },
            buildPausePorts()
        );
        expect(result.outcome).toBe('PAUSED');
        const resume = vi.spyOn(fake, 'resume');
        const response = await post(row.subscriptionId, confirmed);
        expect(response.status).toBe(409);
        expect((await response.json()).error.reason).toBe('COURTESY_NOT_IN_FORCE');
        expect(resume).toHaveBeenCalledTimes(0);
        expect(mutationAudits()).toEqual([]);
    });
    it('maps a provider reread still paused to RESUME_NOT_APPLIED, keeping the row and no audit', async () => {
        const row = await seedCourtesy();
        const provider = new Proxy(fake, {
            get(target, property) {
                if (property === 'resume')
                    return async (input: Parameters<PaymentProvider['resume']>[0]) => {
                        await target.resume(input);
                        return { outcome: 'APPLIED' as const };
                    };
                if (property === 'readAuthorization')
                    return async (input: Parameters<PaymentProvider['readAuthorization']>[0]) => {
                        const read = await target.readAuthorization(input);
                        return {
                            ...read,
                            snapshot: { ...read.snapshot, status: 'paused' as const }
                        };
                    };
                const value = Reflect.get(target, property, target) as unknown;
                return typeof value === 'function' ? value.bind(target) : value;
            }
        }) as PaymentProvider;
        injectPaymentProvider({ provider });
        const response = await post(row.subscriptionId, confirmed);
        expect(response.status).toBe(409);
        expect((await response.json()).error.reason).toBe('RESUME_NOT_APPLIED');
        expect((await snapshot(row.subscriptionId)).status).toBe('PAUSED');
        expect(mutationAudits()).toEqual([]);
    });
});
