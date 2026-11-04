import {
    billingOptions,
    coverageLosses,
    eq,
    manualPayments,
    plans,
    planVersions,
    subscriptions,
    userRole,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { declareManualPaymentUnpaid } from '../../../src/services/billing/subscription/declare-manual-unpaid.service';
import { enterManualGraceInTx } from '../../../src/services/billing/subscription/manual-grace-entry';
import { openDueManualInstallments } from '../../../src/services/billing/subscription/open-manual-installment.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';

const now = new Date('2026-09-04T12:00:00.000Z');
const previousPeriod = new Date('2026-07-03T12:00:00.000Z');
const duePeriod = new Date('2026-08-03T12:00:00.000Z');
const clock = { now: () => now };
afterAll(closeServiceTestPool);

async function seed(input: {
    readonly status: 'ACTIVE' | 'PENDING_AUTHORIZATION' | 'GRACE_PERIOD';
}) {
    const db = getServiceTestDb();
    const [payer, admin] = await db
        .insert(users)
        .values([
            {
                email: `b7-manual-payer-${crypto.randomUUID()}@example.test`,
                displayName: 'Manual payer',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            },
            {
                email: `b7-manual-admin-${crypto.randomUUID()}@example.test`,
                displayName: 'Manual admin',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            }
        ])
        .returning();
    if (!payer || !admin) throw new Error('User fixture failed');
    await db.insert(userRole).values({ userId: admin.id, role: 'SUPER_ADMIN' });
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'partner',
            slug: `b7-manual-${crypto.randomUUID()}`,
            name: 'Manual plan'
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
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 3000000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('Billing option fixture failed');
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId: payer.id,
            vertical: 'partner',
            class: 'PRINCIPAL',
            paymentMethod: 'MANUAL',
            status: input.status,
            planVersionId: version.id,
            billingOptionId: option.id,
            nextChargeAt: duePeriod,
            ...(input.status === 'GRACE_PERIOD'
                ? { graceStartedAt: previousPeriod, graceEndsAt: now }
                : {})
        })
        .returning();
    if (!subscription) throw new Error('Subscription fixture failed');
    if (input.status === 'ACTIVE')
        await db.insert(manualPayments).values({
            subscriptionId: subscription.id,
            periodStart: previousPeriod,
            status: 'REGISTERED',
            registeredBy: payer.id,
            registeredAt: previousPeriod
        });
    const [installment] =
        input.status === 'ACTIVE'
            ? []
            : await db
                  .insert(manualPayments)
                  .values({
                      subscriptionId: subscription.id,
                      periodStart: duePeriod,
                      status: 'AWAITING'
                  })
                  .returning();
    return { payer, admin, subscription, installment };
}

async function subscriptionState(subscriptionId: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    return row;
}

describe('TEST:B7:3 AC:B7:5 AC:B7:12 — manual payer arrears', () => {
    it('MP5 opens an unpaid due installment and starts S4 in the same act', async () => {
        const fixture = await seed({ status: 'ACTIVE' });
        const opened = await openDueManualInstallments(
            { pageSize: 1000 },
            {
                clock,
                planPolicy: async () => ({
                    graceDays: 9,
                    allowsPause: false,
                    current: true,
                    sellable: true
                })
            }
        );
        const row = await subscriptionState(fixture.subscription.id);
        const installments = await getServiceTestDb()
            .select()
            .from(manualPayments)
            .where(eq(manualPayments.subscriptionId, fixture.subscription.id));
        const installment = installments.find(
            (row) => row.periodStart.getTime() === duePeriod.getTime()
        );
        expect(opened.opened).toBe(1);
        expect(installment?.status).toBe('AWAITING');
        expect(installment?.periodStart).toEqual(duePeriod);
        expect(row?.status).toBe('GRACE_PERIOD');
        expect(row?.graceStartedAt).toEqual(now);
        expect(row?.graceEndsAt).toEqual(new Date(now.getTime() + 9 * 86_400_000));
    });

    it('does not run S4 for the first installment while authorization is pending', async () => {
        const fixture = await seed({ status: 'PENDING_AUTHORIZATION' });
        const opened = await openDueManualInstallments(
            { pageSize: 1000 },
            {
                clock,
                planPolicy: async () => ({
                    graceDays: 9,
                    allowsPause: false,
                    current: true,
                    sellable: true
                })
            }
        );
        if (!fixture.installment) throw new Error('First installment fixture missing');
        const enteredGrace = await getServiceTestDb().transaction((tx) =>
            enterManualGraceInTx({
                tx,
                subscriptionId: fixture.subscription.id,
                now,
                graceDays: 9
            })
        );
        const row = await subscriptionState(fixture.subscription.id);
        const [installment] = await getServiceTestDb()
            .select()
            .from(manualPayments)
            .where(eq(manualPayments.id, fixture.installment.id));
        expect(opened.opened).toBe(0);
        expect(enteredGrace).toBe(false);
        expect(row?.status).toBe('PENDING_AUTHORIZATION');
        expect(row?.graceStartedAt).toBeNull();
        expect(row?.graceEndsAt).toBeNull();
        expect(installment?.status).toBe('AWAITING');
    });

    it('MP2 suspends a manual payer immediately without calling the provider', async () => {
        const fixture = await seed({ status: 'GRACE_PERIOD' });
        if (!fixture.installment) throw new Error('Awaiting installment fixture missing');
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const providerCalls = vi.fn();
        const provider = new Proxy(fake as unknown as PaymentProvider, {
            get(target, property, receiver) {
                const value = Reflect.get(target, property, receiver) as unknown;
                if (typeof value !== 'function') return value;
                return (...args: readonly unknown[]) => {
                    providerCalls(property);
                    return Reflect.apply(value, target, args);
                };
            }
        });
        const request = {
            actor: {
                id: fixture.admin.id,
                roles: [RoleEnum.ADMIN],
                permissions: [PermissionEnum.BILLING_DECLARE_MANUAL_UNPAID]
            },
            subscriptionId: fixture.subscription.id,
            manualPaymentId: fixture.installment.id
        };
        const result = await declareManualPaymentUnpaid(request, {
            clock,
            provider,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
        });
        const row = await subscriptionState(fixture.subscription.id);
        const [installment] = await getServiceTestDb()
            .select()
            .from(manualPayments)
            .where(eq(manualPayments.id, fixture.installment.id));
        const losses = await getServiceTestDb()
            .select()
            .from(coverageLosses)
            .where(eq(coverageLosses.userId, fixture.payer.id));
        expect(result).toEqual({ outcome: 'SUSPENDED', notice: 'SENT' });
        expect(row?.status).toBe('SUSPENDED');
        expect(row?.graceStartedAt).toEqual(previousPeriod);
        expect(installment?.status).toBe('DECLARED_UNPAID');
        expect(losses).toHaveLength(1);
        expect(losses[0]?.lostAt).toEqual(now);
        expect(providerCalls).not.toHaveBeenCalled();
    });
});
