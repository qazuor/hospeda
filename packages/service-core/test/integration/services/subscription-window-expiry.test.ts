import {
    billingDeadlineVersions,
    billingOptions,
    eq,
    manualPayments,
    plans,
    planVersions,
    providerLinks,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import { type LogEntry, registerHook, unregisterHook } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { sweepInheritedTouristVips } from '../../../src/services/billing/subscription/cancel-inherited-tourist-vip.service';
import { expireAuthorizationWindows } from '../../../src/services/billing/subscription/expire-authorization-windows.service';
import {
    type BeforeCancelNotice,
    startSubscription
} from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
import { namespaceFake } from './support/payment-provider';
import {
    seededSubscriptionIds,
    withSeededSubscriptionSweep
} from './support/subscription-window-sweep';
import { noTouristVip, touristVipInheritanceFromDb } from './support/tourist-vip.ts';

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

const openedAt = new Date('2026-01-01T00:00:00.000Z');
let current = openedAt;
const clock = { now: () => current };
beforeEach(() => {
    current = openedAt;
    vi.restoreAllMocks();
});
afterEach(() => unregisterHook('b3-window-expiry-test'));
afterEach(() => seededSubscriptionIds.clear());
/** Runs the expiry service against only this test's seeded subscriptions. */
function expireOwnAuthorizationWindows(
    limit: number,
    ports: Parameters<typeof expireAuthorizationWindows>[1]
) {
    return withSeededSubscriptionSweep(limit, () => expireAuthorizationWindows(limit, ports));
}
function advance(hours: number) {
    current = new Date(openedAt.getTime() + hours * 60 * 60 * 1000);
}

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
    return { userId: user.id, planVersionId, billingOptionId };
}

async function startPending(provider: PaymentProvider, inheritsTouristVip = false) {
    const choice = await seedChoice(inheritsTouristVip);
    const started = await startSubscription(
        {
            userId: choice.userId,
            billingOptionId: choice.billingOptionId,
            returnUrl: 'https://hospeda.example/account'
        },
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
    seededSubscriptionIds.add(started.subscriptionId);
    return { started, fakeId: started.authorizationId.split(':').at(-1) ?? '', choice };
}

async function status(id: string) {
    const [row] = await getServiceTestDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    return row?.status;
}

async function seedManual() {
    const choice = await seedChoice();
    const pending = await subscriptionModel.createPendingAuthorization({
        ...choice,
        vertical: 'accommodation',
        authorizationWindowDeadlineVersion: 1,
        authorizationWindowEndsAt: new Date(openedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    });
    seededSubscriptionIds.add(pending.subscription.id);
    await getServiceTestDb()
        .update(subscriptions)
        .set({ paymentMethod: 'MANUAL' })
        .where(eq(subscriptions.id, pending.subscription.id));
    const [payment] = await getServiceTestDb()
        .insert(manualPayments)
        .values({
            subscriptionId: pending.subscription.id,
            periodStart: openedAt,
            status: 'AWAITING'
        })
        .returning();
    if (!payment) throw new Error('No manual payment');
    return { id: pending.subscription.id, paymentId: payment.id };
}

function setup(billingFacts?: { emit: (fact: unknown) => void }) {
    // M11 remains enabled: a pending fake authorization never expires by itself.
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [{ lie: 'M1', why: 'healthy signup fixture' }]
    });
    const provider = namespaceFake(fake);
    const events: string[] = [];
    const beforeCancel = vi.fn<BeforeCancelNotice['beforeCancel']>(async () => {
        events.push('notice');
        return 'SENT';
    });
    const cancel = vi.spyOn(provider, 'cancel').mockImplementation(async (input) => {
        events.push('cancel');
        return fake.cancel({ authorizationId: input.authorizationId.split(':').at(-1) ?? '' });
    });
    const ports = {
        provider,
        clock,
        beforeCancelNotice: { beforeCancel },
        touristVipInheritance: noTouristVip,
        billingFacts
    };
    return { fake, provider, events, beforeCancel, cancel, ports };
}

