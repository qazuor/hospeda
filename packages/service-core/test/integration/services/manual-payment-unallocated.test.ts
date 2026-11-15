import {
    and,
    billingOptions,
    coveredPeriods,
    eq,
    isNull,
    manualPaymentModel,
    manualPayments,
    payments,
    plans,
    planVersions,
    receipts,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions,
    users
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import {
    previewUnallocatedManualPayment,
    registerUnallocatedManualPayment
} from '../../../src/services/billing/subscription/register-unallocated-manual-payment.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';

const now = new Date('2026-09-04T12:00:00.000Z');
const periodStart = new Date('2026-09-03T12:00:00.000Z');
const nextChargeAt = new Date('2026-10-03T12:00:00.000Z');
const clock = { now: () => now };
afterAll(closeServiceTestPool);

type Status = 'ACTIVE' | 'CANCELLED' | 'ABANDONED' | 'SUSPENDED';
type InstallmentStatus = 'REGISTERED' | 'DECLARED_UNPAID' | 'AWAITING';
async function seed(
    input: {
        status?: Status;
        installmentStatus?: InstallmentStatus | null;
        paymentMethod?: 'MANUAL' | 'CARD';
        coverage?: boolean;
    } = {}
) {
    const db = getServiceTestDb();
    const [payer, admin] = await db
        .insert(users)
        .values([
            {
                email: `mp6-payer-${crypto.randomUUID()}@example.test`,
                displayName: 'MP6 payer',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            },
            {
                email: `mp6-admin-${crypto.randomUUID()}@example.test`,
                displayName: 'MP6 admin',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            }
        ])
        .returning();
    if (!payer || !admin) throw new Error('User fixture failed');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'partner',
            slug: `mp6-${crypto.randomUUID()}`,
            name: 'MP6 plan'
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
            status: input.status ?? 'ACTIVE',
            paymentMethod: input.paymentMethod ?? 'MANUAL',
            planVersionId: version.id,
            billingOptionId: option.id,
            nextChargeAt
        })
        .returning();
    if (!subscription) throw new Error('Subscription fixture failed');
    const installmentStatus =
        input.installmentStatus === undefined ? 'REGISTERED' : input.installmentStatus;
    const [installment] = installmentStatus
        ? await db
              .insert(manualPayments)
              .values({
                  subscriptionId: subscription.id,
                  periodStart,
                  status: installmentStatus,
                  createdAt: new Date('2026-09-01T12:00:00.000Z'),
                  registeredBy: installmentStatus === 'REGISTERED' ? admin.id : null,
                  registeredAt: installmentStatus === 'REGISTERED' ? now : null
              })
              .returning()
        : [];
    if (input.coverage) {
        let paymentId: string | undefined;
        if (!installment) {
            const [payment] = await db
                .insert(payments)
                .values({
                    subscriptionId: subscription.id,
                    amount: 3000000,
                    currency: 'ARS',
                    status: 'SUCCEEDED',
                    provider: 'test',
                    providerFactId: crypto.randomUUID(),
                    factAt: now
                })
                .returning();
            if (!payment) throw new Error('Provider payment fixture failed');
            paymentId = payment.id;
        }
        await db.insert(coveredPeriods).values({
            subscriptionId: subscription.id,
            periodStart,
            ...(installment ? { manualPaymentId: installment.id } : { paymentId }),
            creditedAt: now
        });
    }
    const actor = {
        id: admin.id,
        roles: [RoleEnum.ADMIN],
        permissions: [PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT]
    };
    return {
        subscription,
        installment,
        actor,
        request: { actor, subscriptionId: subscription.id }
    };
}

async function snapshot(subscriptionId: string) {
    const db = getServiceTestDb();
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    const rows = await db
        .select()
        .from(manualPayments)
        .where(eq(manualPayments.subscriptionId, subscriptionId));
    const coverage = await db
        .select()
        .from(coveredPeriods)
        .where(eq(coveredPeriods.subscriptionId, subscriptionId));
    const receiptRows = await db
        .select()
        .from(receipts)
        .innerJoin(manualPayments, eq(receipts.manualPaymentId, manualPayments.id))
        .where(eq(manualPayments.subscriptionId, subscriptionId));
    const marks = await db
        .select()
        .from(reconciliationMarks)
        .where(
            and(
                eq(reconciliationMarks.subscriptionId, subscriptionId),
                isNull(reconciliationMarks.liftedAt)
            )
        );
    return { subscription, rows, coverage, receiptRows, marks };
}

async function hung(markId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarkPayments)
        .where(eq(reconciliationMarkPayments.markId, markId));
}

async function rejected(request: Awaited<ReturnType<typeof seed>>['request'], reason: string) {
    await expect(previewUnallocatedManualPayment(request)).rejects.toMatchObject({ reason });
    await expect(registerUnallocatedManualPayment(request, { clock })).rejects.toMatchObject({
        reason
    });
}

