import {
    billingOptions,
    courtesyGrants,
    coverageLosses,
    eq,
    getDb,
    inArray,
    plans,
    planVersions,
    providerLinks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import {
    createPaymentReconciliationMarkPayments,
    reissueDeferredCourtesy
} from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    retireAdminCancellationRows,
    routeClock,
    routeFake
} from './admin-cancellation-fixtures';
import { seedUser, spyingProvider } from './revocation-route-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));
let app: ReturnType<typeof initApp>;
const adminId = '00000000-0000-4000-8000-000000000092';
const headers = () =>
    actorHeaders({
        id: adminId,
        role: 'SUPER_ADMIN',
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_PAUSE_SUBSCRIPTION]
    });
const pathOf = (id: string, action: 'pause-preview' | 'pause' | 'resume') =>
    `/api/v1/admin/billing-subscription/${id}/${action}`;
const get = (id: string) => app.request(pathOf(id, 'pause-preview'), { headers: headers() });
const post = (id: string, action: 'pause' | 'resume', body: unknown) =>
    app.request(pathOf(id, action), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body)
    });
const pauseBody = { months: 1, expectedStatus: 'ACTIVE', confirmed: true };
const resumeBody = { expectedStatus: 'PAUSED', confirmed: true };
const errorOf = async (response: Response) => {
    const body = await response.json();
    return {
        status: response.status,
        code: body.error?.code,
        reason: body.error?.reason,
        details: body.error?.details
    };
};
async function seedEligible() {
    const ownerId = await seedUser('admin-pause');
    const authorization = await fake.authorize({
        reference: `admin-pause-${crypto.randomUUID()}`,
        amount: { amountMinor: 10000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'administrative pause route test',
        returnUrl: 'https://example.test/return',
        payerEmail: `admin-pause-${crypto.randomUUID()}@example.test`
    });
    await fake.approve({ authorizationId: authorization.authorizationId });
    const [plan] = await getDb()
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `admin-pause-${crypto.randomUUID()}`,
            name: 'Administrative pause route test'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected seeded plan');
    const [version] = await getDb()
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: true
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected seeded plan version');
    const [option] = await getDb()
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 10000,
            currency: 'ARS'
        })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected seeded option');
    const [row] = await getDb()
        .insert(subscriptions)
        .values({
            userId: ownerId,
            vertical: 'accommodation',
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!row) throw new Error('Expected seeded subscription');
    await getDb().insert(providerLinks).values({
        subscriptionId: row.id,
        provider: 'MERCADO_PAGO',
        providerId: authorization.authorizationId
    });
    created.push({ subscriptionId: row.id, ownerId });
    return { subscriptionId: row.id, ownerId, authorizationId: authorization.authorizationId };
}
const created: Array<{ subscriptionId: string; ownerId: string }> = [];
async function retireCreated() {
    const rows = created.splice(0);
    const ids = rows.map((row) => row.subscriptionId);
    if (ids.length) {
        await getDb().delete(courtesyGrants).where(inArray(courtesyGrants.subscriptionId, ids));
        await getDb()
            .delete(subscriptionPauses)
            .where(inArray(subscriptionPauses.subscriptionId, ids));
        await getDb().delete(providerLinks).where(inArray(providerLinks.subscriptionId, ids));
        await getDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(inArray(subscriptions.id, ids));
        await getDb()
            .delete(coverageLosses)
            .where(
                inArray(
                    coverageLosses.userId,
                    rows.map((row) => row.ownerId)
                )
            );
    }
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
    await retireCreated();
    await retireAdminCancellationRows();
    vi.restoreAllMocks();
});
afterAll(async () => {
    await retireCreated();
    await retireAdminCancellationRows();
    await testDb.teardown();
});