// TEST:B3:10 — version 1 stores 72 hours for card and seven calendar days for manual.
describe('TEST:B3:10 authorization window expiry', () => {
    it('TEST:1878:3 emits only the S3 writer with persisted pending duration', async () => {
        const { provider, ports } = setup();
        const pending = await startPending(provider);
        const [persisted] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, pending.started.subscriptionId));
        const facts: unknown[] = [];
        const sink = { emit: (fact: unknown) => facts.push(fact) };
        ports.billingFacts = sink;
        advance(72);
        const summary = await expireOwnAuthorizationWindows(10, ports);
        expect(summary.abandoned).toBe(1);
        expect(facts).toEqual([
            {
                kind: 'CHECKOUT_ABANDONED',
                userId: pending.choice.userId,
                vertical: 'accommodation',
                subscriptionId: pending.started.subscriptionId,
                subscriptionClass: 'PRINCIPAL',
                actorKind: 'SYSTEM',
                reason: 'WINDOW_EXPIRED',
                secondsInPending: Math.max(
                    0,
                    Math.floor((current.getTime() - persisted!.createdAt.getTime()) / 1000)
                ),
                occurredAt: current
            }
        ]);
    });

    it('TEST:1878:3 emits nothing when the S3 write loses its race', async () => {
        const pending = await seedManual();
        const facts: unknown[] = [];
        vi.spyOn(subscriptionModel, 'abandonPendingAuthorization').mockResolvedValue({
            wrote: false,
            closedCourtesyMonths: null
        });
        const { ports } = setup({ emit: (fact) => facts.push(fact) });
        advance(7 * 24);
        const summary = await expireOwnAuthorizationWindows(10, ports);
        expect(summary.skipped).toBe(1);
        expect(facts).toHaveLength(0);
        expect(await status(pending.id)).toBe('PENDING_AUTHORIZATION');
    });

    it('expires card at 72 hours and manual at seven days, closing its awaiting installment', async () => {
        const { provider, ports, beforeCancel, cancel } = setup();
        const card = await startPending(provider);
        const manual = await seedManual();
        advance(72 - 1 / 60);
        expect(await expireOwnAuthorizationWindows(20, ports)).toMatchObject({
            abandoned: 0,
            activated: 0
        });
        advance(72);
        expect(await expireOwnAuthorizationWindows(20, ports)).toMatchObject({
            abandoned: 1,
            activated: 0,
            cancelCalls: 1
        });
        expect(await status(card.started.subscriptionId)).toBe('ABANDONED');
        expect(await status(manual.id)).toBe('PENDING_AUTHORIZATION');
        advance(7 * 24);
        expect(await expireOwnAuthorizationWindows(20, ports)).toMatchObject({
            abandoned: 1,
            cancelCalls: 0
        });
        expect(await status(manual.id)).toBe('ABANDONED');
        const [payment] = await getServiceTestDb()
            .select()
            .from(manualPayments)
            .where(eq(manualPayments.id, manual.paymentId));
        expect(payment?.status).toBe('DECLARED_UNPAID');
        expect(beforeCancel).toHaveBeenCalledTimes(1);
        // TEST:1683:3 AC:1683:2: S3 asks with the only kind that says the window expired.
        expect(beforeCancel.mock.calls[0]?.[0]).toMatchObject({
            subscriptionId: card.started.subscriptionId,
            kind: 'AUTHORIZATION_EXPIRED'
        });
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('chooses S2 when authorization arrives in the last minute, even after the deadline', async () => {
        const { fake, provider, ports, beforeCancel, cancel } = setup();
        const card = await startPending(provider);
        advance(72 - 1 / 60);
        await fake.approve({ authorizationId: card.fakeId });
        advance(72);
        expect(await expireOwnAuthorizationWindows(20, ports)).toMatchObject({
            activated: 1,
            abandoned: 0
        });
        expect(await status(card.started.subscriptionId)).toBe('ACTIVE');
        expect(beforeCancel).not.toHaveBeenCalled();
        expect(cancel).not.toHaveBeenCalled();
    });

    it('uses the stored deadline even if it differs from version 1 current card hours', async () => {
        const { ports } = setup();
        const choice = await seedChoice();
        const pending = await subscriptionModel.createPendingAuthorization({
            ...choice,
            vertical: 'accommodation',
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(openedAt.getTime() + 10 * 60 * 60 * 1000)
        });
        seededSubscriptionIds.add(pending.subscription.id);
        advance(10 - 1 / 60);
        expect((await expireOwnAuthorizationWindows(20, ports)).abandoned).toBe(0);
        advance(10);
        expect((await expireOwnAuthorizationWindows(20, ports)).abandoned).toBe(1);
        expect(await status(pending.subscription.id)).toBe('ABANDONED');
    });
});

