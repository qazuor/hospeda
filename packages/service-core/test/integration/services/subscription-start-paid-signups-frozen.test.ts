import {
    billingDeadlineVersions,
    eq,
    getDb,
    providerLinks,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { StartSubscriptionPorts } from '../../../src/services/billing/subscription/start-subscription.service';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
import { namespaceFake } from './support/payment-provider';
import { noTouristVip } from './support/tourist-vip.ts';

const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
const returnUrl = 'https://hospeda.example/account';
const deadlines = {
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
        .values({ version: 1, values: deadlines })
        .onConflictDoNothing();
});
afterAll(closeServiceTestPool);

async function seedChoice(sellable = true) {
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `hos1749-${crypto.randomUUID()}@example.test`,
            displayName: 'Freeze test user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `hos1749-${crypto.randomUUID()}`, 'Básico']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('No plan');
    const planVersionId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, $2, $3, $4, true, 0, false) RETURNING id',
            [planId, 'accommodation', Math.floor(Math.random() * 100000000) + 1000, sellable]
        )
    ).rows[0]?.id;
    if (!planVersionId) throw new Error('No version');
    const billingOptionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'quarterly', 250000, 'ARS') RETURNING id",
            [planVersionId]
        )
    ).rows[0]?.id;
    if (!billingOptionId) throw new Error('No option');
    return { user, planVersionId, billingOptionId };
}

function ports(
    provider: ReturnType<typeof namespaceFake>,
    isFrozen: boolean,
    sellable = true
): StartSubscriptionPorts {
    return {
        provider,
        clock,
        planPolicy: async () => ({ graceDays: 10, allowsPause: false, current: true, sellable }),
        beforeCancelNotice: { beforeCancel: async () => 'SENT' },
        touristVipInheritance: noTouristVip,
        paidSignupsFreeze: { isFrozen: async () => isFrozen }
    };
}

describe('HOS-1749 S1 refuses a new card signup while new paid signups are frozen', () => {
    it('frozen: rejects with NEW_PAID_SIGNUPS_FROZEN before touching the provider or the database', async () => {
        // Arrange
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const provider = namespaceFake(fake);
        const authorize = vi.spyOn(fake, 'authorize');
        const readAuthorization = vi.spyOn(fake, 'readAuthorization');
        const cancel = vi.spyOn(fake, 'cancel');

        // Act
        const action = startSubscription(
            { userId: choice.user.id, billingOptionId: choice.billingOptionId, returnUrl },
            ports(provider, true)
        );

        // Assert
        await expect(action).rejects.toMatchObject({ code: 'NEW_PAID_SIGNUPS_FROZEN' });
        const rows = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, choice.user.id));
        expect(rows).toEqual([]);
        expect(authorize).toHaveBeenCalledTimes(0);
        expect(readAuthorization).toHaveBeenCalledTimes(0);
        expect(cancel).toHaveBeenCalledTimes(0);
    });

    it('frozen with a previous declined attempt: the declined attempt is left alone', async () => {
        // Arrange
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const provider = namespaceFake(fake);
        const pending = await subscriptionModel.createPendingAuthorization({
            userId: choice.user.id,
            vertical: 'accommodation',
            planVersionId: choice.planVersionId,
            billingOptionId: choice.billingOptionId,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
        });
        const created = await provider.authorize({
            reference: pending.subscription.id,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 3 },
            reason: 'Básico',
            returnUrl
        });
        await subscriptionModel.recordAuthorizationResult({
            idempotencyKey: pending.idempotencyKey,
            subscriptionId: pending.subscription.id,
            provider: 'MERCADO_PAGO',
            providerId: created.authorizationId,
            result: { authorizationId: created.authorizationId },
            completedAt: clock.now()
        });
        await getDb()
            .update(subscriptions)
            .set({ status: 'CHARGE_DECLINED' })
            .where(eq(subscriptions.id, pending.subscription.id));
        const [before] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, pending.subscription.id));
        const cancel = vi.spyOn(fake, 'cancel');

        // Act
        const action = startSubscription(
            { userId: choice.user.id, billingOptionId: choice.billingOptionId, returnUrl },
            ports(provider, true)
        );

        // Assert
        await expect(action).rejects.toMatchObject({ code: 'NEW_PAID_SIGNUPS_FROZEN' });
        const [after] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, pending.subscription.id));
        expect(after?.status).toBe(before?.status);
        expect(cancel).toHaveBeenCalledTimes(0);
        const [link] = await getDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, pending.subscription.id));
        expect(link?.providerId).toBe(created.authorizationId);
    });

    it('not frozen: the signup proceeds as before', async () => {
        // Arrange
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const provider = namespaceFake(fake);

        // Act
        const result = await startSubscription(
            { userId: choice.user.id, billingOptionId: choice.billingOptionId, returnUrl },
            ports(provider, false)
        );

        // Assert
        expect(result).toMatchObject({
            subscriptionId: expect.any(String),
            checkoutUrl: expect.any(String)
        });
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        expect(row?.status).toBe('PENDING_AUTHORIZATION');
    });

    it('a plan not for sale still answers PLAN_NOT_FOR_SALE while frozen', async () => {
        // Arrange
        const choice = await seedChoice(false);
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const provider = namespaceFake(fake);

        // Act
        const action = startSubscription(
            { userId: choice.user.id, billingOptionId: choice.billingOptionId, returnUrl },
            ports(provider, true, false)
        );

        // Assert
        await expect(action).rejects.toMatchObject({ reason: 'PLAN_NOT_FOR_SALE' });
    });
});
