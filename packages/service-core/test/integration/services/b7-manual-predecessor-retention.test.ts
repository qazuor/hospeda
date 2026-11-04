import {
    billingOptions,
    coveredPeriods,
    eq,
    getDb,
    manualPayments,
    plans,
    planVersions,
    receipts,
    reconciliationMarks,
    subscriptions,
    successionRetainedPayments,
    users
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { settleExternalRefund } from '../../../src/services/billing/refund/settle-external-refund.service';
import { expireManualGraces } from '../../../src/services/billing/subscription/expire-manual-grace.service';
import { registerLateManualPayment } from '../../../src/services/billing/subscription/register-late-manual-payment.service';
import { registerManualPayment } from '../../../src/services/billing/subscription/register-manual-payment.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';

const now = new Date('2026-10-20T12:00:00.000Z');
const periodStart = new Date('2026-10-18T12:00:00.000Z');
const clock = { now: () => now };
afterAll(closeServiceTestPool);

async function seed(
    args: {
        status?: 'GRACE_PERIOD' | 'SUSPENDED';
        installment?: 'AWAITING' | 'DECLARED_UNPAID';
    } = {}
) {
    const db = getServiceTestDb();
    const [payer] = await db
        .insert(users)
        .values({
            email: `b7-manual-${crypto.randomUUID()}@example.test`,
            displayName: 'B7 manual payer',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    const [admin] = await db
        .insert(users)
        .values({
            email: `b7-manual-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'B7 manual admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!payer || !admin) throw new Error('B7 manual users fixture failed');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'partner',
            slug: `b7-manual-${crypto.randomUUID()}`,
            name: 'B7 manual'
        })
        .returning();
    if (!plan) throw new Error('B7 manual plan fixture failed');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'partner',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            graceDays: 10,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('B7 manual version fixture failed');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 3000000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('B7 manual billing option fixture failed');
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId: payer.id,
            vertical: 'partner',
            class: 'PRINCIPAL',
            status: args.status ?? 'GRACE_PERIOD',
            paymentMethod: 'MANUAL',
            planVersionId: version.id,
            billingOptionId: option.id,
            nextChargeAt: new Date('2026-11-18T12:00:00.000Z'),
            graceStartedAt: periodStart,
            graceEndsAt: new Date(now.getTime() - 1000)
        })
        .returning();
    if (!subscription) throw new Error('B7 manual subscription fixture failed');
    const [prior] = await db
        .insert(manualPayments)
        .values({
            subscriptionId: subscription.id,
            periodStart: new Date('2026-09-18T12:00:00.000Z'),
            status: 'REGISTERED',
            registeredBy: admin.id,
            registeredAt: now
        })
        .returning();
    const [installment] = await db
        .insert(manualPayments)
        .values({
            subscriptionId: subscription.id,
            periodStart,
            status: args.installment ?? 'AWAITING',
            ...(args.installment === 'DECLARED_UNPAID' ? {} : {})
        })
        .returning();
    if (!prior || !installment) throw new Error('B7 manual installment fixture failed');
    const actor = {
        id: admin.id,
        roles: [RoleEnum.ADMIN],
        permissions: [PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT]
    };
    const request = { actor, subscriptionId: subscription.id, manualPaymentId: installment.id };
    return {
        payer,
        admin,
        plan,
        version,
        option,
        subscription,
        installment,
        prior,
        actor,
        request
    };
}

async function successor(f: Awaited<ReturnType<typeof seed>>) {
    await getServiceTestDb()
        .insert(subscriptions)
        .values({
            userId: f.payer.id,
            vertical: 'partner',
            class: 'PRINCIPAL',
            status: 'ACTIVE',
            paymentMethod: 'MANUAL',
            planVersionId: f.version.id,
            billingOptionId: f.option.id,
            succeedsId: f.subscription.id,
            nextChargeAt: new Date('2026-12-18T12:00:00.000Z')
        });
}

async function read(f: Awaited<ReturnType<typeof seed>>) {
    const db = getServiceTestDb();
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, f.subscription.id));
    const [installment] = await db
        .select()
        .from(manualPayments)
        .where(eq(manualPayments.id, f.installment.id));
    const retentions = await db
        .select()
        .from(successionRetainedPayments)
        .where(eq(successionRetainedPayments.manualPaymentId, f.installment.id));
    const coverage = await db
        .select()
        .from(coveredPeriods)
        .where(eq(coveredPeriods.manualPaymentId, f.installment.id));
    const receipt = await db
        .select()
        .from(receipts)
        .where(eq(receipts.manualPaymentId, f.installment.id));
    const marks = await db
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, f.subscription.id));
    return { subscription, installment, retentions, coverage, receipt, marks };
}

describe.skipIf(!isServiceTestDbAvailable())('TEST:B7:10 (manual) AC:B7:16', () => {
    it('retains MP1 on a live predecessor; an open retention keeps its expired grace from suspension', async () => {
        const f = await seed();
        await successor(f);
        const result = await registerManualPayment(f.request, { clock });
        expect(result.effect).toBe('S19');
        const before = await read(f);
        expect(before.retentions).toHaveLength(1);
        expect(before.retentions[0]).toMatchObject({
            manualPaymentId: f.installment.id,
            releasedAt: null
        });
        expect(before.subscription?.status).toBe('GRACE_PERIOD');
        expect(before.marks).toHaveLength(0);
        const notice = vi.fn(async () => 'SENT' as const);
        await expireManualGraces(
            { pageSize: 100 },
            {
                clock,
                beforeCancelNotice: { beforeCancel: notice },
                coverageNotices: { emitCoverageChanged: async () => {} }
            }
        );
        expect((await read(f)).subscription?.status).toBe('GRACE_PERIOD');
        expect(notice).not.toHaveBeenCalled();
    });

    it('M10: an open S19 retention on an AWAITING installment excludes the expired grace from SQL candidates', async () => {
        // Seed AWAITING deliberately: a real MP1 S19 changes it to REGISTERED, which independently fails findManualGracesDue's AWAITING predicate. This fixture isolates the retention notExists guard targeted by M10.
        const f = await seed();
        await successor(f);
        await getDb().insert(successionRetainedPayments).values({
            subscriptionId: f.subscription.id,
            manualPaymentId: f.installment.id,
            unpaidSince: periodStart
        });
        const notice = vi.fn(async () => 'SENT' as const);
        await expireManualGraces(
            { pageSize: 100 },
            {
                clock,
                beforeCancelNotice: { beforeCancel: notice },
                coverageNotices: { emitCoverageChanged: async () => {} }
            }
        );
        expect((await read(f)).subscription?.status).toBe('GRACE_PERIOD');
        expect((await read(f)).installment?.status).toBe('AWAITING');
        expect(notice).not.toHaveBeenCalled();
    });

    it('MP4 keeps a suspended live predecessor in S19 without a reconciliation mark', async () => {
        const f = await seed({ status: 'SUSPENDED', installment: 'DECLARED_UNPAID' });
        await successor(f);
        const result = await registerLateManualPayment(f.request, { clock });
        expect(result.effect).toBe('S19');
        const after = await read(f);
        expect(after.subscription?.status).toBe('SUSPENDED');
        expect(after.installment?.status).toBe('REGISTERED');
        expect(after.retentions).toHaveLength(1);
        expect(after.retentions[0]?.releasedAt).toBeNull();
        expect(after.marks).toHaveLength(0);
    });

    it('RF4 rejects refund while retained and settles TOTAL after the predecessor is cancelled', async () => {
        const f = await seed();
        await successor(f);
        await registerManualPayment(f.request, { clock });
        const admin = {
            id: f.admin.id,
            roles: [RoleEnum.ADMIN],
            permissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL]
        };
        const settle = () =>
            settleExternalRefund(
                {
                    actor: admin,
                    source: { kind: 'MANUAL_PAYMENT', id: f.installment.id },
                    amount: 3000000,
                    channel: 'BANK_TRANSFER',
                    reference: `b7-manual-refund-${crypto.randomUUID()}`,
                    reason: 'MANUAL_PAYMENT_REFUND',
                    manualPaymentScope: 'TOTAL'
                },
                { clock }
            );
        await expect(settle()).rejects.toMatchObject({
            reason: 'RETAINED_PAYMENT_SUCCESSION_OPEN'
        });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(eq(subscriptions.id, f.subscription.id));
        const result = await settle();
        expect(result.coverageReleased).toBe(true);
        const after = await read(f);
        expect(after.coverage[0]?.releasedAt).not.toBeNull();
    });
});
