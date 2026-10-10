// TEST:B3:13 (an ABANDONED subscription never becomes ACTIVE)
import {
    billingDeadlineVersions,
    eq,
    idempotencyKeys,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service.ts';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service.ts';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';

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
beforeAll(async () => {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values })
        .onConflictDoNothing();
});
afterAll(closeServiceTestPool);
const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };

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
            email: `b3-abandoned-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 abandoned user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `b3-abandoned-${crypto.randomUUID()}`, 'Básico']
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

function setup() {
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [{ lie: 'M1', why: 'healthy signup fixture' }]
    });
    const provider = namespaceFake(fake);
    const authorize = vi.spyOn(fake, 'authorize');
    return { fake, provider, authorize };
}
async function start(
    choice: { userId: string; billingOptionId: string },
    provider: PaymentProvider
) {
    return startSubscription(
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
            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
        }
    );
}
async function status(id: string) {
    const [row] = await getServiceTestDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    return row?.status;
}
async function key(id: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.subjectId, id));
    expect(row?.operation).toBe('PREAPPROVAL_CREATE');
    return row?.key;
}
async function abandon(id: string) {
    expect(
        await subscriptionModel.abandonPendingAuthorization({
            subscriptionId: id,
            now: clock.now()
        })
    ).toEqual({ wrote: true, closedCourtesyMonths: null });
}

describe('TEST:B3:13 ABANDONED never returns to ACTIVE', () => {
    it('case A: cancelled preapproval and late notice leave the old row abandoned', async () => {
        const { fake, provider } = setup();
        const choice = await seedChoice();
        const first = await start(choice, provider);
        await abandon(first.subscriptionId);
        await fake.cancel({ authorizationId: first.authorizationId.split(':').at(-1)! });
        expect(
            (await activateSubscription(first.subscriptionId, { provider, clock })).activated
        ).toBe(false);
        expect(await status(first.subscriptionId)).toBe('ABANDONED');
    });

    it('case B: even authorized provider state cannot activate an abandoned row', async () => {
        const { fake, provider } = setup();
        const choice = await seedChoice();
        const first = await start(choice, provider);
        await abandon(first.subscriptionId);
        await fake.approve({ authorizationId: first.authorizationId.split(':').at(-1)! });
        expect(
            (await activateSubscription(first.subscriptionId, { provider, clock })).activated
        ).toBe(false);
        expect(await status(first.subscriptionId)).toBe('ABANDONED');
        expect(
            await subscriptionModel.activatePendingAuthorization({
                subscriptionId: first.subscriptionId,
                now: clock.now()
            })
        ).toBe(false);
        expect(await status(first.subscriptionId)).toBe('ABANDONED');
    });

    it('retry uses the same user and option, mints a new key, and calls authorize again', async () => {
        const { provider, authorize } = setup();
        const choice = await seedChoice();
        const first = await start(choice, provider);
        const firstKey = await key(first.subscriptionId);
        await abandon(first.subscriptionId);
        const second = await start(choice, provider);
        const secondKey = await key(second.subscriptionId);
        expect(second.subscriptionId).not.toBe(first.subscriptionId);
        expect(secondKey).toBeDefined();
        expect(secondKey).not.toBe(firstKey);
        expect(authorize).toHaveBeenCalledTimes(2);
        expect(await status(first.subscriptionId)).toBe('ABANDONED');
        await abandon(second.subscriptionId);
        expect(await status(second.subscriptionId)).toBe('ABANDONED');
    });
});
