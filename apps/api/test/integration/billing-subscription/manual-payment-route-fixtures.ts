import {
    billingOptions,
    coveredPeriods,
    eq,
    getDb,
    manualPayments,
    plans,
    planVersions,
    receipts,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum } from '@repo/schemas';

/** Fixed instant used by every route request in this suite. */
export const NOW = new Date('2026-09-04T12:00:00.000Z');
/** Start of a newly opened manual installment. */
export const PERIOD_START = new Date('2026-09-03T12:00:00.000Z');

/** Clock shared by the app and its fake provider. */
export const clock = { now: () => NOW };
/** Local fake only; these tests never call Mercado Pago. */
export const fake = new FakePaymentProvider({
    idNamespace: crypto.randomUUID(),
    clock,
    honestAbout: [
        { lie: 'M1', why: 'manual route fixture' },
        { lie: 'M6', why: 'manual route fixture' }
    ]
});

/** Request headers for a mock authenticated actor. */
export function actorHeaders(id: string, permissions: readonly PermissionEnum[]) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': id,
        'x-mock-actor-role': 'SUPER_ADMIN',
        'x-mock-actor-permissions': JSON.stringify([
            PermissionEnum.ACCESS_PANEL_ADMIN,
            ...permissions
        ])
    };
}

/** Seed only the rows needed by one manual payment route case. */
export async function seedManualRoute(
    input: {
        readonly status?: 'PENDING_AUTHORIZATION' | 'ACTIVE' | 'GRACE_PERIOD';
        readonly prior?: boolean;
    } = {}
) {
    const db = getDb();
    const [payer, admin] = await db
        .insert(users)
        .values([
            {
                email: `manual-route-payer-${crypto.randomUUID()}@example.test`,
                displayName: 'Manual payer',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            },
            {
                email: `manual-route-admin-${crypto.randomUUID()}@example.test`,
                displayName: 'Manual admin',
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
            slug: `manual-route-${crypto.randomUUID()}`,
            name: 'Manual route plan'
        })
        .returning();
    if (!plan) throw new Error('Plan fixture failed');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'partner',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('Plan version fixture failed');
    const [option] = await db
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 3000000,
            currency: 'ARS'
        })
        .returning();
    if (!option) throw new Error('Billing option fixture failed');
    const status = input.status ?? 'PENDING_AUTHORIZATION';
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId: payer.id,
            vertical: 'partner',
            class: 'PRINCIPAL',
            status,
            paymentMethod: 'MANUAL',
            planVersionId: version.id,
            billingOptionId: option.id,
            nextChargeAt:
                status === 'PENDING_AUTHORIZATION' ? null : new Date('2026-09-20T12:00:00.000Z'),
            ...(status === 'GRACE_PERIOD'
                ? {
                      graceStartedAt: PERIOD_START,
                      graceEndsAt: new Date('2026-09-20T12:00:00.000Z')
                  }
                : {})
        })
        .returning();
    if (!subscription) throw new Error('Subscription fixture failed');
    let priorId: string | null = null;
    if (input.prior) {
        const [prior] = await db
            .insert(manualPayments)
            .values({
                subscriptionId: subscription.id,
                periodStart: new Date('2026-08-03T12:00:00.000Z'),
                status: 'REGISTERED',
                registeredBy: admin.id,
                registeredAt: NOW
            })
            .returning({ id: manualPayments.id });
        priorId = prior?.id ?? null;
    }
    const [installment] = await db
        .insert(manualPayments)
        .values({
            subscriptionId: subscription.id,
            periodStart: PERIOD_START,
            status: 'AWAITING'
        })
        .returning();
    if (!installment) throw new Error('Installment fixture failed');
    return { payer, admin, subscription, installment, priorId };
}

/** Read the business columns of exactly one seeded subscription and installment. */
export async function stateOf(subscriptionId: string, manualPaymentId: string) {
    const db = getDb();
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    const [installment] = await db
        .select()
        .from(manualPayments)
        .where(eq(manualPayments.id, manualPaymentId));
    const coverage = await db
        .select()
        .from(coveredPeriods)
        .where(eq(coveredPeriods.manualPaymentId, manualPaymentId));
    const receipt = await db
        .select()
        .from(receipts)
        .where(eq(receipts.manualPaymentId, manualPaymentId));
    return { subscription, installment, coverage, receipt };
}
