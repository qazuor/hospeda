import {
    billingOptions,
    coveredPeriods,
    emailOutbox,
    eq,
    getDb,
    manualPaymentModel,
    manualPayments,
    payments,
    plans,
    planVersions,
    receipts,
    subscriptions,
    successionRetainedPayments,
    users
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import {
    previewManualPaymentRegistration,
    registerManualPayment
} from '../../../src/services/billing/subscription/register-manual-payment.service';
import { retainPaymentForSuccession } from '../../../src/services/billing/subscription/succession-retained-payment';
import { closeServiceTestPool, getServiceTestDb } from './helpers';

const now = new Date('2026-09-04T12:00:00.000Z');
const periodStart = new Date('2026-09-03T12:00:00.000Z');
const initialNext = new Date('2026-09-20T12:00:00.000Z');
const clock = { now: () => now };
afterAll(closeServiceTestPool);

async function seed(
    input: {
        status?: 'PENDING_AUTHORIZATION' | 'GRACE_PERIOD' | 'ACTIVE';
        cycle?: 'monthly' | 'annual';
        prior?: boolean;
        paymentMethod?: 'MANUAL' | 'CARD';
    } = {}
) {
    const db = getServiceTestDb();
    const [payer] = await db
        .insert(users)
        .values({
            email: `mp1-payer-${crypto.randomUUID()}@example.test`,
            displayName: 'MP1 Payer',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    const [admin] = await db
        .insert(users)
        .values({
            email: `mp1-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'MP1 Admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!payer || !admin) throw new Error('User fixture failed');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'partner',
            slug: `mp1-${crypto.randomUUID()}`,
            name: 'MP1 plan'
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
            cycle: input.cycle ?? 'monthly',
            amount: 3000000,
            currency: 'ARS'
        })
        .returning();
    if (!option) throw new Error('Option fixture failed');
    const status = input.status ?? 'PENDING_AUTHORIZATION';
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId: payer.id,
            vertical: 'partner',
            class: 'PRINCIPAL',
            status,
            paymentMethod: input.paymentMethod ?? 'MANUAL',
            planVersionId: version.id,
            billingOptionId: option.id,
            nextChargeAt: status === 'PENDING_AUTHORIZATION' ? null : initialNext,
            ...(status === 'GRACE_PERIOD'
                ? { graceStartedAt: periodStart, graceEndsAt: initialNext }
                : {})
        })
        .returning();
    if (!subscription) throw new Error('Subscription fixture failed');
    if (input.prior)
        await db.insert(manualPayments).values({
            subscriptionId: subscription.id,
            periodStart: new Date('2026-08-03T12:00:00.000Z'),
            status: 'REGISTERED',
            registeredBy: admin.id,
            registeredAt: now
        });
    const [installment] = await db
        .insert(manualPayments)
        .values({
            subscriptionId: subscription.id,
            periodStart,
            status: 'AWAITING'
        })
        .returning();
    if (!installment) throw new Error('Installment fixture failed');
    const actor = {
        id: admin.id,
        roles: [RoleEnum.ADMIN],
        permissions: [PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT]
    };
    const request = { actor, subscriptionId: subscription.id, manualPaymentId: installment.id };
    return { payer, admin, subscription, installment, actor, request };
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

describe('TEST:B5:7 MP1 / S29 / S5', () => {
    for (const [cycle, next] of [
        ['monthly', '2026-10-03T12:00:00.000Z'],
        ['annual', '2027-09-03T12:00:00.000Z']
    ] as const) {
        it(`registers the first ${cycle} installment and activates once`, async () => {
            // Arrange
            const fixture = await seed({ cycle });
            const preview = await previewManualPaymentRegistration(fixture.request);
            expect(preview).toEqual({
                subscriptionId: fixture.subscription.id,
                manualPaymentId: fixture.installment.id,
                periodStart,
                effect: 'S29',
                nextChargeAt: new Date(next)
            });
            const before = await state(fixture);
            expect(before.installment?.status).toBe('AWAITING');
            expect(before.subscription?.nextChargeAt).toBeNull();
            expect(before.coverage).toHaveLength(0);
            expect(before.receipt).toHaveLength(0);
            // Act
            const result = await registerManualPayment(
                { ...fixture.request, proofRef: 'bank-transfer-123' },
                { clock, afterActivation: async () => ({ touristVipCancelled: 0 }) }
            );
            // Assert
            const rows = await state(fixture);
            expect(result).toEqual({
                outcome: 'REGISTERED',
                effect: 'S29',
                receiptId: rows.receipt[0]?.id,
                receiptNumber: rows.receipt[0]?.receiptNumber,
                nextChargeAt: new Date(next)
            });
            expect(rows.installment).toMatchObject({
                status: 'REGISTERED',
                registeredBy: fixture.admin.id,
                registeredAt: now,
                proofRef: 'bank-transfer-123'
            });
            expect(rows.subscription).toMatchObject({
                status: 'ACTIVE',
                nextChargeAt: new Date(next)
            });
            expect(rows.coverage).toHaveLength(1);
            expect(rows.coverage[0]).toMatchObject({
                manualPaymentId: fixture.installment.id,
                subscriptionId: fixture.subscription.id,
                periodStart,
                creditedAt: now
            });
            expect(rows.receipt).toHaveLength(1);
            expect(rows.receipt[0]).toMatchObject({
                manualPaymentId: fixture.installment.id,
                payerName: fixture.payer.displayName,
                payerEmail: fixture.payer.email,
                issuedAt: now
            });
            const notices = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.payer.id));
            expect(
                notices.filter((row) => row.template === 'billing.signup-confirmed')
            ).toHaveLength(1);
        });
    }

    it('returns a grace installment to active and clears its grace clock', async () => {
        const fixture = await seed({ status: 'GRACE_PERIOD', prior: true });
        const result = await registerManualPayment(fixture.request, { clock });
        const rows = await state(fixture);
        expect(result.effect).toBe('S5');
        expect(rows.subscription).toMatchObject({
            status: 'ACTIVE',
            graceStartedAt: null,
            graceEndsAt: null,
            nextChargeAt: new Date('2026-10-03T12:00:00.000Z')
        });
        expect(rows.receipt).toHaveLength(1);
    });

    it('registers on an active row without changing its status', async () => {
        const fixture = await seed({ status: 'ACTIVE', prior: true });
        const preview = await previewManualPaymentRegistration(fixture.request);
        expect(preview.effect).toBe('NONE');
        const result = await registerManualPayment(fixture.request, { clock });
        const rows = await state(fixture);
        expect(result.outcome).toBe('REGISTERED');
        expect(result.effect).toBe('NONE');
        expect(rows.subscription).toMatchObject({
            status: 'ACTIVE',
            nextChargeAt: new Date('2026-10-03T12:00:00.000Z')
        });
        expect(rows.receipt).toHaveLength(1);
        expect(rows.coverage).toHaveLength(1);
    });

    it('retains a paid installment on a live succession predecessor', async () => {
        const fixture = await seed({ status: 'GRACE_PERIOD', prior: true });
        await getServiceTestDb().insert(subscriptions).values({
            userId: fixture.payer.id,
            vertical: 'partner',
            class: 'PRINCIPAL',
            status: 'ACTIVE',
            paymentMethod: 'MANUAL',
            planVersionId: fixture.subscription.planVersionId,
            billingOptionId: fixture.subscription.billingOptionId,
            succeedsId: fixture.subscription.id
        });
        const result = await registerManualPayment(fixture.request, { clock });
        const rows = await state(fixture);
        const retention = await getServiceTestDb()
            .select()
            .from(successionRetainedPayments)
            .where(eq(successionRetainedPayments.manualPaymentId, fixture.installment.id));
        expect(result.effect).toBe('S19');
        expect(rows.subscription?.status).toBe('GRACE_PERIOD');
        expect(rows.installment?.status).toBe('REGISTERED');
        expect(retention).toHaveLength(1);
        expect(retention[0]).toMatchObject({
            subscriptionId: fixture.subscription.id,
            manualPaymentId: fixture.installment.id,
            paymentId: null,
            releasedAt: null
        });
        const again = await getDb().transaction((tx) =>
            retainPaymentForSuccession({
                subscriptionId: fixture.subscription.id,
                payment: { source: 'MANUAL_PAYMENT', id: fixture.installment.id },
                unpaidSince: periodStart,
                now,
                tx
            })
        );
        expect(again).toEqual({ outcome: 'ALREADY_RETAINED' });
    });

    it('rejects a pending authorization installment that is not first without writes', async () => {
        const fixture = await seed({ prior: true });
        await expect(registerManualPayment(fixture.request, { clock })).rejects.toMatchObject({
            reason: 'MANUAL_PAYMENT_STATE_NOT_ALLOWED'
        });
        const rows = await state(fixture);
        expect(rows.installment?.status).toBe('AWAITING');
        expect(rows.coverage).toHaveLength(0);
        expect(rows.receipt).toHaveLength(0);
        expect(rows.subscription?.nextChargeAt).toBeNull();
    });

    it('rejects undeclared service input fields before writing', async () => {
        const fixture = await seed();
        const withExtra = { ...fixture.request, unexpected: true };
        await expect(previewManualPaymentRegistration(withExtra)).rejects.toThrow();
        await expect(registerManualPayment(withExtra, { clock })).rejects.toThrow();
        const rows = await state(fixture);
        expect(rows.installment?.status).toBe('AWAITING');
        expect(rows.coverage).toHaveLength(0);
        expect(rows.receipt).toHaveLength(0);
    });

    it('hides an installment owned by another subscription and rejects missing permission', async () => {
        const fixture = await seed();
        const other = await seed();
        await expect(
            registerManualPayment(
                {
                    ...fixture.request,
                    manualPaymentId: other.installment.id
                },
                { clock }
            )
        ).rejects.toMatchObject({ reason: 'MANUAL_PAYMENT_NOT_FOUND' });
        await expect(
            registerManualPayment(
                {
                    ...fixture.request,
                    actor: { ...fixture.actor, permissions: [] }
                },
                { clock }
            )
        ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
        const rows = await state(fixture);
        expect(rows.installment?.status).toBe('AWAITING');
        expect(rows.receipt).toHaveLength(0);
        expect(rows.coverage).toHaveLength(0);
    });

    it('serializes concurrent registration and advances the date only once', async () => {
        const fixture = await seed();
        const results = await Promise.allSettled([
            registerManualPayment(fixture.request, { clock }),
            registerManualPayment(fixture.request, { clock })
        ]);
        expect(results.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((entry) => entry.status === 'rejected')).toHaveLength(1);
        const rejected = results.find((entry) => entry.status === 'rejected');
        expect(rejected).toMatchObject({
            status: 'rejected',
            reason: { reason: 'MANUAL_PAYMENT_NOT_AWAITING' }
        });
        const rows = await state(fixture);
        expect(rows.installment?.status).toBe('REGISTERED');
        expect(rows.receipt).toHaveLength(1);
        expect(rows.coverage).toHaveLength(1);
        expect(rows.subscription?.nextChargeAt).toEqual(new Date('2026-10-03T12:00:00.000Z'));
        await expect(registerManualPayment(fixture.request, { clock })).rejects.toMatchObject({
            reason: 'MANUAL_PAYMENT_NOT_AWAITING'
        });
        const wroteAgain = await getDb().transaction((tx) =>
            manualPaymentModel.markRegistered({
                manualPaymentId: fixture.installment.id,
                registeredBy: fixture.actor.id,
                registeredAt: new Date('2026-09-05T12:00:00.000Z'),
                tx
            })
        );
        expect(wroteAgain).toBe(false);
        const unchanged = await state(fixture);
        expect(unchanged.installment?.registeredAt).toEqual(now);
    });

    it('rolls back every write when the period already has card coverage', async () => {
        const fixture = await seed();
        const db = getServiceTestDb();
        const [payment] = await db
            .insert(payments)
            .values({
                subscriptionId: fixture.subscription.id,
                status: 'SUCCEEDED',
                provider: 'MERCADOPAGO',
                providerFactId: `mp1-card-${crypto.randomUUID()}`,
                amount: 3000000,
                currency: 'ARS',
                factAt: now
            })
            .returning();
        if (!payment) throw new Error('Card payment fixture failed');
        await db.insert(coveredPeriods).values({
            subscriptionId: fixture.subscription.id,
            periodStart,
            paymentId: payment.id,
            creditedAt: now
        });
        await expect(registerManualPayment(fixture.request, { clock })).rejects.toMatchObject({
            reason: 'MANUAL_PAYMENT_COVERAGE_CONFLICT'
        });
        const rows = await state(fixture);
        expect(rows.installment?.status).toBe('AWAITING');
        expect(rows.coverage).toHaveLength(0);
        expect(rows.receipt).toHaveLength(0);
        expect(rows.subscription?.nextChargeAt).toBeNull();
    });
});
