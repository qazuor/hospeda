import {
    billingOptions,
    coverageLosses,
    eq,
    getDb,
    manualPaymentModel,
    manualPayments,
    plans,
    planVersions,
    subscriptions,
    successionRetainedPayments,
    users
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
    declareManualPaymentUnpaid,
    previewManualUnpaidDeclaration
} from '../../../src/services/billing/subscription/declare-manual-unpaid.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';

const now = new Date('2026-09-04T12:00:00.000Z');
const graceStartedAt = new Date('2026-09-03T12:00:00.000Z');
const clock = { now: () => now };
afterAll(closeServiceTestPool);

async function seed(
    input: {
        status?: 'GRACE_PERIOD' | 'ACTIVE' | 'SUSPENDED' | 'PENDING_AUTHORIZATION';
        paymentMethod?: 'MANUAL' | 'CARD';
    } = {}
) {
    const db = getServiceTestDb();
    const [payer, admin] = await db
        .insert(users)
        .values([
            {
                email: `mp2-payer-${crypto.randomUUID()}@example.test`,
                displayName: 'MP2 Payer',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            },
            {
                email: `mp2-admin-${crypto.randomUUID()}@example.test`,
                displayName: 'MP2 Admin',
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
            slug: `mp2-${crypto.randomUUID()}`,
            name: 'MP2 plan'
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
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: input.paymentMethod ?? 'MANUAL',
            status: input.status ?? 'GRACE_PERIOD',
            graceStartedAt,
            graceEndsAt: now
        })
        .returning();
    if (!subscription) throw new Error('Subscription fixture failed');
    const [installment] = await db
        .insert(manualPayments)
        .values({
            subscriptionId: subscription.id,
            periodStart: graceStartedAt,
            status: 'AWAITING'
        })
        .returning();
    if (!installment) throw new Error('Installment fixture failed');
    const actor = {
        id: admin.id,
        roles: [RoleEnum.ADMIN],
        permissions: [PermissionEnum.BILLING_DECLARE_MANUAL_UNPAID]
    };
    const request = { actor, subscriptionId: subscription.id, manualPaymentId: installment.id };
    return { payer, admin, subscription, installment, request };
}

function ports() {
    const beforeCancel = vi.fn(async () => 'SENT' as const);
    const emitCoverageChanged = vi.fn(async () => {});
    return {
        clock,
        beforeCancelNotice: { beforeCancel },
        coverageNotices: { emitCoverageChanged },
        beforeCancel,
        emitCoverageChanged
    };
}

async function state(fixture: Awaited<ReturnType<typeof seed>>) {
    const db = getServiceTestDb();
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, fixture.subscription.id));
    const [installment] = await db
        .select()
        .from(manualPayments)
        .where(eq(manualPayments.id, fixture.installment.id));
    const losses = await db
        .select()
        .from(coverageLosses)
        .where(eq(coverageLosses.userId, fixture.payer.id));
    return { subscription, installment, losses };
}

async function rejected(act: () => Promise<unknown>, reason: string) {
    await expect(act()).rejects.toMatchObject({ reason });
}

