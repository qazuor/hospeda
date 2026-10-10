import { billingDeadlineVersions, eq, subscriptions, users } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
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

const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };

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
    return { userId: user.id, billingOptionId };
}

async function startPending(fake: FakePaymentProvider, provider: PaymentProvider) {
    const choice = await seedChoice();
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
            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
        }
    );
    return { started, fakeId: started.authorizationId.split(':').at(-1) ?? '', provider };
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
    it('activates only after a fresh by-id re-read observes authorized, with no payment', async () => {
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'healthy signup fixture' }]
        });
        const provider = namespaceFake(fake);
        const { started, fakeId } = await startPending(fake, provider);
        const read = vi.spyOn(provider, 'readAuthorization');
        await fake.approve({ authorizationId: fakeId });
        expect(await activateSubscription(started.subscriptionId, { provider, clock })).toEqual({
            activated: true,
            subscriptionId: started.subscriptionId
        });
        expect(read).toHaveBeenCalledWith({ authorizationId: started.authorizationId });
        expect(await status(started.subscriptionId)).toBe('ACTIVE');
        const paymentTable = await getServiceTestPool().query<{ present: boolean }>(
            "SELECT to_regclass('public.payment') IS NOT NULL AS present"
        );
        expect(paymentTable.rows[0]?.present).toBe(false);
    });

    it('keeps pending when the provider still says pending, and does not write a non-pending row', async () => {
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'healthy signup fixture' }]
        });
        const provider = namespaceFake(fake);
        const { started } = await startPending(fake, provider);
        expect(
            (await activateSubscription(started.subscriptionId, { provider, clock })).activated
        ).toBe(false);
        expect(await status(started.subscriptionId)).toBe('PENDING_AUTHORIZATION');
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'ABANDONED' })
            .where(eq(subscriptions.id, started.subscriptionId));
        const read = vi.spyOn(provider, 'readAuthorization');
        expect(
            (await activateSubscription(started.subscriptionId, { provider, clock })).activated
        ).toBe(false);
        expect(read).not.toHaveBeenCalled();
        expect(await status(started.subscriptionId)).toBe('ABANDONED');
    });
});
