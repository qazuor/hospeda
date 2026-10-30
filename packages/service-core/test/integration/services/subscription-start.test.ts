import {
    billingDeadlineVersions,
    desc,
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
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    type BeforeCancelNotice,
    type StartSubscriptionPorts,
    startSubscription
} from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
import { namespaceFake } from './support/payment-provider';
import { noTouristVip } from './support/tourist-vip.ts';

afterAll(closeServiceTestPool);

const billingDeadlineVersion1Values = {
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
        .values({ version: 1, values: billingDeadlineVersion1Values })
        .onConflictDoNothing();
});

const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
const returnUrl = 'https://hospeda.example/account';

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
        beforeCancelNotice: notice,
        touristVipInheritance: noTouristVip
    };
}

describe('TEST:B3:1 S1 durable pending authorization', () => {
    it('commits the row and key before authorize, with amount, cycle, reason and reference from our catalog', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
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
        // TEST:B3:10 (base: versión y vencimiento guardados al abrir la ventana)
        const [currentDeadlines] = await getDb()
            .select()
            .from(billingDeadlineVersions)
            .orderBy(desc(billingDeadlineVersions.version))
            .limit(1);
        const [opened] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        expect(opened?.authorizationWindowDeadlineVersion).toBe(currentDeadlines?.version);
        expect(opened?.authorizationWindowEndsAt?.getTime()).toBe(
            clock.now().getTime() + (currentDeadlines?.values['10'].cardHours ?? 0) * 60 * 60 * 1000
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

// TEST:B3:10 (base: versión y vencimiento guardados al abrir la ventana)
describe('S1 reuse reads the stored authorization deadline', () => {
    for (const expired of [true, false]) {
        it(
            expired
                ? 'rejects a stored past deadline despite a recent creation'
                : 'reuses before the stored future deadline',
            async () => {
                const choice = await seedChoice();
                const windowEndsAt = new Date(clock.now().getTime() + (expired ? -60_000 : 60_000));
                const pending = await subscriptionModel.createPendingAuthorization({
                    userId: choice.user.id,
                    vertical: 'accommodation',
                    planVersionId: choice.planVersionId,
                    billingOptionId: choice.billingOptionId,
                    authorizationWindowDeadlineVersion: 1,
                    authorizationWindowEndsAt: windowEndsAt
                });
                const authorizationId = `stored-${crypto.randomUUID()}`;
                const checkoutUrl = 'https://mp.test/checkout/stored';
                await subscriptionModel.recordAuthorizationResult({
                    idempotencyKey: pending.idempotencyKey,
                    subscriptionId: pending.subscription.id,
                    provider: 'MERCADO_PAGO',
                    providerId: authorizationId,
                    result: { authorizationId, applied: true, checkoutUrl },
                    completedAt: clock.now()
                });
                const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
                const authorize = vi.spyOn(fake, 'authorize');
                const retry = startSubscription(
                    { userId: choice.user.id, billingOptionId: choice.billingOptionId, returnUrl },
                    ports(namespaceFake(fake))
                );
                if (expired) {
                    await expect(retry).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });
                } else {
                    await expect(retry).resolves.toEqual({
                        subscriptionId: pending.subscription.id,
                        authorizationId,
                        checkoutUrl
                    });
                }
                expect(authorize).not.toHaveBeenCalled();
            }
        );
    }
});

describe('TEST:B3:3 every declined predecessor is reread before new signup', () => {
    it('blocks a live mandate, sends notice before cancellation, and accepts a later call only after a cancelled reread', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'make the fixture healthy' }]
        });
        const provider = namespaceFake(fake);
        const prior = await subscriptionModel.createPendingAuthorization({
            userId: choice.user.id,
            vertical: 'accommodation',
            planVersionId: choice.planVersionId,
            billingOptionId: choice.billingOptionId,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
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
            billingOptionId: choice.billingOptionId,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
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
        const kinds: string[] = [];
        const notice: BeforeCancelNotice = {
            beforeCancel: async (input) => {
                order.push('notice');
                kinds.push(input.kind);
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
        // TEST:1683:3 AC:1683:2: S1 re-cancels S16's row with S16's kind (same dedupe key).
        expect(kinds).toEqual(['FIRST_CHARGE_DECLINED', 'FIRST_CHARGE_DECLINED']);
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
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const provider = namespaceFake(fake);
        const prior = await subscriptionModel.createPendingAuthorization({
            userId: choice.user.id,
            vertical: 'accommodation',
            planVersionId: choice.planVersionId,
            billingOptionId: choice.billingOptionId,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
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
