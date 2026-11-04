import {
    billingOptions,
    coveredPeriods,
    type DrizzleClient,
    eq,
    manualPayments,
    payments,
    plans,
    planVersions,
    receipts,
    subscriptionScheduledChanges,
    subscriptions,
    successionRetainedPayments,
    users
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { registerLateManualPayment } from '../../../src/services/billing/subscription/register-late-manual-payment.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';

const now = new Date('2026-09-04T12:00:00.000Z');
const runningPeriod = new Date('2026-09-03T12:00:00.000Z');
const clock = { now: () => now };
afterAll(closeServiceTestPool);

async function seed(
    input: {
        readonly periodStart?: Date;
        readonly status?: 'SUSPENDED' | 'CANCELLED';
        readonly installmentStatus?: 'DECLARED_UNPAID' | 'AWAITING';
        readonly paymentMethod?: 'MANUAL' | 'CARD';
    } = {}
) {
    const db = getServiceTestDb();
    const [payer] = await db
        .insert(users)
        .values({
            email: `mp4-payer-${crypto.randomUUID()}@example.test`,
            displayName: 'MP4 Payer',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    const [admin] = await db
        .insert(users)
        .values({
            email: `mp4-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'MP4 Admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!payer || !admin) throw new Error('User fixture failed');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'partner',
            slug: `mp4-${crypto.randomUUID()}`,
            name: 'MP4 plan'
        })
        .returning();
    if (!plan) throw new Error('Plan fixture failed');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'partner',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('Version fixture failed');
    const [option] = await db
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 3000000,
            currency: 'ARS'
        })
        .returning();
    if (!option) throw new Error('Option fixture failed');
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId: payer.id,
            vertical: 'partner',
            class: 'PRINCIPAL',
            status: input.status ?? 'SUSPENDED',
            paymentMethod: input.paymentMethod ?? 'MANUAL',
            planVersionId: version.id,
            billingOptionId: option.id,
            nextChargeAt: input.periodStart ?? runningPeriod,
            graceStartedAt: input.periodStart ?? runningPeriod,
            graceEndsAt: new Date('2026-09-10T12:00:00.000Z')
        })
        .returning();
    if (!subscription) throw new Error('Subscription fixture failed');
    const [installment] = await db
        .insert(manualPayments)
        .values({
            subscriptionId: subscription.id,
            periodStart: input.periodStart ?? runningPeriod,
            status: input.installmentStatus ?? 'DECLARED_UNPAID'
        })
        .returning();
    if (!installment) throw new Error('Installment fixture failed');
    const actor = {
        id: admin.id,
        roles: [RoleEnum.ADMIN],
        permissions: [PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT]
    };
    return {
        payer,
        admin,
        plan,
        version,
        option,
        subscription,
        installment,
        actor,
        request: { actor, subscriptionId: subscription.id, manualPaymentId: installment.id }
    };
}

async function state(fixture: Awaited<ReturnType<typeof seed>>) {
    const db = getServiceTestDb();
    const [installment] = await db
        .select()
        .from(manualPayments)
        .where(eq(manualPayments.id, fixture.installment.id));
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, fixture.subscription.id));
    const coverage = await db
        .select()
        .from(coveredPeriods)
        .where(eq(coveredPeriods.manualPaymentId, fixture.installment.id));
    const receipt = await db
        .select()
        .from(receipts)
        .where(eq(receipts.manualPaymentId, fixture.installment.id));
    return { installment, subscription, coverage, receipt };
}

async function rejected(request: Awaited<ReturnType<typeof seed>>['request'], reason: string) {
    await expect(registerLateManualPayment(request, { clock })).rejects.toMatchObject({
        reason
    });
}

describe('TEST:B5:10 MP4 registration', () => {
    it('registers a running period, claims C5, issues a receipt and returns by S7', async () => {
        // Arrange
        const fixture = await seed();
        // Act
        const result = await registerLateManualPayment(
            { ...fixture.request, proofRef: 'bank-transfer-456' },
            { clock }
        );
        // Assert
        const rows = await state(fixture);
        expect(result).toMatchObject({
            effect: 'S7',
            periodStart: runningPeriod,
            reimputedFrom: null,
            nextChargeAt: new Date('2026-10-03T12:00:00.000Z'),
            receiptId: rows.receipt[0]?.id
        });
        expect(rows.installment).toMatchObject({
            status: 'REGISTERED',
            periodStart: runningPeriod,
            registeredBy: fixture.admin.id,
            proofRef: 'bank-transfer-456'
        });
        expect(rows.subscription).toMatchObject({
            status: 'ACTIVE',
            nextChargeAt: new Date('2026-10-03T12:00:00.000Z'),
            graceStartedAt: null,
            graceEndsAt: null
        });
        expect(rows.coverage).toHaveLength(1);
        expect(rows.coverage[0]).toMatchObject({
            manualPaymentId: fixture.installment.id,
            periodStart: runningPeriod,
            creditedAt: now
        });
        expect(rows.receipt).toHaveLength(1);
    });

    it('retains a live predecessor by S19 before moving the subscription', async () => {
        // Arrange
        const fixture = await seed();
        await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: fixture.payer.id,
                vertical: 'partner',
                class: 'PRINCIPAL',
                status: 'ACTIVE',
                paymentMethod: 'MANUAL',
                planVersionId: fixture.version.id,
                billingOptionId: fixture.option.id,
                succeedsId: fixture.subscription.id,
                nextChargeAt: new Date('2026-10-03T12:00:00.000Z')
            });
        // Act
        const emitCoverageChanged = vi.fn(async () => {});
        const result = await registerLateManualPayment(fixture.request, {
            clock,
            coverageNotices: { emitCoverageChanged }
        });
        // Assert
        const rows = await state(fixture);
        const retentions = await getServiceTestDb()
            .select()
            .from(successionRetainedPayments)
            .where(eq(successionRetainedPayments.manualPaymentId, fixture.installment.id));
        expect(result.effect).toBe('S19');
        expect(result.receiptId).toBe(rows.receipt[0]?.id);
        expect(result.nextChargeAt).toEqual(new Date('2026-10-03T12:00:00.000Z'));
        expect(rows.installment?.status).toBe('REGISTERED');
        expect(rows.subscription?.status).toBe('SUSPENDED');
        expect(rows.subscription?.nextChargeAt).toEqual(result.nextChargeAt);
        expect(rows.coverage).toHaveLength(1);
        expect(rows.coverage[0]).toMatchObject({
            manualPaymentId: fixture.installment.id,
            periodStart: runningPeriod,
            creditedAt: now
        });
        expect(rows.receipt).toHaveLength(1);
        expect(retentions).toHaveLength(1);
        expect(retentions[0]).toMatchObject({
            manualPaymentId: fixture.installment.id,
            releasedAt: null
        });
        expect(emitCoverageChanged).not.toHaveBeenCalled();
    });

    it('keeps the original period while S19 defers reactivation', async () => {
        const expiredPeriod = new Date('2026-07-03T12:00:00.000Z');
        const fixture = await seed({ periodStart: expiredPeriod });
        await getServiceTestDb().insert(subscriptions).values({
            userId: fixture.payer.id,
            vertical: 'partner',
            class: 'PRINCIPAL',
            status: 'ACTIVE',
            paymentMethod: 'MANUAL',
            planVersionId: fixture.version.id,
            billingOptionId: fixture.option.id,
            succeedsId: fixture.subscription.id
        });

        const result = await registerLateManualPayment(fixture.request, { clock });
        const rows = await state(fixture);
        expect(result).toMatchObject({
            effect: 'S19',
            periodStart: expiredPeriod,
            reimputedFrom: null,
            nextChargeAt: new Date('2026-08-03T12:00:00.000Z'),
            receiptId: rows.receipt[0]?.id
        });
        expect(rows.installment?.periodStart).toEqual(expiredPeriod);
        expect(rows.coverage[0]?.periodStart).toEqual(expiredPeriod);
        expect(rows.coverage[0]?.creditedAt).toEqual(now);
        expect(rows.subscription).toMatchObject({
            status: 'SUSPENDED',
            nextChargeAt: result.nextChargeAt
        });
    });

    it('rejects an accredited provider payment for the same period without writing', async () => {
        // Arrange
        const fixture = await seed();
        const [payment] = await getServiceTestDb()
            .insert(payments)
            .values({
                subscriptionId: fixture.subscription.id,
                amount: 3000000,
                currency: 'ARS',
                status: 'SUCCEEDED',
                provider: 'test',
                providerFactId: crypto.randomUUID(),
                factAt: now
            })
            .returning();
        if (!payment) throw new Error('Payment fixture failed');
        await getServiceTestDb().insert(coveredPeriods).values({
            subscriptionId: fixture.subscription.id,
            paymentId: payment.id,
            periodStart: runningPeriod,
            creditedAt: now
        });
        // Act
        await rejected(fixture.request, 'MANUAL_PAYMENT_COVERAGE_CONFLICT');
        // Assert
        const rows = await state(fixture);
        expect(rows.installment?.status).toBe('DECLARED_UNPAID');
        expect(rows.subscription?.status).toBe('SUSPENDED');
        expect(rows.coverage).toHaveLength(0);
        expect(rows.receipt).toHaveLength(0);
    });

    it('rejects another live principal under condition 3 without writing', async () => {
        // Arrange
        const fixture = await seed();
        const [retired] = await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: fixture.payer.id,
                vertical: 'partner',
                class: 'PRINCIPAL',
                status: 'CANCELLED',
                paymentMethod: 'MANUAL',
                planVersionId: fixture.version.id,
                billingOptionId: fixture.option.id
            })
            .returning();
        if (!retired) throw new Error('Retired principal fixture failed');
        await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: fixture.payer.id,
                vertical: 'partner',
                class: 'PRINCIPAL',
                status: 'ACTIVE',
                paymentMethod: 'MANUAL',
                planVersionId: fixture.version.id,
                billingOptionId: fixture.option.id,
                succeedsId: retired.id,
                nextChargeAt: new Date('2026-10-03T12:00:00.000Z')
            });
        // Act
        await rejected(fixture.request, 'MANUAL_PAYMENT_CONDITION_FAILED');
        // Assert
        const rows = await state(fixture);
        expect(rows.installment?.status).toBe('DECLARED_UNPAID');
        expect(rows.subscription?.status).toBe('SUSPENDED');
        expect(rows.coverage).toHaveLength(0);
        expect(rows.receipt).toHaveLength(0);
    });

    it('rejects a wrong installment state, subscription state, actor and foreign installment', async () => {
        // Arrange
        const awaiting = await seed({ installmentStatus: 'AWAITING' });
        const cancelled = await seed({ status: 'CANCELLED' });
        const forbidden = await seed();
        const foreign = await seed();
        const owner = await seed();
        // Act and assert
        await rejected(awaiting.request, 'MANUAL_PAYMENT_NOT_DECLARED_UNPAID');
        await rejected(cancelled.request, 'MANUAL_PAYMENT_NOT_SUSPENDED');
        await rejected(
            { ...forbidden.request, actor: { ...forbidden.actor, permissions: [] } },
            'ADMINISTRATIVE_ACTION_FORBIDDEN'
        );
        await rejected(
            { ...owner.request, manualPaymentId: foreign.installment.id },
            'MANUAL_PAYMENT_NOT_FOUND'
        );
    });

    it('calls S38 once after activation when a scheduled change is due', async () => {
        // Arrange
        const due = await seed();
        const future = await seed();
        await getServiceTestDb()
            .insert(subscriptionScheduledChanges)
            .values({
                subscriptionId: due.subscription.id,
                effectiveAt: new Date('2026-09-01T12:00:00.000Z'),
                targetPlanVersionId: due.version.id,
                targetBillingOptionId: due.option.id
            });
        const calls: Array<{ subscriptionId: string; status: string | undefined }> = [];
        const scheduledChangeApplier = {
            applyScheduledChange: vi.fn(
                async (input: { subscriptionId: string; tx: DrizzleClient }) => {
                    const [row] = await input.tx
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, input.subscriptionId));
                    calls.push({ subscriptionId: input.subscriptionId, status: row?.status });
                }
            )
        };
        // Act
        await registerLateManualPayment(due.request, { clock, scheduledChangeApplier });
        await registerLateManualPayment(future.request, { clock, scheduledChangeApplier });
        // Assert
        expect(calls).toEqual([{ subscriptionId: due.subscription.id, status: 'ACTIVE' }]);
        expect(scheduledChangeApplier.applyScheduledChange).toHaveBeenCalledTimes(1);
    });
});
