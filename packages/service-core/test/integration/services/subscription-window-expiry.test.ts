import {
    billingDeadlineVersions,
    eq,
    manualPayments,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { expireAuthorizationWindows } from '../../../src/services/billing/subscription/expire-authorization-windows.service';
import {
    type BeforeCancelNotice,
    startSubscription
} from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';

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
function advance(hours: number) {
    current = new Date(openedAt.getTime() + hours * 60 * 60 * 1000);
}

/** Namespace the fake's resettable ids because all integration files share a database. */
function namespaceFake(fake: FakePaymentProvider): PaymentProvider {
    const prefix = `${crypto.randomUUID()}:`;
    const external = (id: string) => `${prefix}${id}`;
    const internal = (id: string) => (id.startsWith(prefix) ? id.slice(prefix.length) : id);
    return {
        capabilitySupport: fake.capabilitySupport,
        async authorize(input) {
            const result = await fake.authorize(input);
            return { ...result, authorizationId: external(result.authorizationId) };
        },
        charge: (input) =>
            fake.charge({ ...input, authorizationId: internal(input.authorizationId) }),
        changeAmount: (input) =>
            fake.changeAmount({ ...input, authorizationId: internal(input.authorizationId) }),
        pause: (input) => fake.pause({ authorizationId: internal(input.authorizationId) }),
        resume: (input) => fake.resume({ authorizationId: internal(input.authorizationId) }),
        cancel: (input) => fake.cancel({ authorizationId: internal(input.authorizationId) }),
        refund: (input) => fake.refund(input),
        readAuthorization: (input) =>
            fake.readAuthorization({ authorizationId: internal(input.authorizationId) }),
        readCharge: (input) => fake.readCharge(input),
        decodeNotice: (input) => fake.decodeNotice(input)
    };
}

async function seedChoice() {
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
            `INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
         VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id`,
            [planId, Math.floor(Math.random() * 100000000) + 1000]
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

async function startPending(provider: PaymentProvider) {
    const choice = await seedChoice();
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
            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
        }
    );
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

function setup() {
    // M11 remains enabled: a pending fake authorization never expires by itself.
    const fake = new FakePaymentProvider({
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
    const ports = { provider, clock, beforeCancelNotice: { beforeCancel } };
    return { fake, provider, events, beforeCancel, cancel, ports };
}

// TEST:B3:10 — version 1 stores 72 hours for card and seven calendar days for manual.
describe('TEST:B3:10 authorization window expiry', () => {
    it('expires card at 72 hours and manual at seven days, closing its awaiting installment', async () => {
        const { provider, ports, beforeCancel, cancel } = setup();
        const card = await startPending(provider);
        const manual = await seedManual();
        advance(72 - 1 / 60);
        expect(await expireAuthorizationWindows(20, ports)).toMatchObject({
            abandoned: 0,
            activated: 0
        });
        advance(72);
        expect(await expireAuthorizationWindows(20, ports)).toMatchObject({
            abandoned: 1,
            activated: 0,
            cancelCalls: 1
        });
        expect(await status(card.started.subscriptionId)).toBe('ABANDONED');
        expect(await status(manual.id)).toBe('PENDING_AUTHORIZATION');
        advance(7 * 24);
        expect(await expireAuthorizationWindows(20, ports)).toMatchObject({
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
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('chooses S2 when authorization arrives in the last minute, even after the deadline', async () => {
        const { fake, provider, ports, beforeCancel, cancel } = setup();
        const card = await startPending(provider);
        advance(72 - 1 / 60);
        await fake.approve({ authorizationId: card.fakeId });
        advance(72);
        expect(await expireAuthorizationWindows(20, ports)).toMatchObject({
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
        advance(10 - 1 / 60);
        expect((await expireAuthorizationWindows(20, ports)).abandoned).toBe(0);
        advance(10);
        expect((await expireAuthorizationWindows(20, ports)).abandoned).toBe(1);
        expect(await status(pending.subscription.id)).toBe('ABANDONED');
    });
});

// TEST:B3:11 — beforeCancel precedes cancel; no delivery stalls only the call.
describe('TEST:B3:11 notice and provider cancellation', () => {
    it('sends notice first, cancels once, and a fresh fake read sees cancelled', async () => {
        const { fake, provider, ports, events, beforeCancel, cancel } = setup();
        const card = await startPending(provider);
        advance(72);
        expect(await expireAuthorizationWindows(20, ports)).toMatchObject({
            abandoned: 1,
            cancelCalls: 1
        });
        expect(events).toEqual(['notice', 'cancel']);
        expect(
            (await fake.readAuthorization({ authorizationId: card.fakeId })).snapshot.status
        ).toBe('cancelled');
        await expireAuthorizationWindows(20, ports);
        expect(beforeCancel).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('does not cancel while the notice is pending, but still abandons', async () => {
        const { provider, ports, beforeCancel, cancel } = setup();
        beforeCancel.mockResolvedValue('NOT_YET_SENT');
        const card = await startPending(provider);
        advance(72);
        expect(await expireAuthorizationWindows(20, ports)).toMatchObject({
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
        const { provider, ports, beforeCancel, cancel } = setup();
        beforeCancel.mockResolvedValue(outcome);
        const card = await startPending(provider);
        advance(72);
        expect(await expireAuthorizationWindows(20, ports)).toMatchObject({
            abandoned: 1,
            cancelCalls: 1
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(await status(card.started.subscriptionId)).toBe('ABANDONED');
    });

    it('skips notice and cancel if the provider is already cancelled', async () => {
        const { fake, provider, ports, beforeCancel, cancel } = setup();
        const card = await startPending(provider);
        await fake.cancel({ authorizationId: card.fakeId });
        advance(72);
        expect(await expireAuthorizationWindows(20, ports)).toMatchObject({
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
        expect((await expireAuthorizationWindows(20, ports)).abandoned).toBe(1);
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
        await getServiceTestDb()
            .update(subscriptions)
            .set({ succeedsId: predecessor.subscription.id })
            .where(eq(subscriptions.id, successor.subscription.id));
        advance(10);
        expect((await expireAuthorizationWindows(20, ports)).abandoned).toBe(1);
        const [row] = await getServiceTestDb()
            .select({ status: subscriptions.status, succeedsId: subscriptions.succeedsId })
            .from(subscriptions)
            .where(eq(subscriptions.id, successor.subscription.id));
        expect(row).toEqual({ status: 'ABANDONED', succeedsId: predecessor.subscription.id });
    });
});
