import {
    eq,
    getDb,
    idempotencyKeys,
    providerLinks,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { getCurrentBillingDeadlines } from '../../../src/services/billing/deadlines/billing-deadlines.service';
import {
    type BeforeCancelNotice,
    type StartSubscriptionPorts,
    type StartSubscriptionResult,
    startSubscription
} from '../../../src/services/billing/subscription/start-subscription.service';
import { ServiceError } from '../../../src/types';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';

afterAll(closeServiceTestPool);
afterEach(() => vi.restoreAllMocks());

const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
const returnUrl = 'https://hospeda.example/account';
const amount = { amountMinor: 250000, currency: 'ARS' };
const cadence = { everyMonths: 3 };
const reason = 'Básico';

/** Each in-memory fake starts its ids at one; namespace its ids for the shared DB UNIQUE. */
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

async function seedChoice(cycle = 'quarterly') {
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `b3-conc-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 concurrency user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `b3-conc-${crypto.randomUUID()}`, 'Básico']
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
    const billingOptionId = await seedOption(planVersionId, cycle);
    return { user, planVersionId, billingOptionId };
}

async function seedOption(planVersionId: string, cycle = 'monthly') {
    const id = (
        await getServiceTestPool().query<{ id: string }>(
            `INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
         VALUES ($1, $2, 250000, 'ARS') RETURNING id`,
            [planVersionId, cycle]
        )
    ).rows[0]?.id;
    if (!id) throw new Error('No option');
    return id;
}

function ports(
    provider: PaymentProvider,
    notice: BeforeCancelNotice = { beforeCancel: async () => 'SENT' },
    injectedClock: { now: () => Date } = clock
): StartSubscriptionPorts {
    return {
        provider,
        clock: injectedClock,
        planPolicy: async () => ({
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        beforeCancelNotice: notice
    };
}

/** Commits a live PENDING row with a completed, reusable key. */
async function completeCommitment(input: {
    userId: string;
    planVersionId: string;
    billingOptionId: string;
    provider: PaymentProvider;
}) {
    const prior = await subscriptionModel.createPendingAuthorization({
        userId: input.userId,
        vertical: 'accommodation',
        planVersionId: input.planVersionId,
        billingOptionId: input.billingOptionId
    });
    const created = await input.provider.authorize({
        reference: prior.subscription.id,
        amount,
        cadence,
        reason,
        returnUrl
    });
    const checkoutUrl = `https://mp.test/checkout/${crypto.randomUUID()}`;
    await subscriptionModel.recordAuthorizationResult({
        idempotencyKey: prior.idempotencyKey,
        subscriptionId: prior.subscription.id,
        provider: 'MERCADO_PAGO',
        providerId: created.authorizationId,
        result: { authorizationId: created.authorizationId, applied: true, checkoutUrl },
        completedAt: clock.now()
    });
    return { prior, created, checkoutUrl };
}

async function counts(userId: string) {
    const subRows = await getDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId));
    const sub = subRows[0];
    const keyRows = sub
        ? await getDb().select().from(idempotencyKeys).where(eq(idempotencyKeys.subjectId, sub.id))
        : [];
    const linkRows = sub
        ? await getDb().select().from(providerLinks).where(eq(providerLinks.subscriptionId, sub.id))
        : [];
    return { subscriptions: subRows.length, keys: keyRows.length, links: linkRows.length };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (!predicate()) {
        if (Date.now() > deadline) throw new Error('waitUntil timed out');
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}