describe('TEST:B5:8 MP2 — AC:B5:16 and AC:B7:12', () => {
    it('suspends the manual payer, records the coverage loss, and sends the manual notice', async () => {
        // Arrange
        const fixture = await seed();
        const p = ports();
        // Act
        const preview = await previewManualUnpaidDeclaration(fixture.request);
        const result = await declareManualPaymentUnpaid(fixture.request, p);
        // Assert
        expect(preview).toEqual({
            subscriptionId: fixture.subscription.id,
            manualPaymentId: fixture.installment.id,
            periodStart: graceStartedAt,
            effect: 'S6'
        });
        expect(result).toEqual({ outcome: 'SUSPENDED', notice: 'SENT' });
        const written = await state(fixture);
        expect(written.installment?.status).toBe('DECLARED_UNPAID');
        expect(written.subscription?.status).toBe('SUSPENDED');
        expect(written.subscription?.graceStartedAt).toEqual(graceStartedAt);
        expect(written.losses).toHaveLength(1);
        expect(written.losses[0]).toMatchObject({ vertical: 'partner', lostAt: now });
        expect(p.beforeCancel).toHaveBeenCalledTimes(1);
        expect(p.beforeCancel).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'ARREARS_SUSPENSION',
                occurrenceId: fixture.installment.id,
                content: expect.objectContaining({ paymentMethod: 'MANUAL' })
            })
        );
        expect(p.emitCoverageChanged).toHaveBeenCalledTimes(1);
        expect(p.emitCoverageChanged).toHaveBeenCalledWith({
            userId: fixture.payer.id,
            vertical: 'partner',
            sourceType: 'SUBSCRIPTION',
            change: 'REMOVED'
        });
    });

    it.each([
        'ACTIVE',
        'SUSPENDED',
        'PENDING_AUTHORIZATION'
    ] as const)('rejects %s outside grace without writing', async (status) => {
        const fixture = await seed({ status });
        await rejected(
            () => previewManualUnpaidDeclaration(fixture.request),
            'MANUAL_PAYMENT_NOT_IN_GRACE'
        );
        await rejected(
            () => declareManualPaymentUnpaid(fixture.request, ports()),
            'MANUAL_PAYMENT_NOT_IN_GRACE'
        );
        const written = await state(fixture);
        expect(written.subscription?.status).toBe(status);
        expect(written.installment?.status).toBe('AWAITING');
        expect(written.losses).toHaveLength(0);
    });

    it('rejects an open S19 retention without writing', async () => {
        const fixture = await seed();
        await getDb().insert(successionRetainedPayments).values({
            subscriptionId: fixture.subscription.id,
            manualPaymentId: fixture.installment.id,
            unpaidSince: graceStartedAt
        });
        await rejected(() => previewManualUnpaidDeclaration(fixture.request), 'RETAINED_PAYMENT');
        await rejected(
            () => declareManualPaymentUnpaid(fixture.request, ports()),
            'RETAINED_PAYMENT'
        );
        const written = await state(fixture);
        expect(written.installment?.status).toBe('AWAITING');
        expect(written.subscription?.status).toBe('GRACE_PERIOD');
        expect(written.losses).toHaveLength(0);
    });

    it('rolls back the installment when S19 retains the period after the lock', async () => {
        const fixture = await seed();
        const original = manualPaymentModel.markDeclaredUnpaid;
        const spy = vi
            .spyOn(manualPaymentModel, 'markDeclaredUnpaid')
            .mockImplementation(async (input) => {
                const marked = await original.call(manualPaymentModel, input);
                await input.tx.insert(successionRetainedPayments).values({
                    subscriptionId: fixture.subscription.id,
                    manualPaymentId: fixture.installment.id,
                    unpaidSince: graceStartedAt
                });
                return marked;
            });
        try {
            await rejected(
                () => declareManualPaymentUnpaid(fixture.request, ports()),
                'RETAINED_PAYMENT'
            );
        } finally {
            spy.mockRestore();
        }
        const written = await state(fixture);
        expect(written.installment?.status).toBe('AWAITING');
        expect(written.subscription?.status).toBe('GRACE_PERIOD');
        expect(written.losses).toHaveLength(0);
        const retentions = await getDb()
            .select()
            .from(successionRetainedPayments)
            .where(eq(successionRetainedPayments.subscriptionId, fixture.subscription.id));
        expect(retentions).toHaveLength(0);
    });

    it('rejects a live succession predecessor', async () => {
        const fixture = await seed();
        const successor = await seed({ status: 'PENDING_AUTHORIZATION' });
        await getDb()
            .update(subscriptions)
            .set({ succeedsId: fixture.subscription.id })
            .where(eq(subscriptions.id, successor.subscription.id));
        await rejected(
            () => declareManualPaymentUnpaid(fixture.request, ports()),
            'SUCCESSION_IN_PROGRESS'
        );
        const written = await state(fixture);
        expect(written.installment?.status).toBe('AWAITING');
        expect(written.subscription?.status).toBe('GRACE_PERIOD');
    });

    it('keeps the committed suspension when the notice throws', async () => {
        const fixture = await seed();
        const p = ports();
        p.beforeCancel.mockRejectedValueOnce(new Error('notice failed'));
        const result = await declareManualPaymentUnpaid(fixture.request, p);
        expect(result).toEqual({ outcome: 'SUSPENDED', notice: 'FAILED' });
        const written = await state(fixture);
        expect(written.installment?.status).toBe('DECLARED_UNPAID');
        expect(written.subscription?.status).toBe('SUSPENDED');
    });

    it('rejects the missing action permission and a foreign installment', async () => {
        const fixture = await seed();
        const foreign = await seed();
        await rejected(
            () =>
                declareManualPaymentUnpaid(
                    { ...fixture.request, actor: { ...fixture.request.actor, permissions: [] } },
                    ports()
                ),
            'ADMINISTRATIVE_ACTION_FORBIDDEN'
        );
        await rejected(
            () =>
                declareManualPaymentUnpaid(
                    { ...fixture.request, manualPaymentId: foreign.installment.id },
                    ports()
                ),
            'MANUAL_PAYMENT_NOT_FOUND'
        );
        const written = await state(fixture);
        expect(written.installment?.status).toBe('AWAITING');
        expect(written.subscription?.status).toBe('GRACE_PERIOD');
    });

    it('rejects a card subscription', async () => {
        const fixture = await seed({ paymentMethod: 'CARD' });
        await rejected(
            () => declareManualPaymentUnpaid(fixture.request, ports()),
            'MANUAL_PAYMENT_NOT_MANUAL'
        );
        const written = await state(fixture);
        expect(written.installment?.status).toBe('AWAITING');
        expect(written.subscription?.status).toBe('GRACE_PERIOD');
    });
});
