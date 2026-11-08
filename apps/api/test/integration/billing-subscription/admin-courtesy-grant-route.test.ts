import {
    and,
    billingOptions,
    courtesyGrants,
    eq,
    getDb,
    isNull,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
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
const reason = 'Route grant behavior';
const headers = () =>
    actorHeaders({
        id: adminId,
        role: 'SUPER_ADMIN',
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_GRANT_COMPLIMENTARY]
    });
const body = { expectedStatus: 'ACTIVE', months: 2, reason, confirmed: true };
const post = (subscriptionId: string, input: unknown) =>
    app.request(`/api/v1/admin/billing-subscription/${subscriptionId}/courtesy/grant`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(input)
    });
const preview = (subscriptionId: string, months = 2) =>
    app.request(
        `/api/v1/admin/billing-subscription/${subscriptionId}/courtesy/grant-preview?months=${months}`,
        { headers: headers() }
    );
const mutationAudits = () =>
    audit.mock.calls.filter(([event]) => event.auditEvent === AuditEventType.BILLING_MUTATION);
const optionIds: string[] = [];
const optionResets: { readonly subscriptionId: string; readonly billingOptionId: string }[] = [];

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
    injectPaymentProvider({ provider: fake });
    await getDb().delete(courtesyGrants).where(eq(courtesyGrants.reason, reason));
    for (const reset of optionResets.splice(0))
        await getDb()
            .update(subscriptions)
            .set({ billingOptionId: reset.billingOptionId })
            .where(eq(subscriptions.id, reset.subscriptionId));
    await retireSelfCancelRows();
    for (const id of optionIds.splice(0))
        await getDb().delete(billingOptions).where(eq(billingOptions.id, id));
    vi.restoreAllMocks();
});
afterAll(async () => {
    await testDb.teardown();
});

