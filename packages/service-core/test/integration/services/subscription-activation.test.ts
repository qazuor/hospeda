import {
    billingDeadlineVersions,
    billingOptions,
    eq,
    plans,
    planVersions,
    providerLinks,
    subscriptions,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service';
import { cancelInheritedTouristVips } from '../../../src/services/billing/subscription/cancel-inherited-tourist-vip.service';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import { startSuccession } from '../../../src/services/billing/subscription/start-succession.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
import { namespaceFake } from './support/payment-provider';
import {
    seedPredecessor,
    seedSuccessionChoice,
    successionClock,
    successionPorts
} from './support/succession-fixtures';
import { noTouristVip } from './support/tourist-vip.ts';

afterAll(closeServiceTestPool);

const values = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
} satisfies BillingDeadlineValues;

async function ensureBillingDeadlineVersion1() {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values })
        .onConflictDoNothing();
}
beforeAll(ensureBillingDeadlineVersion1);

const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };

async function seedChoice(inheritsTouristVip = false) {
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `b3-activation-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 activation user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `b3-activation-${crypto.randomUUID()}`, 'Básico']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('No plan');
    const planVersionId = (
        await getServiceTestPool().query<{ id: string }>(
            `INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause, inherits_tourist_vip)
         VALUES ($1, 'accommodation', $2, true, true, 0, false, $3) RETURNING id`,
            [planId, Math.floor(Math.random() * 100000000) + 1000, inheritsTouristVip]
        )
    ).rows[0]?.id;
    if (!planVersionId) throw new Error('No version');
    const billingOptionId = (
        await getServiceTestPool().query<{ id: string }>(
            `INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
         VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id`,
            [planVersionId]
        )
    ).rows[0]?.id;
    if (!billingOptionId) throw new Error('No option');
    return { userId: user.id, billingOptionId, planVersionId };
}

async function startPending(
    _fake: FakePaymentProvider,
    provider: PaymentProvider,
    inheritsTouristVip = false
) {
    const choice = await seedChoice(inheritsTouristVip);
    const started = await startSubscription(
        { ...choice, returnUrl: 'https://hospeda.example/account' },
        {
            provider,
            clock,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            }),
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: noTouristVip
        }
    );
    return { started, fakeId: started.authorizationId.split(':').at(-1) ?? '', provider, choice };
}

async function status(id: string) {
    const [row] = await getServiceTestDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    return row?.status;
}

// TEST:B3:9 — B4 verifies emission of a source with cobrada: no. B3 can observe
// ACTIVE without a payment; the payment table is not introduced until B5.
describe('TEST:B3:9 authorization activation', () => {
    it('does not emit S2 for a COMPLEMENTO subscription', async () => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'S2 complement fixture' }]
        });
        const provider = namespaceFake(fake);
        const { started } = await startPending(fake, provider);
        await getServiceTestDb()
            .update(subscriptions)
            .set({ class: 'COMPLEMENTO' })
            .where(eq(subscriptions.id, started.subscriptionId));
        await fake.approve({ authorizationId: started.authorizationId.split(':').at(-1) ?? '' });
        const facts: unknown[] = [];
        await activateSubscription(started.subscriptionId, {
            provider,
            clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: noTouristVip,
            billingFacts: { emit: (fact) => facts.push(fact) }
        });
        expect(facts).toHaveLength(0);
    });

    it('TEST:1878:5 emits the committed S2 fact after direct activation', async () => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'S2 analytics fixture' }]
        });
        const provider = namespaceFake(fake);
        const { started, fakeId, choice } = await startPending(fake, provider);
        await fake.approve({ authorizationId: fakeId });
        const facts: unknown[] = [];
        await activateSubscription(started.subscriptionId, {
            provider,
            clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: noTouristVip,
            billingFacts: { emit: (fact) => facts.push(fact) }
        });
        expect(facts).toEqual([
            {
                kind: 'SUBSCRIPTION_ACTIVATED',
                userId: choice.userId,
                vertical: 'accommodation',
                subscriptionId: started.subscriptionId,
                subscriptionClass: 'PRINCIPAL',
                actorKind: 'SYSTEM',
                planVersionId: choice.planVersionId,
                billingOptionId: choice.billingOptionId,
                cycle: 'monthly',
                amountMinor: 250000,
                currency: 'ARS',
                predecessor: undefined,
                occurredAt: clock.now()
            }
        ]);
    });

    it('TEST:1878:5 emits activation and plan change data for a successor', async () => {
        const choice = await seedSuccessionChoice();
        const predecessor = await seedPredecessor({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.predecessorBillingOptionId,
            status: 'ACTIVE',
            honestAboutM1: true
        });
        const successor = await startSuccession(
            {
                userId: choice.user.id,
                billingOptionId: choice.targetBillingOptionId,
                predecessorSubscriptionId: predecessor.predecessor.id,
                returnUrl: 'https://hospeda.example/account'
            },
            successionPorts(predecessor.provider)
        );
        await predecessor.fake.approve({ authorizationId: successor.authorizationId });
        const facts: unknown[] = [];
        await activateSubscription(successor.subscriptionId, {
            provider: predecessor.provider,
            clock: successionClock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: noTouristVip,
            billingFacts: { emit: (fact) => facts.push(fact) },
            changeDirection: async () => ({ direction: 'UP' })
        });
        expect(facts).toEqual([
            {
                kind: 'SUBSCRIPTION_ACTIVATED',
                userId: choice.user.id,
                vertical: 'accommodation',
                subscriptionId: successor.subscriptionId,
                subscriptionClass: 'PRINCIPAL',
                actorKind: 'SYSTEM',
                planVersionId: choice.targetPlanVersionId,
                billingOptionId: choice.targetBillingOptionId,
                cycle: 'quarterly',
                amountMinor: 250000,
                currency: 'ARS',
                predecessor: {
                    planVersionId: choice.planVersionId,
                    cycle: 'monthly',
                    amountMinor: 250000,
                    direction: 'UPGRADE'
                },
                occurredAt: successionClock.now()
            }
        ]);
    });

    it('activates only after a fresh by-id re-read observes authorized, with no payment', async () => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'healthy signup fixture' }]
        });
        const provider = namespaceFake(fake);
        const { started, fakeId } = await startPending(fake, provider);
        const read = vi.spyOn(provider, 'readAuthorization');
        await fake.approve({ authorizationId: fakeId });
        expect(
            await activateSubscription(started.subscriptionId, {
                provider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                touristVipInheritance: noTouristVip
            })
        ).toEqual({
            activated: true,
            subscriptionId: started.subscriptionId
        });
        expect(read).toHaveBeenCalledWith({ authorizationId: started.authorizationId });
        expect(await status(started.subscriptionId)).toBe('ACTIVE');
        // Since B5 (HOS-1549) the payment table exists: activation must write no row to it.
        const payments = await getServiceTestPool().query<{ count: string }>(
            'SELECT count(*)::text AS count FROM payment WHERE subscription_id = $1',
            [started.subscriptionId]
        );
        expect(payments.rows[0]?.count).toBe('0');
    });

    it('keeps pending when the provider still says pending, and does not write a non-pending row', async () => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'healthy signup fixture' }]
        });
        const provider = namespaceFake(fake);
        const { started } = await startPending(fake, provider);
        const facts: unknown[] = [];
        expect(
            (
                await activateSubscription(started.subscriptionId, {
                    provider,
                    clock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                    touristVipInheritance: noTouristVip,
                    billingFacts: { emit: (fact) => facts.push(fact) }
                })
            ).activated
        ).toBe(false);
        expect(await status(started.subscriptionId)).toBe('PENDING_AUTHORIZATION');
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'ABANDONED' })
            .where(eq(subscriptions.id, started.subscriptionId));
        const read = vi.spyOn(provider, 'readAuthorization');
        expect(
            (
                await activateSubscription(started.subscriptionId, {
                    provider,
                    clock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                    touristVipInheritance: noTouristVip
                })
            ).activated
        ).toBe(false);
        expect(read).not.toHaveBeenCalled();
        expect(await status(started.subscriptionId)).toBe('ABANDONED');
        expect(facts).toHaveLength(0);
    });
});

// TEST:B3:28 — S2 activates the inherited title before the notice-gated VIP cancellation.
describe('TEST:B3:28 inherited Tourist VIP at S2', () => {
    it('leaves VIP alive while the plan is pending; then sends notice before cancel with no refund', async () => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'healthy fixture' }]
        });
        const provider = namespaceFake(fake);
        const plan = await startPending(fake, provider, true);
        const [vipPlan] = await getServiceTestDb()
            .insert(plans)
            .values({ vertical: 'tourist', slug: `b3-s2-vip-${crypto.randomUUID()}`, name: 'VIP' })
            .returning();
        const [vipVersion] = await getServiceTestDb()
            .insert(planVersions)
            .values({
                planId: vipPlan!.id,
                vertical: 'tourist',
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning();
        const [vipOption] = await getServiceTestDb()
            .insert(billingOptions)
            .values({
                planVersionId: vipVersion!.id,
                cycle: 'monthly',
                amount: 1000,
                currency: 'ARS'
            })
            .returning();
        const vipAuth = await fake.authorize({
            reference: `vip-${crypto.randomUUID()}`,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'Tourist VIP',
            returnUrl: 'https://hospeda.example/account'
        });
        const [vip] = await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: plan.choice.userId,
                vertical: 'tourist',
                planVersionId: vipVersion!.id,
                billingOptionId: vipOption!.id,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL'
            })
            .returning();
        await getServiceTestDb().insert(providerLinks).values({
            subscriptionId: vip!.id,
            provider: 'MERCADO_PAGO',
            providerId: vipAuth.authorizationId
        });
        expect(await status(vip!.id)).toBe('ACTIVE');
        const events: string[] = [];
        const notice = vi.fn(async () => {
            events.push('notice');
            return 'SENT' as const;
        });
        const originalCancel = provider.cancel.bind(provider);
        const cancel = vi.spyOn(provider, 'cancel').mockImplementation(async (input) => {
            events.push('cancel');
            return originalCancel(input);
        });
        const refund = vi.spyOn(provider, 'refund');
        const ports = {
            provider,
            clock,
            beforeCancelNotice: { beforeCancel: notice },
            touristVipInheritance: { inherits: async (_args: { readonly userId: string }) => true }
        };
        expect(await status(vip!.id)).toBe('ACTIVE');
        await fake.approve({ authorizationId: plan.fakeId });
        const result = await activateSubscription(plan.started.subscriptionId, ports);
        expect(result).toEqual({ activated: true, subscriptionId: plan.started.subscriptionId });
        expect(await status(plan.started.subscriptionId)).toBe('ACTIVE');
        expect(await status(vip!.id)).toBe('CANCELLED');
        expect(events).toEqual(['notice', 'cancel']);
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledWith({ authorizationId: vipAuth.authorizationId });
        expect(refund).not.toHaveBeenCalled();
        expect(await ports.touristVipInheritance.inherits({ userId: plan.choice.userId })).toBe(
            true
        );
        expect(await cancelInheritedTouristVips({ userId: plan.choice.userId }, ports)).toEqual({
            cancelled: 0,
            deferred: 0,
            skipped: 0
        });
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('defers while the email is pending, then cancels through the same outbox event', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const provider = namespaceFake(fake);
        const plan = await startPending(fake, provider);
        const [vipPlan] = await getServiceTestDb()
            .insert(plans)
            .values({
                vertical: 'tourist',
                slug: `b3-s2-retry-${crypto.randomUUID()}`,
                name: 'VIP'
            })
            .returning();
        const [vipVersion] = await getServiceTestDb()
            .insert(planVersions)
            .values({
                planId: vipPlan!.id,
                vertical: 'tourist',
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning();
        const [vipOption] = await getServiceTestDb()
            .insert(billingOptions)
            .values({
                planVersionId: vipVersion!.id,
                cycle: 'monthly',
                amount: 1000,
                currency: 'ARS'
            })
            .returning();
        const vipAuth = await fake.authorize({
            reference: `vip-${crypto.randomUUID()}`,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'Tourist VIP',
            returnUrl: 'https://hospeda.example/account'
        });
        const [vip] = await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: plan.choice.userId,
                vertical: 'tourist',
                planVersionId: vipVersion!.id,
                billingOptionId: vipOption!.id,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL'
            })
            .returning();
        await getServiceTestDb().insert(providerLinks).values({
            subscriptionId: vip!.id,
            provider: 'MERCADO_PAGO',
            providerId: vipAuth.authorizationId
        });
        let delivery: 'NOT_YET_SENT' | 'SENT' = 'NOT_YET_SENT';
        const ports = {
            provider,
            clock,
            beforeCancelNotice: { beforeCancel: async () => delivery },
            touristVipInheritance: { inherits: async (_args: { readonly userId: string }) => true }
        };
        expect(
            await cancelInheritedTouristVips({ userId: plan.choice.userId }, ports)
        ).toMatchObject({ deferred: 1 });
        expect(await status(vip!.id)).toBe('ACTIVE');
        delivery = 'SENT';
        expect(
            await cancelInheritedTouristVips({ userId: plan.choice.userId }, ports)
        ).toMatchObject({ cancelled: 1 });
        expect(await status(vip!.id)).toBe('CANCELLED');
    });

    it.each([
        'NO_RECIPIENT',
        'DELIVERY_EXHAUSTED'
    ] as const)('cancels the VIP after recording the non-deliverable outcome %s', async (outcome) => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const provider = namespaceFake(fake);
        const plan = await startPending(fake, provider, true);
        const [vipPlan] = await getServiceTestDb()
            .insert(plans)
            .values({ vertical: 'tourist', slug: `b3-s2-${crypto.randomUUID()}`, name: 'VIP' })
            .returning();
        const [vipVersion] = await getServiceTestDb()
            .insert(planVersions)
            .values({
                planId: vipPlan!.id,
                vertical: 'tourist',
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning();
        const [vipOption] = await getServiceTestDb()
            .insert(billingOptions)
            .values({
                planVersionId: vipVersion!.id,
                cycle: 'monthly',
                amount: 250000,
                currency: 'ARS'
            })
            .returning();
        const vipAuth = await fake.authorize({
            reference: `vip-${crypto.randomUUID()}`,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'Tourist VIP',
            returnUrl: 'https://hospeda.example/account'
        });
        const [vip] = await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: plan.choice.userId,
                vertical: 'tourist',
                planVersionId: vipVersion!.id,
                billingOptionId: vipOption!.id,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL'
            })
            .returning();
        await getServiceTestDb().insert(providerLinks).values({
            subscriptionId: vip!.id,
            provider: 'MERCADO_PAGO',
            providerId: vipAuth.authorizationId
        });
        const cancel = vi.spyOn(provider, 'cancel');
        const result = await cancelInheritedTouristVips(
            { userId: plan.choice.userId },
            {
                provider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => outcome },
                touristVipInheritance: { inherits: async () => true }
            }
        );
        expect(result).toMatchObject({ cancelled: 1, deferred: 0 });
        expect(cancel).toHaveBeenCalledWith({ authorizationId: vipAuth.authorizationId });
        expect(await status(vip!.id)).toBe('CANCELLED');
    });
});