// TEST:B3:11 — beforeCancel precedes cancel; no delivery stalls only the call.
describe('TEST:B3:11 notice and provider cancellation', () => {
    it('sends notice first, cancels once, and a fresh fake read sees cancelled', async () => {
        const { fake, provider, ports, events, beforeCancel, cancel } = setup();
        const card = await startPending(provider);
        advance(72);
        expect(await expireOwnAuthorizationWindows(20, ports)).toMatchObject({
            abandoned: 1,
            cancelCalls: 1
        });
        expect(events).toEqual(['notice', 'cancel']);
        expect(
            (await fake.readAuthorization({ authorizationId: card.fakeId })).snapshot.status
        ).toBe('cancelled');
        await expireOwnAuthorizationWindows(20, ports);
        expect(beforeCancel).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('does not cancel while the notice is pending, but still abandons', async () => {
        const { provider, ports, beforeCancel, cancel } = setup();
        beforeCancel.mockResolvedValue('NOT_YET_SENT');
        const card = await startPending(provider);
        advance(72);
        expect(await expireOwnAuthorizationWindows(20, ports)).toMatchObject({
            abandoned: 1,
            noticePending: 1,
            cancelCalls: 0
        });
        expect(cancel).not.toHaveBeenCalled();
        expect(await status(card.started.subscriptionId)).toBe('ABANDONED');
    });

    it.each([
        'NO_RECIPIENT',
        'DELIVERY_EXHAUSTED'
    ] as const)('cancels and escalates for %s', async (outcome) => {
        const warnings: LogEntry[] = [];
        registerHook('b3-window-expiry-test', (entry) => {
            if (entry.level === 'WARN' && entry.category === 'subscription-window-expiry') {
                warnings.push(entry);
            }
        });
        const { provider, ports, beforeCancel, cancel } = setup();
        beforeCancel.mockResolvedValue(outcome);
        const card = await startPending(provider);
        advance(72);
        expect(await expireOwnAuthorizationWindows(20, ports)).toMatchObject({
            abandoned: 1,
            cancelCalls: 1
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(await status(card.started.subscriptionId)).toBe('ABANDONED');
        expect(
            warnings.some(
                (entry) =>
                    JSON.stringify(entry.data).includes(card.started.subscriptionId) &&
                    JSON.stringify(entry.data).includes(outcome)
            )
        ).toBe(true);
    });

    it('abandons even when the provider cancel call fails', async () => {
        const errors: LogEntry[] = [];
        registerHook('b3-window-expiry-test', (entry) => {
            if (entry.level === 'ERROR' && entry.category === 'subscription-window-expiry') {
                errors.push(entry);
            }
        });
        const { provider, ports, cancel } = setup();
        const card = await startPending(provider);
        cancel.mockRejectedValueOnce(new Error('transient provider failure'));
        advance(72);
        expect(await expireOwnAuthorizationWindows(20, ports)).toMatchObject({
            abandoned: 1,
            cancelCalls: 1
        });
        expect(await status(card.started.subscriptionId)).toBe('ABANDONED');
        expect(
            errors.some((entry) => JSON.stringify(entry.data).includes(card.started.subscriptionId))
        ).toBe(true);
    });

    it('skips notice and cancel if the provider is already cancelled', async () => {
        const { fake, provider, ports, beforeCancel, cancel } = setup();
        const card = await startPending(provider);
        await fake.cancel({ authorizationId: card.fakeId });
        advance(72);
        expect(await expireOwnAuthorizationWindows(20, ports)).toMatchObject({
            abandoned: 1,
            cancelCalls: 0
        });
        expect(beforeCancel).not.toHaveBeenCalled();
        expect(cancel).not.toHaveBeenCalled();
    });

    it('never calls notice or cancel for a manual payer', async () => {
        const { ports, beforeCancel, cancel } = setup();
        const manual = await seedManual();
        advance(7 * 24);
        expect((await expireOwnAuthorizationWindows(20, ports)).abandoned).toBe(1);
        expect(await status(manual.id)).toBe('ABANDONED');
        expect(beforeCancel).not.toHaveBeenCalled();
        expect(cancel).not.toHaveBeenCalled();
    });

    it('keeps the predecessor link on an abandoned successor', async () => {
        const { ports } = setup();
        const choice = await seedChoice();
        const predecessor = await subscriptionModel.createPendingAuthorization({
            ...choice,
            vertical: 'accommodation',
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(openedAt.getTime() + 24 * 60 * 60 * 1000)
        });
        seededSubscriptionIds.add(predecessor.subscription.id);
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, predecessor.subscription.id));
        const successor = await subscriptionModel.createPendingAuthorization({
            ...choice,
            vertical: 'accommodation',
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(openedAt.getTime() + 10 * 60 * 60 * 1000)
        });
        seededSubscriptionIds.add(successor.subscription.id);
        await getServiceTestDb()
            .update(subscriptions)
            .set({ succeedsId: predecessor.subscription.id })
            .where(eq(subscriptions.id, successor.subscription.id));
        advance(10);
        expect((await expireOwnAuthorizationWindows(20, ports)).abandoned).toBe(1);
        const [row] = await getServiceTestDb()
            .select({ status: subscriptions.status, succeedsId: subscriptions.succeedsId })
            .from(subscriptions)
            .where(eq(subscriptions.id, successor.subscription.id));
        expect(row).toEqual({ status: 'ABANDONED', succeedsId: predecessor.subscription.id });
    });
});

// TEST:B3:37 — S3 abandons the pending title and leaves an existing VIP mandate alone.
describe('TEST:B3:37 inherited Tourist VIP at S3', () => {
    it('abandons the plan at 72 hours; its VIP remains active after the retry sweep', async () => {
        const { fake, provider, ports, cancel } = setup();
        const plan = await startPending(provider, true);
        const vipPlan = await getServiceTestDb()
            .insert(plans)
            .values({
                vertical: 'tourist',
                slug: `b3-vip-${crypto.randomUUID()}`,
                name: 'Tourist VIP'
            })
            .returning();
        const vipVersion = await getServiceTestDb()
            .insert(planVersions)
            .values({
                planId: vipPlan[0]!.id,
                vertical: 'tourist',
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning();
        const vipOption = await getServiceTestDb()
            .insert(billingOptions)
            .values({
                planVersionId: vipVersion[0]!.id,
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
        const vip = await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: plan.choice.userId,
                vertical: 'tourist',
                planVersionId: vipVersion[0]!.id,
                billingOptionId: vipOption[0]!.id,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL'
            })
            .returning();
        await getServiceTestDb().insert(providerLinks).values({
            subscriptionId: vip[0]!.id,
            provider: 'MERCADO_PAGO',
            providerId: vipAuth.authorizationId
        });
        const inherits = vi.spyOn(touristVipInheritanceFromDb, 'inherits');
        const inheritingPorts = { ...ports, touristVipInheritance: touristVipInheritanceFromDb };
        advance(72);
        expect(await expireOwnAuthorizationWindows(20, inheritingPorts)).toMatchObject({
            abandoned: 1,
            activated: 0
        });
        expect(await status(plan.started.subscriptionId)).toBe('ABANDONED');
        expect(await status(vip[0]!.id)).toBe('ACTIVE');
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledWith({ authorizationId: plan.started.authorizationId });
        expect(
            await sweepInheritedTouristVips(100, {
                provider,
                clock,
                beforeCancelNotice: ports.beforeCancelNotice,
                touristVipInheritance: touristVipInheritanceFromDb
            })
        ).toEqual({ cancelled: 0, deferred: 0, skipped: 0 });
        expect(await status(vip[0]!.id)).toBe('ACTIVE');
        expect(inherits).not.toHaveBeenCalled();
    });
});

// TEST:B3:28 (7) — expiry that re-reads an active authorization runs S2's VIP clause.
describe('TEST:B3:28 inherited Tourist VIP at S2 from expiry', () => {
    it('cancels the inherited VIP when the expiring plan authorization is active', async () => {
        const { fake, provider, ports } = setup();
        const plan = await startPending(provider, true);
        const [vipPlan] = await getServiceTestDb()
            .insert(plans)
            .values({
                vertical: 'tourist',
                slug: `b3-expiry-vip-${crypto.randomUUID()}`,
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
            amount: { amountMinor: 25000, currency: 'ARS' },
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
        await fake.approve({ authorizationId: plan.fakeId });
        advance(72);
        const result = await expireOwnAuthorizationWindows(20, {
            ...ports,
            touristVipInheritance: { inherits: async () => true }
        });
        expect(result).toMatchObject({ activated: 1, abandoned: 0, touristVipCancelled: 1 });
        expect(await status(plan.started.subscriptionId)).toBe('ACTIVE');
        expect(await status(vip!.id)).toBe('CANCELLED');
    });
});