describe('AC:B9b:10 AC:B9b:14 administrative courtesy grant', () => {
    it('requires explicit confirmation', async () => {
        const row = await seedSelfActive(fake, clock);
        const response = await post(row.subscriptionId, {
            expectedStatus: 'ACTIVE',
            months: 2,
            reason
        });
        expect(response.status).toBe(400);
        const [stored] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, row.subscriptionId));
        expect(stored?.status).toBe('ACTIVE');
    });

    it('rejects a stale expected status before the service changes the row', async () => {
        const row = await seedSelfActive(fake, clock);
        const response = await post(row.subscriptionId, { ...body, expectedStatus: 'PAUSED' });
        expect(response.status).toBe(409);
        expect((await response.json()).error.reason).toBe('ADMINISTRATIVE_ACTION_STATE_CHANGED');
        const [stored] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, row.subscriptionId));
        expect(stored?.status).toBe('ACTIVE');
        expect(mutationAudits()).toEqual([]);
    });

    it('refuses an annual plan before calling the provider and previews its alternatives', async () => {
        const row = await seedSelfActive(fake, clock);
        const [current] = await getDb()
            .select({
                planVersionId: subscriptions.planVersionId,
                billingOptionId: subscriptions.billingOptionId
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, row.subscriptionId));
        if (!current?.planVersionId || !current.billingOptionId)
            throw new Error('Missing plan version or option');
        const [annual] = await getDb()
            .insert(billingOptions)
            .values({
                planVersionId: current.planVersionId,
                cycle: 'annual',
                amount: 10000,
                currency: 'ARS'
            })
            .returning({ id: billingOptions.id });
        if (!annual) throw new Error('Missing annual option');
        optionIds.push(annual.id);
        optionResets.push({
            subscriptionId: row.subscriptionId,
            billingOptionId: current.billingOptionId
        });
        await getDb()
            .update(subscriptions)
            .set({ billingOptionId: annual.id })
            .where(eq(subscriptions.id, row.subscriptionId));
        const pause = vi.spyOn(fake, 'pause');
        const grantResponse = await post(row.subscriptionId, body);
        expect(grantResponse.status).toBe(422);
        expect((await grantResponse.json()).error.reason).toBe('NOT_MONTHLY');
        expect(pause).toHaveBeenCalledTimes(0);
        const previewResponse = await preview(row.subscriptionId);
        expect(previewResponse.status).toBe(200);
        expect((await previewResponse.json()).data).toMatchObject({
            offered: false,
            reason: 'NOT_MONTHLY',
            alternatives: ['PERMANENT_GRANT', 'RENEWAL_PROMO']
        });
        expect(audit).toHaveBeenCalledWith({
            auditEvent: AuditEventType.BILLING_READ,
            actorId: adminId,
            resourceType: 'subscription',
            resourceId: row.subscriptionId,
            metadata: { subjectId: row.ownerId }
        });
        expect(mutationAudits()).toEqual([]);
    });

    it('extends a live courtesy to the new preview end and audits S34 on the same grant', async () => {
        const row = await seedSelfActive(fake, clock);
        const first = await grantTemporaryCourtesy(
            { subscriptionId: row.subscriptionId, months: 1, grantedBy: adminId, reason },
            { provider: fake, clock }
        );
        expect(first.outcome).toBe('GRANTED');
        const previewResponse = await preview(row.subscriptionId);
        expect(previewResponse.status).toBe(200);
        const projected = (await previewResponse.json()).data;
        expect(projected).toMatchObject({
            offered: true,
            liveCourtesy: {
                courtesyGrantId: first.outcome === 'GRANTED' ? first.courtesyGrantId : ''
            }
        });
        const response = await post(row.subscriptionId, { ...body, expectedStatus: 'PAUSED' });
        expect(response.status).toBe(200);
        const data = (await response.json()).data;
        expect(data).toMatchObject({
            outcome: 'EXTENDED',
            courtesyGrantId: projected.liveCourtesy.courtesyGrantId,
            endsAt: projected.endsAt
        });
        expect(mutationAudits()).toEqual([
            [
                {
                    auditEvent: AuditEventType.BILLING_MUTATION,
                    actorId: adminId,
                    action: 'update',
                    resourceType: 'courtesy_grant',
                    resourceId: data.courtesyGrantId,
                    metadata: {
                        administrativeAction: 'ACC_1',
                        act: 'EXTEND_COURTESY',
                        transition: 'S34',
                        subjectId: row.ownerId,
                        subscriptionId: row.subscriptionId,
                        months: 2,
                        endsAt: data.endsAt,
                        reason
                    }
                }
            ]
        ]);
    });

    it('reports an unconfirmed provider pause and leaves only its reconciliation mark', async () => {
        const row = await seedSelfActive(fake, clock);
        const provider = new Proxy(fake, {
            get(target, property) {
                if (property === 'pause')
                    return async (input: Parameters<PaymentProvider['pause']>[0]) => {
                        await target.pause(input);
                        return { outcome: 'APPLIED' as const };
                    };
                if (property === 'readAuthorization')
                    return async (input: Parameters<PaymentProvider['readAuthorization']>[0]) => {
                        const read = await target.readAuthorization(input);
                        return {
                            ...read,
                            snapshot: { ...read.snapshot, status: 'authorized' as const }
                        };
                    };
                const value = Reflect.get(target, property, target) as unknown;
                return typeof value === 'function' ? value.bind(target) : value;
            }
        }) as PaymentProvider;
        injectPaymentProvider({ provider });
        const response = await post(row.subscriptionId, body);
        expect(response.status).toBe(409);
        expect((await response.json()).error.reason).toBe('COURTESY_NOT_APPLIED');
        const [stored] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, row.subscriptionId));
        expect(stored?.status).toBe('ACTIVE');
        const marks = await getDb()
            .select({ reason: reconciliationMarks.reason })
            .from(reconciliationMarks)
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, row.subscriptionId),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        expect(marks).toEqual([{ reason: 'PAUSA_NO_APLICADA' }]);
        expect(mutationAudits()).toEqual([]);
    });
});