describe('TEST:B3:6 ten simultaneous signups of one user + vertical', () => {
    it('leaves one row, one key and one provider id, persisting the key before the call', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'inspect a healthy creation under the race' }]
        });
        const provider = namespaceFake(fake);
        const original = fake.authorize.bind(fake);
        const sent = vi.spyOn(fake, 'authorize').mockImplementation(async (input) => {
            const [row] = await getDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, input.reference));
            expect(row?.status).toBe('PENDING_AUTHORIZATION');
            const [key] = await getDb()
                .select()
                .from(idempotencyKeys)
                .where(eq(idempotencyKeys.subjectId, input.reference));
            expect(key?.key).toMatch(/^[0-9a-f-]{36}$/);
            expect(key?.completedAt).toBeNull();
            return original(input);
        });

        const settled = await Promise.allSettled(
            Array.from({ length: 10 }, () =>
                startSubscription(
                    {
                        userId: choice.user.id,
                        billingOptionId: choice.billingOptionId,
                        returnUrl
                    },
                    ports(provider)
                )
            )
        );

        expect(sent).toHaveBeenCalledOnce();
        const fulfilled = settled.filter(
            (r): r is PromiseFulfilledResult<StartSubscriptionResult> => r.status === 'fulfilled'
        );
        const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
        expect(fulfilled.length).toBeGreaterThanOrEqual(1);
        expect(rejected.length).toBeGreaterThanOrEqual(1);
        for (const result of fulfilled) {
            expect(result.value.subscriptionId).toBe(fulfilled[0]?.value.subscriptionId);
            expect(result.value.checkoutUrl).toBe(fulfilled[0]?.value.checkoutUrl);
        }
        for (const result of rejected) {
            expect(result.reason).toBeInstanceOf(ServiceError);
            expect((result.reason as ServiceError).reason).toBe('COMMITMENT_TAKEN');
        }
        expect(await counts(choice.user.id)).toEqual({ subscriptions: 1, keys: 1, links: 1 });
    });

    it('holds the winner in authorize while the other nine are refused, then completes', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'make the fixture healthy' }]
        });
        const provider = namespaceFake(fake);
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const realAuthorize = fake.authorize.bind(fake);
        const authorize = vi.spyOn(fake, 'authorize').mockImplementation(async (input) => {
            await gate;
            return realAuthorize(input);
        });

        let rejected = 0;
        const calls = Array.from({ length: 10 }, () =>
            startSubscription(
                { userId: choice.user.id, billingOptionId: choice.billingOptionId, returnUrl },
                ports(provider)
            ).then(
                (value) => ({ status: 'fulfilled' as const, value }),
                (error: unknown) => {
                    rejected += 1;
                    return { status: 'rejected' as const, error };
                }
            )
        );

        await waitUntil(() => rejected === 9);
        expect(authorize).toHaveBeenCalledOnce();
        release();
        const results = await Promise.all(calls);
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        for (const result of results) {
            if (result.status === 'rejected') {
                expect(result.error).toBeInstanceOf(ServiceError);
                expect((result.error as ServiceError).reason).toBe('COMMITMENT_TAKEN');
            }
        }
        expect(await counts(choice.user.id)).toEqual({ subscriptions: 1, keys: 1, links: 1 });
    });
});