describe('TEST:B5:10 MP6 unallocated transfers', () => {
    it('opens duplicate mark with a second registered payment and preserves the subscription', async () => {
        const fixture = await seed({ coverage: true });
        const before = await snapshot(fixture.subscription.id);
        const preview = await previewUnallocatedManualPayment(fixture.request);
        expect(preview).toEqual({
            subscriptionId: fixture.subscription.id,
            periodStart,
            mark: 'COBRO_DUPLICADO'
        });

        const result = await registerUnallocatedManualPayment(fixture.request, { clock });
        const after = await snapshot(fixture.subscription.id);
        expect(result).toMatchObject({ periodStart, mark: 'COBRO_DUPLICADO', outcome: 'OPENED' });
        expect(after.rows).toHaveLength(2);
        expect(after.rows.find((row) => row.id === result.manualPaymentId)).toMatchObject({
            periodStart,
            status: 'REGISTERED',
            entry: 'UNALLOCATED',
            registeredBy: fixture.actor.id,
            registeredAt: now
        });
        expect(after.marks).toHaveLength(1);
        expect(after.marks[0]).toMatchObject({
            id: result.markId,
            reason: 'COBRO_DUPLICADO',
            liftedAt: null
        });
        expect(await hung(result.markId)).toMatchObject([
            { manualPaymentId: result.manualPaymentId }
        ]);
        expect(after.coverage).toHaveLength(1);
        expect(after.coverage[0]?.manualPaymentId).toBe(fixture.installment?.id);
        expect(after.subscription?.status).toBe(before.subscription?.status);
        expect(after.subscription?.nextChargeAt).toEqual(before.subscription?.nextChargeAt);
        expect(after.receiptRows).toHaveLength(before.receiptRows.length);
    });

    it.each([
        'CANCELLED',
        'ABANDONED'
    ] as const)('opens the post-cancellation mark for %s', async (status) => {
        const fixture = await seed({ status, installmentStatus: 'DECLARED_UNPAID' });
        const before = await snapshot(fixture.subscription.id);
        expect(await previewUnallocatedManualPayment(fixture.request)).toEqual({
            subscriptionId: fixture.subscription.id,
            periodStart,
            mark: 'COBRO_POSTERIOR_A_LA_BAJA'
        });

        const result = await registerUnallocatedManualPayment(fixture.request, { clock });
        const after = await snapshot(fixture.subscription.id);
        expect(result).toMatchObject({
            periodStart,
            mark: 'COBRO_POSTERIOR_A_LA_BAJA',
            outcome: 'OPENED'
        });
        expect(after.rows).toHaveLength(before.rows.length + 1);
        expect(after.rows.find((row) => row.id === result.manualPaymentId)).toMatchObject({
            status: 'REGISTERED',
            registeredBy: fixture.actor.id,
            periodStart
        });
        expect(after.marks).toHaveLength(1);
        expect(after.marks[0]).toMatchObject({
            id: result.markId,
            reason: 'COBRO_POSTERIOR_A_LA_BAJA'
        });
        expect(await hung(result.markId)).toMatchObject([
            { manualPaymentId: result.manualPaymentId }
        ]);
        expect(after.coverage).toHaveLength(before.coverage.length);
        expect(after.subscription?.status).toBe(status);
        expect(after.subscription?.nextChargeAt).toEqual(before.subscription?.nextChargeAt);
        expect(after.receiptRows).toHaveLength(before.receiptRows.length);
    });

    it('rejects a subscription without any period and preserves its payment count', async () => {
        const fixture = await seed({ installmentStatus: null });
        const before = await snapshot(fixture.subscription.id);
        await rejected(fixture.request, 'MANUAL_PAYMENT_NO_PERIOD');
        const after = await snapshot(fixture.subscription.id);
        expect(after.rows).toHaveLength(before.rows.length);
    });

    it('uses the last accredited period when the subscription never had an installment', async () => {
        const fixture = await seed({ installmentStatus: null, coverage: true });
        expect(await previewUnallocatedManualPayment(fixture.request)).toMatchObject({
            periodStart,
            mark: 'COBRO_DUPLICADO'
        });
        const result = await registerUnallocatedManualPayment(fixture.request, { clock });
        const after = await snapshot(fixture.subscription.id);
        expect(result).toMatchObject({ periodStart, mark: 'COBRO_DUPLICADO', outcome: 'OPENED' });
        expect(after.rows).toHaveLength(1);
        expect(after.coverage).toHaveLength(1);
        expect(after.marks).toMatchObject([{ reason: 'COBRO_DUPLICADO' }]);
        expect(await hung(result.markId)).toMatchObject([
            { manualPaymentId: result.manualPaymentId }
        ]);
    });

    it('rejects an open awaiting installment', async () => {
        const fixture = await seed({ installmentStatus: 'AWAITING' });
        await rejected(fixture.request, 'MANUAL_PAYMENT_OPEN_INSTALLMENT');
        expect((await snapshot(fixture.subscription.id)).rows).toHaveLength(1);
    });

    it('rejects an uncovered registered period and rolls back both writes', async () => {
        const fixture = await seed();
        const before = await snapshot(fixture.subscription.id);
        await rejected(fixture.request, 'MANUAL_PAYMENT_PERIOD_NOT_COVERED');
        const after = await snapshot(fixture.subscription.id);
        expect(after.rows).toHaveLength(before.rows.length);
        expect(after.coverage).toHaveLength(before.coverage.length);
    });

    it('rejects a forbidden actor and a card payer', async () => {
        const fixture = await seed({ coverage: true });
        await rejected(
            { ...fixture.request, actor: { ...fixture.actor, permissions: [] } },
            'ADMINISTRATIVE_ACTION_FORBIDDEN'
        );
        const card = await seed({ paymentMethod: 'CARD', coverage: true });
        await rejected(card.request, 'MANUAL_PAYMENT_NOT_MANUAL');
    });

    it('accepts the full session actor that getActorFromContext returns (HOS-2178)', async () => {
        // Arrange: the route passes the session actor as-is, extra keys included.
        const fixture = await seed({ coverage: true });
        const sessionActor = {
            ...fixture.actor,
            name: 'Real Admin',
            email: 'real-admin@local.test',
            emailVerified: true,
            image: null,
            mustChangePassword: false
        };
        const request = { ...fixture.request, actor: sessionActor };

        // Act
        const preview = await previewUnallocatedManualPayment(request);
        const result = await registerUnallocatedManualPayment(request, { clock });

        // Assert
        expect(preview).toMatchObject({ mark: 'COBRO_DUPLICADO' });
        expect(result).toMatchObject({ mark: 'COBRO_DUPLICADO', outcome: 'OPENED' });
        const after = await snapshot(fixture.subscription.id);
        expect(after.rows.find((row) => row.id === result.manualPaymentId)?.registeredBy).toBe(
            fixture.actor.id
        );
    });

    it('accumulates two transfers on one open mark', async () => {
        const fixture = await seed({ coverage: true });
        const first = await registerUnallocatedManualPayment(fixture.request, { clock });
        const second = await registerUnallocatedManualPayment(fixture.request, { clock });
        expect(first.outcome).toBe('OPENED');
        expect(second.outcome).toBe('ACCUMULATED');
        expect(second.markId).toBe(first.markId);
        expect((await snapshot(fixture.subscription.id)).marks).toHaveLength(1);
        expect((await hung(first.markId)).map((row) => row.manualPaymentId).sort()).toEqual(
            [first.manualPaymentId, second.manualPaymentId].sort()
        );
    });

    it.each([
        'CANCELLED',
        'ABANDONED'
    ] as const)('accumulates two post-cancellation transfers for %s without changing installment selection', async (status) => {
        const fixture = await seed({ status, installmentStatus: 'DECLARED_UNPAID' });
        const first = await registerUnallocatedManualPayment(fixture.request, { clock });
        expect(await previewUnallocatedManualPayment(fixture.request)).toMatchObject({
            periodStart,
            mark: 'COBRO_POSTERIOR_A_LA_BAJA'
        });
        const second = await registerUnallocatedManualPayment(fixture.request, { clock });
        expect(first).toMatchObject({ mark: 'COBRO_POSTERIOR_A_LA_BAJA', outcome: 'OPENED' });
        expect(second).toMatchObject({
            mark: 'COBRO_POSTERIOR_A_LA_BAJA',
            outcome: 'ACCUMULATED',
            markId: first.markId
        });
        const after = await snapshot(fixture.subscription.id);
        expect(after.rows).toHaveLength(3);
        expect(after.rows.filter((row) => row.entry === 'UNALLOCATED')).toHaveLength(2);
        expect(after.marks).toHaveLength(1);
        expect(after.coverage).toHaveLength(0);
        expect((await hung(first.markId)).map((row) => row.manualPaymentId).sort()).toEqual(
            [first.manualPaymentId, second.manualPaymentId].sort()
        );
        const db = getServiceTestDb();
        expect(
            (
                await manualPaymentModel.findLatestInstallment({
                    subscriptionId: fixture.subscription.id,
                    tx: db
                })
            )?.id
        ).toBe(fixture.installment?.id);
        expect(
            (
                await manualPaymentModel.findFirstInstallment({
                    subscriptionId: fixture.subscription.id,
                    tx: db
                })
            )?.id
        ).toBe(fixture.installment?.id);
        expect(
            await manualPaymentModel.isFirstInstallment({
                subscriptionId: fixture.subscription.id,
                manualPaymentId: first.manualPaymentId,
                tx: db
            })
        ).toBe(false);
    });
});
