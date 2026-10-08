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
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
    authorizePendingSubscription,
    type BeforeCancelNotice,
    type StartSubscriptionPorts,
    startSubscription
} from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';

afterAll(closeServiceTestPool);

const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
const returnUrl = 'https://hospeda.example/account';

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
            email: `b3-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 test user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `b3-${crypto.randomUUID()}`, 'Básico']
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
         VALUES ($1, $2, 250000, 'ARS') RETURNING id`,
            [planVersionId, cycle]
        )
    ).rows[0]?.id;
    if (!billingOptionId) throw new Error('No option');
    return { user, planVersionId, billingOptionId };
}

function ports(
    provider: PaymentProvider,
    notice: BeforeCancelNotice = { beforeCancel: async () => 'SENT' }
): StartSubscriptionPorts {
    return {
        provider,
        clock,
        planPolicy: async () => ({
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        beforeCancelNotice: notice
    };
}

describe('TEST:B3:1 S1 durable pending authorization', () => {
    it('commits the row and key before authorize, with amount, cycle, reason and reference from our catalog', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'inspect a healthy creation' }]
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
            expect(input).toMatchObject({
                reference: row?.id,
                reason: 'Básico',
                amount: { amountMinor: 250000, currency: 'ARS' },
                cadence: { everyMonths: 3 }
            });
            expect(Object.keys(input)).not.toContain('planId');
            return original(input);
        });
        const result = await startSubscription(
            { userId: choice.user.id, billingOptionId: choice.billingOptionId, returnUrl },
            ports(provider)
        );
        expect(sent).toHaveBeenCalledOnce();
        const [link] = await getDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, result.subscriptionId));
        expect(link?.providerId).toBe(result.authorizationId);
        expect(result.checkoutUrl).not.toContain('activation=');
    });
});

describe('TEST:B3:3 every declined predecessor is reread before new signup', () => {
    it('blocks a live mandate, sends notice before cancellation, and accepts a later call only after a cancelled reread', async () => {
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
        const created = await provider.authorize({
            reference: prior.subscription.id,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 3 },
            reason: 'Básico',
            returnUrl
        });
        await subscriptionModel.recordAuthorizationResult({
            idempotencyKey: prior.idempotencyKey,
            subscriptionId: prior.subscription.id,
            provider: 'MERCADO_PAGO',
            providerId: created.authorizationId,
            result: { authorizationId: created.authorizationId },
            completedAt: clock.now()
        });
        await getDb()
            .update(subscriptions)
            .set({ status: 'CHARGE_DECLINED' })
            .where(eq(subscriptions.id, prior.subscription.id));
        const otherPrior = await subscriptionModel.createPendingAuthorization({
            userId: choice.user.id,
            vertical: 'accommodation',
            planVersionId: choice.planVersionId,
            billingOptionId: choice.billingOptionId
        });
        const otherCreated = await provider.authorize({
            reference: otherPrior.subscription.id,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 3 },
            reason: 'Básico',
            returnUrl
        });
        await subscriptionModel.recordAuthorizationResult({
            idempotencyKey: otherPrior.idempotencyKey,
            subscriptionId: otherPrior.subscription.id,
            provider: 'MERCADO_PAGO',
            providerId: otherCreated.authorizationId,
            result: { authorizationId: otherCreated.authorizationId },
            completedAt: clock.now()
        });
        await getDb()
            .update(subscriptions)
            .set({ status: 'CHARGE_DECLINED' })
            .where(eq(subscriptions.id, otherPrior.subscription.id));
        const order: string[] = [];
        const rereads = vi.spyOn(fake, 'readAuthorization');
        const realCancel = fake.cancel.bind(fake);
        vi.spyOn(fake, 'cancel').mockImplementation(async (input) => {
            order.push('cancel');
            return realCancel(input);
        });
        const notice: BeforeCancelNotice = {
            beforeCancel: async () => {
                order.push('notice');
                return 'SENT';
            }
        };
        await expect(
            startSubscription(
                { userId: choice.user.id, billingOptionId: choice.billingOptionId, returnUrl },
                ports(provider, notice)
            )
        ).rejects.toMatchObject({ reason: 'PREVIOUS_ATTEMPT_CLOSING' });
        expect(order).toEqual(['notice', 'cancel', 'notice', 'cancel']);
        expect(rereads).toHaveBeenCalledTimes(2);
        const rows = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, choice.user.id));
        expect(rows).toHaveLength(2);
        await startSubscription(
            { userId: choice.user.id, billingOptionId: choice.billingOptionId, returnUrl },
            ports(provider, notice)
        );
        expect(order).toEqual(['notice', 'cancel', 'notice', 'cancel']);
        expect(rereads).toHaveBeenCalledTimes(5);
    });

    it('holds the new signup while the before-cancel notice has not gone out', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({ clock });
        const provider = namespaceFake(fake);
        const prior = await subscriptionModel.createPendingAuthorization({
            userId: choice.user.id,
            vertical: 'accommodation',
            planVersionId: choice.planVersionId,
            billingOptionId: choice.billingOptionId
        });
        const created = await provider.authorize({
            reference: prior.subscription.id,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 3 },
            reason: 'Básico',
            returnUrl
        });
        await subscriptionModel.recordAuthorizationResult({
            idempotencyKey: prior.idempotencyKey,
            subscriptionId: prior.subscription.id,
            provider: 'MERCADO_PAGO',
            providerId: created.authorizationId,
            result: { authorizationId: created.authorizationId },
            completedAt: clock.now()
        });
        await getDb()
            .update(subscriptions)
            .set({ status: 'CHARGE_DECLINED' })
            .where(eq(subscriptions.id, prior.subscription.id));
        const cancel = vi.spyOn(fake, 'cancel');
        await expect(
            startSubscription(
                { userId: choice.user.id, billingOptionId: choice.billingOptionId, returnUrl },
                ports(provider, { beforeCancel: async () => 'NOT_YET_SENT' })
            )
        ).rejects.toMatchObject({ reason: 'PREVIOUS_ATTEMPT_CLOSING' });
        expect(cancel).not.toHaveBeenCalled();
        expect(
            await getDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.userId, choice.user.id))
        ).toHaveLength(1);
    });
});