describe('TEST:B3:6 race and reuse', () => {
    it('reuses the live row when the insert loses the race and the database rejects it', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'make the fixture healthy' }]
        });
        const provider = namespaceFake(fake);
        const { prior, created, checkoutUrl } = await completeCommitment({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.billingOptionId,
            provider
        });
        const authorize = vi.spyOn(fake, 'authorize');
        const read = vi.spyOn(subscriptionModel, 'findLiveCommitment').mockResolvedValueOnce(null);

        const result = await startSubscription(
            { userId: choice.user.id, billingOptionId: choice.billingOptionId, returnUrl },
            ports(provider)
        );

        expect(result).toEqual({
            subscriptionId: prior.subscription.id,
            authorizationId: created.authorizationId,
            checkoutUrl
        });
        expect(authorize).not.toHaveBeenCalled();
        expect(read).toHaveBeenCalledTimes(2);
        expect(await counts(choice.user.id)).toEqual({ subscriptions: 1, keys: 1, links: 1 });
    });

    it('answers the same stored result on a retry after the winner completed', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'make the fixture healthy' }]
        });
        const provider = namespaceFake(fake);
        const authorize = vi.spyOn(fake, 'authorize');
        const input = {
            userId: choice.user.id,
            billingOptionId: choice.billingOptionId,
            returnUrl
        };

        const first = await startSubscription(input, ports(provider));
        const second = await startSubscription(input, ports(provider));

        expect(second).toEqual(first);
        expect(authorize).toHaveBeenCalledOnce();
        expect(await counts(choice.user.id)).toEqual({ subscriptions: 1, keys: 1, links: 1 });
    });

    it('refuses another billing option of the same version', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'make the fixture healthy' }]
        });
        const provider = namespaceFake(fake);
        await completeCommitment({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.billingOptionId,
            provider
        });
        const otherOptionId = await seedOption(choice.planVersionId, 'monthly');
        const authorize = vi.spyOn(fake, 'authorize');

        await expect(
            startSubscription(
                { userId: choice.user.id, billingOptionId: otherOptionId, returnUrl },
                ports(provider)
            )
        ).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });
        expect(authorize).not.toHaveBeenCalled();
        expect(await counts(choice.user.id)).toEqual({ subscriptions: 1, keys: 1, links: 1 });
    });

    it('refuses a live row whose reuse window has expired', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'make the fixture healthy' }]
        });
        const provider = namespaceFake(fake);
        const { prior } = await completeCommitment({
            userId: choice.user.id,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.billingOptionId,
            provider
        });
        const deadlines = await getCurrentBillingDeadlines();
        const expiredAt = new Date(
            prior.subscription.createdAt.getTime() +
                (deadlines.values['10'].cardHours + 1) * 60 * 60 * 1000
        );
        const authorize = vi.spyOn(fake, 'authorize');

        await expect(
            startSubscription(
                { userId: choice.user.id, billingOptionId: choice.billingOptionId, returnUrl },
                ports(provider, undefined, { now: () => expiredAt })
            )
        ).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });
        expect(authorize).not.toHaveBeenCalled();
        expect(await counts(choice.user.id)).toEqual({ subscriptions: 1, keys: 1, links: 1 });
    });

    it('refuses a live row whose key is still in flight (no result yet)', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'make the fixture healthy' }]
        });
        const provider = namespaceFake(fake);
        await subscriptionModel.createPendingAuthorization({
            userId: choice.user.id,
            vertical: 'accommodation',
            planVersionId: choice.planVersionId,
            billingOptionId: choice.billingOptionId
        });
        const authorize = vi.spyOn(fake, 'authorize');

        await expect(
            startSubscription(
                { userId: choice.user.id, billingOptionId: choice.billingOptionId, returnUrl },
                ports(provider)
            )
        ).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });
        expect(authorize).not.toHaveBeenCalled();
        // No provider call ever happened, so the in-flight row has no link yet.
        expect(await counts(choice.user.id)).toEqual({ subscriptions: 1, keys: 1, links: 0 });
    });

    it('refuses a live row whose creation did not apply (applied false)', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'make the fixture healthy' }]
        });
        const provider = namespaceFake(fake);
        const prior = await subscriptionModel.createPendingAuthorization({
            userId: choice.user.id,
            vertical: 'accommodation',
            planVersionId: choice.planVersionId,
            billingOptionId: choice.billingOptionId
        });
        await subscriptionModel.recordAuthorizationResult({
            idempotencyKey: prior.idempotencyKey,
            subscriptionId: prior.subscription.id,
            provider: 'MERCADO_PAGO',
            providerId: `b3-not-applied-${crypto.randomUUID()}`,
            result: { authorizationId: 'b3-not-applied', applied: false, fields: ['cadence'] },
            completedAt: clock.now()
        });
        const authorize = vi.spyOn(fake, 'authorize');

        await expect(
            startSubscription(
                { userId: choice.user.id, billingOptionId: choice.billingOptionId, returnUrl },
                ports(provider)
            )
        ).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });
        expect(authorize).not.toHaveBeenCalled();
        expect(await counts(choice.user.id)).toEqual({ subscriptions: 1, keys: 1, links: 1 });
    });
});