describe('TEST:B8b:22 AC:B8b:22 administrative action 9 routes', () => {
    it('previews eligibility and audits the read', async () => {
        const seeded = await seedEligible();
        const response = await get(seeded.subscriptionId);
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({
            subscriptionId: seeded.subscriptionId,
            status: 'ACTIVE',
            offered: true,
            quota: { pausesLeft: 3, monthsLeft: 8 },
            openPause: null
        });
        expect(audit).toHaveBeenCalledWith({
            auditEvent: AuditEventType.BILLING_READ,
            actorId: adminId,
            resourceType: 'subscription',
            resourceId: seeded.subscriptionId,
            metadata: { subjectId: seeded.ownerId }
        });
    });

    it('requires confirmation and rejects stale status before changing the DB', async () => {
        const seeded = await seedEligible();
        expect(
            (await post(seeded.subscriptionId, 'pause', { months: 1, expectedStatus: 'ACTIVE' }))
                .status
        ).toBe(400);
        expect(
            (await post(seeded.subscriptionId, 'resume', { expectedStatus: 'PAUSED' })).status
        ).toBe(400);
        const stale = await post(seeded.subscriptionId, 'resume', resumeBody);
        expect(await errorOf(stale)).toEqual({
            status: 409,
            code: 'CONFLICT',
            reason: 'ADMINISTRATIVE_ACTION_STATE_CHANGED',
            details: { reason: 'ADMINISTRATIVE_ACTION_STATE_CHANGED' }
        });
        const [row] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
        expect(mutationAudits()).toEqual([]);
    });

    it('pauses successfully and records the complete admin audit event', async () => {
        const seeded = await seedEligible();
        const response = await post(seeded.subscriptionId, 'pause', {
            ...pauseBody,
            note: 'Owner request'
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data.outcome).toBe('PAUSED');
        expect(audit).toHaveBeenCalledWith({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: adminId,
            action: 'update',
            resourceType: 'subscription',
            resourceId: seeded.subscriptionId,
            metadata: {
                administrativeAction: 'ACC_9',
                act: 'PAUSE',
                outcome: 'PAUSED',
                subjectId: seeded.ownerId,
                months: 1,
                expectedEndAt: body.data.expectedEndAt,
                note: 'Owner request'
            }
        });
        const [row] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('PAUSED');
    });

    it('refuses a second pause with a stale ACTIVE confirmation', async () => {
        const seeded = await seedEligible();
        const first = await post(seeded.subscriptionId, 'pause', pauseBody);
        expect(first.status).toBe(200);
        audit.mockClear();
        const stale = await post(seeded.subscriptionId, 'pause', pauseBody);
        expect(await errorOf(stale)).toEqual({
            status: 409,
            code: 'CONFLICT',
            reason: 'ADMINISTRATIVE_ACTION_STATE_CHANGED',
            details: { reason: 'ADMINISTRATIVE_ACTION_STATE_CHANGED' }
        });
        const [row] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('PAUSED');
        expect(mutationAudits()).toEqual([]);
    });

    it('resumes a customer pause and records the complete admin audit event', async () => {
        const seeded = await seedEligible();
        const paused = await post(seeded.subscriptionId, 'pause', pauseBody);
        expect(paused.status).toBe(200);
        audit.mockClear();
        const response = await post(seeded.subscriptionId, 'resume', {
            ...resumeBody,
            note: 'Early return'
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data.outcome).toBe('RESUMED');
        const [row] = await getDb()
            .select({ status: subscriptions.status, nextChargeAt: subscriptions.nextChargeAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
        expect(audit).toHaveBeenCalledWith({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: adminId,
            action: 'update',
            resourceType: 'subscription',
            resourceId: seeded.subscriptionId,
            metadata: {
                administrativeAction: 'ACC_9',
                act: 'RESUME',
                outcome: 'RESUMED',
                subjectId: seeded.ownerId,
                nextChargeAt: row?.nextChargeAt?.toISOString() ?? null,
                note: 'Early return'
            }
        });
    });

    it('maps a canPause refusal to 422 with its reason and no mutation audit', async () => {
        const seeded = await seedEligible();
        const [row] = await getDb()
            .select({ billingOptionId: subscriptions.billingOptionId })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        if (!row?.billingOptionId) throw new Error('Expected seeded billing option');
        await getDb()
            .update(billingOptions)
            .set({ cycle: 'annual' })
            .where(eq(billingOptions.id, row.billingOptionId));
        const response = await post(seeded.subscriptionId, 'pause', pauseBody);
        expect(await errorOf(response)).toEqual({
            status: 422,
            code: 'VALIDATION_ERROR',
            reason: 'NOT_MONTHLY',
            details: { reason: 'NOT_MONTHLY' }
        });
        expect(mutationAudits()).toEqual([]);
    });

    it('refuses a real S9 courtesy pause before any provider call', async () => {
        const seeded = await seedEligible();
        const [successor] = await getDb()
            .select({
                planVersionId: subscriptions.planVersionId,
                billingOptionId: subscriptions.billingOptionId
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        if (!successor?.planVersionId || !successor.billingOptionId)
            throw new Error('Expected successor anchors');
        const [predecessor] = await getDb()
            .insert(subscriptions)
            .values({
                userId: seeded.ownerId,
                vertical: 'accommodation',
                planVersionId: successor.planVersionId,
                billingOptionId: successor.billingOptionId,
                paymentMethod: 'CARD',
                status: 'CANCELLED',
                class: 'PRINCIPAL',
                succeededById: seeded.subscriptionId
            })
            .returning({ id: subscriptions.id });
        if (!predecessor) throw new Error('Expected predecessor');
        created.push({ subscriptionId: predecessor.id, ownerId: seeded.ownerId });
        await getDb()
            .insert(courtesyGrants)
            .values({
                beneficiaryUserId: seeded.ownerId,
                grantedBy: seeded.ownerId,
                subscriptionId: predecessor.id,
                months: 3,
                balanceMonths: 2,
                startsAt: new Date('2026-09-01T12:00:00.000Z'),
                endsAt: new Date('2026-12-01T12:00:00.000Z'),
                reason: 'fixture'
            });
        const reissued = await reissueDeferredCourtesy(
            { successorSubscriptionId: seeded.subscriptionId },
            { provider: fake, clock, markPayments: createPaymentReconciliationMarkPayments(clock) }
        );
        expect(reissued.outcome).toBe('REISSUED');
        audit.mockClear();
        const spying = spyingProvider(fake);
        injectPaymentProvider({ provider: spying.provider });
        const response = await post(seeded.subscriptionId, 'resume', resumeBody);
        expect(await errorOf(response)).toEqual({
            status: 409,
            code: 'CONFLICT',
            reason: 'PAUSE_NOT_CUSTOMER_REQUEST',
            details: { reason: 'PAUSE_NOT_CUSTOMER_REQUEST' }
        });
        expect(spying.calls).toEqual([]);
        expect(mutationAudits()).toEqual([]);
    });
});