describe('TEST:B3:44 M1 M9 RP1 creation defenses', () => {
    it('detects M1 without exposing a link, then accepts M1 disabled by name', async () => {
        const choice = await seedChoice();
        const pending = await subscriptionModel.createPendingAuthorization({
            userId: choice.user.id,
            vertical: 'accommodation',
            planVersionId: choice.planVersionId,
            billingOptionId: choice.billingOptionId
        });
        const lying = new FakePaymentProvider({ clock });
        const lyingProvider = namespaceFake(lying);
        await expect(
            authorizePendingSubscription({
                pending,
                provider: lyingProvider,
                clock,
                reason: 'Básico',
                returnUrl
            })
        ).rejects.toMatchObject({ reason: 'CREATION_NOT_APPLIED' });
        const [key] = await getDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.key, pending.idempotencyKey));
        expect(key?.result).toMatchObject({ applied: false, fields: ['cadence'] });
        expect(JSON.stringify(key?.result)).not.toContain('checkoutUrl');
        const other = await seedChoice();
        const healthy = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'M1 disabled by name' }]
        });
        const healthyProvider = namespaceFake(healthy);
        await expect(
            startSubscription(
                { userId: other.user.id, billingOptionId: other.billingOptionId, returnUrl },
                ports(healthyProvider)
            )
        ).resolves.toHaveProperty('checkoutUrl');
    });

    it('first proves M9 invented a free period, then ignores it; disabling M9 by name leaves none', async () => {
        const firstChargeAt = '2026-11-08T20:00:00.000Z';
        const choice = await seedChoice();
        const pending = await subscriptionModel.createPendingAuthorization({
            userId: choice.user.id,
            vertical: 'accommodation',
            planVersionId: choice.planVersionId,
            billingOptionId: choice.billingOptionId
        });
        const lying = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'retain the sent date so M9 is isolated' }]
        });
        const lyingProvider = namespaceFake(lying);
        const result = await authorizePendingSubscription({
            pending,
            provider: lyingProvider,
            clock,
            reason: 'Básico',
            returnUrl,
            firstChargeAt
        });
        const { snapshot } = await lyingProvider.readAuthorization({
            authorizationId: result.authorizationId
        });
        expect(snapshot.freePeriodDays).toBeGreaterThan(0);
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        expect(row?.status).toBe('PENDING_AUTHORIZATION');
        expect(row?.firstChargeAt).toBeNull();
        const other = await seedChoice();
        const otherPending = await subscriptionModel.createPendingAuthorization({
            userId: other.user.id,
            vertical: 'accommodation',
            planVersionId: other.planVersionId,
            billingOptionId: other.billingOptionId
        });
        const honest = new FakePaymentProvider({
            clock,
            honestAbout: [
                { lie: 'M1', why: 'retain requested fields' },
                { lie: 'M9', why: 'M9 disabled by name' }
            ]
        });
        const honestProvider = namespaceFake(honest);
        const healthy = await authorizePendingSubscription({
            pending: otherPending,
            provider: honestProvider,
            clock,
            reason: 'Básico',
            returnUrl,
            firstChargeAt
        });
        expect(
            (await honestProvider.readAuthorization({ authorizationId: healthy.authorizationId }))
                .snapshot.freePeriodDays
        ).toBeNull();
    });

    it('never retries the same one-use payment token after a rejected second call', async () => {
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'exercise RP1 without divergent fields' }]
        });
        const provider = namespaceFake(fake);
        const first = await seedChoice();
        const second = await seedChoice();
        const a = await subscriptionModel.createPendingAuthorization({
            userId: first.user.id,
            vertical: 'accommodation',
            planVersionId: first.planVersionId,
            billingOptionId: first.billingOptionId
        });
        const b = await subscriptionModel.createPendingAuthorization({
            userId: second.user.id,
            vertical: 'accommodation',
            planVersionId: second.planVersionId,
            billingOptionId: second.billingOptionId
        });
        const authorize = vi.spyOn(fake, 'authorize');
        await authorizePendingSubscription({
            pending: a,
            provider,
            clock,
            reason: 'Básico',
            returnUrl,
            paymentToken: 'once-only'
        });
        await expect(
            authorizePendingSubscription({
                pending: b,
                provider,
                clock,
                reason: 'Básico',
                returnUrl,
                paymentToken: 'once-only'
            })
        ).rejects.toMatchObject({ code: 'REJECTED' });
        expect(authorize).toHaveBeenCalledTimes(2);
    });
});
