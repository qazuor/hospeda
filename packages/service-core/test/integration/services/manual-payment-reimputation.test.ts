import {
    billingOptions,
    coveredPeriods,
    domainEvent,
    eq,
    manualPayments,
    payments,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { openDueManualInstallments } from '../../../src/services/billing/subscription/open-manual-installment.service';
import { registerLateManualPayment } from '../../../src/services/billing/subscription/register-late-manual-payment.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';

const now = new Date('2026-11-04T12:00:00.000Z');
const oldPeriod = new Date('2026-09-03T12:00:00.000Z');
const clock = { now: () => now };
afterAll(closeServiceTestPool);

async function seed() {
    const db = getServiceTestDb();
    const [payer] = await db
        .insert(users)
        .values({
            email: `mp4-reimpute-${crypto.randomUUID()}@example.test`,
            displayName: 'MP4 Reimputation Payer',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    const [admin] = await db
        .insert(users)
        .values({
            email: `mp4-reimpute-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'MP4 Reimputation Admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!payer || !admin) throw new Error('User fixture failed');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'partner',
            slug: `mp4-reimpute-${crypto.randomUUID()}`,
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
            status: 'SUSPENDED',
            paymentMethod: 'MANUAL',
            planVersionId: version.id,
            billingOptionId: option.id,
            nextChargeAt: oldPeriod,
            graceStartedAt: oldPeriod,
            graceEndsAt: new Date('2026-09-10T12:00:00.000Z')
        })
        .returning();
    if (!subscription) throw new Error('Subscription fixture failed');
    const [installment] = await db
        .insert(manualPayments)
        .values({
            subscriptionId: subscription.id,
            periodStart: oldPeriod,
            status: 'DECLARED_UNPAID'
        })
        .returning();
    if (!installment) throw new Error('Installment fixture failed');
    return {
        payer,
        admin,
        subscription,
        installment,
        request: {
            actor: {
                id: admin.id,
                roles: [RoleEnum.ADMIN],
                permissions: [PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT]
            },
            subscriptionId: subscription.id,
            manualPaymentId: installment.id
        }
    };
}

describe('TEST:B5:9 MP4 reimputation on a freshly migrated database', () => {
    it('moves an expired installment, its coverage and next charge to the activation period', async () => {
        // Arrange
        const fixture = await seed();
        // Act
        const result = await registerLateManualPayment(fixture.request, { clock });
        // Assert
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
        const events = await db
            .select()
            .from(domainEvent)
            .where(eq(domainEvent.entityId, fixture.installment.id));
        expect(result).toMatchObject({
            effect: 'S7',
            periodStart: now,
            reimputedFrom: oldPeriod,
            nextChargeAt: new Date('2026-12-04T12:00:00.000Z')
        });
        expect(installment).toMatchObject({ status: 'REGISTERED', periodStart: now });
        expect(subscription).toMatchObject({
            status: 'ACTIVE',
            nextChargeAt: new Date('2026-12-04T12:00:00.000Z')
        });
        expect(coverage).toHaveLength(1);
        expect(coverage[0]).toMatchObject({
            periodStart: now,
            manualPaymentId: fixture.installment.id
        });
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            eventType: 'manual_payment.reimputed',
            changes: [
                {
                    field: 'manual_payment.period_start',
                    old: oldPeriod.toISOString(),
                    new: now.toISOString()
                }
            ]
        });
    });

    it('falls back to the original period when the new period is already covered', async () => {
        // Arrange
        const fixture = await seed();
        const db = getServiceTestDb();
        const [payment] = await db
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
        if (!payment) throw new Error('Provider payment fixture failed');
        await db.insert(coveredPeriods).values({
            subscriptionId: fixture.subscription.id,
            paymentId: payment.id,
            periodStart: now,
            creditedAt: now
        });
        // Act
        const result = await registerLateManualPayment(fixture.request, { clock });
        // Assert
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
        expect(result).toMatchObject({
            effect: 'S7',
            periodStart: oldPeriod,
            reimputedFrom: null,
            nextChargeAt: new Date('2026-10-03T12:00:00.000Z')
        });
        expect(installment).toMatchObject({ status: 'REGISTERED', periodStart: oldPeriod });
        expect(subscription).toMatchObject({
            status: 'ACTIVE',
            nextChargeAt: new Date('2026-10-03T12:00:00.000Z')
        });
        expect(coverage).toHaveLength(1);
        expect(coverage[0]).toMatchObject({ periodStart: oldPeriod });
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, fixture.subscription.id));
    });

    it('does not open another installment in the activation instant', async () => {
        // Arrange
        const fixture = await seed();
        await registerLateManualPayment(fixture.request, { clock });
        // Act
        const opened = await openDueManualInstallments({ pageSize: 1 }, { clock });
        // Assert
        expect(opened.opened).toBe(0);
        const installments = await getServiceTestDb()
            .select()
            .from(manualPayments)
            .where(eq(manualPayments.subscriptionId, fixture.subscription.id));
        expect(installments).toHaveLength(1);
        expect(installments[0]).toMatchObject({ status: 'REGISTERED', periodStart: now });
    });
});
