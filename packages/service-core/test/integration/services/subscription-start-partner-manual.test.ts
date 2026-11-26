import {
    billingDeadlineVersions,
    billingOptions,
    eq,
    idempotencyKeys,
    plans,
    planVersions,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    authorizePendingSubscription,
    startSubscription,
    startTeamCardSubscription
} from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import { nextPlanVersionRank } from './support/plan-version-rank.js';
import { noTouristVip } from './support/tourist-vip';

const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
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

async function partnerChoice(paymentMethods: ('CARD' | 'MANUAL')[] = ['CARD', 'MANUAL']) {
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `partner-manual-${crypto.randomUUID()}@example.test`,
            displayName: 'Partner test user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('Could not seed partner checkout user');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'partner',
            slug: `partner-${crypto.randomUUID()}`,
            name: 'Partner Gold'
        })
        .returning();
    if (!plan) throw new Error('Could not seed partner plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'partner',
            rank: nextPlanVersionRank(),
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false,
            paymentMethods
        })
        .returning();
    if (!version) throw new Error('Could not seed partner plan version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 3000000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('Could not seed partner billing option');
    return { user, option, planVersionId: version.id };
}

describe('TEST:1739:1/4 S1 and provider funnel reject manual-only Partner plans', () => {
    it('TEST:1739:1 rejects S1 before rows or provider calls', async () => {
        const { user, option } = await partnerChoice();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        const readAuthorization = vi.spyOn(fake, 'readAuthorization');
        const result = await startSubscription(
            { userId: user.id, billingOptionId: option.id, returnUrl: 'https://example.test' },
            {
                provider: fake,
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
        ).then(
            (value) => ({ value }),
            (error: unknown) => ({ error })
        );

        expect('error' in result).toBe(true);
        if ('error' in result) {
            expect(result.error).toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'PLAN_NOT_SELF_SERVICE'
            });
        }
        const rows = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, user.id));
        const keys = rows.length
            ? await getServiceTestDb()
                  .select()
                  .from(idempotencyKeys)
                  .where(eq(idempotencyKeys.subjectId, rows[0]!.id))
            : [];
        expect(rows).toHaveLength(0);
        expect(keys).toHaveLength(0);
        expect(authorize).not.toHaveBeenCalled();
        expect(readAuthorization).not.toHaveBeenCalled();
    });

    it('TEST:1739:4 rejects a pending row whose plan does not accept card before provider authorization', async () => {
        const { user, option, planVersionId } = await partnerChoice(['MANUAL']);
        const pending = await subscriptionModel.createPendingAuthorization({
            userId: user.id,
            vertical: 'partner',
            planVersionId,
            billingOptionId: option.id,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date('2026-10-11T20:00:00.000Z')
        });
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        const result = await authorizePendingSubscription({
            pending,
            provider: fake,
            clock,
            reason: 'Partner Gold',
            returnUrl: 'https://example.test'
        }).then(
            (value) => ({ value }),
            (error: unknown) => ({ error })
        );

        expect('error' in result).toBe(true);
        if ('error' in result) {
            expect(result.error).toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'PAYMENT_METHOD_NOT_ACCEPTED'
            });
        }
        expect(authorize).not.toHaveBeenCalled();
    });
});

const portsFor = (provider: FakePaymentProvider) => ({
    provider,
    clock,
    planPolicy: async () => ({ graceDays: 10, allowsPause: false, current: true, sellable: true }),
    beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
    touristVipInheritance: noTouristVip
});

describe('HOS-2196 the team opens a card subscription for a plan that accepts it', () => {
    it('creates a pending card subscription and returns its authorization link without a first-charge date', async () => {
        // Arrange
        const { user, option } = await partnerChoice(['CARD', 'MANUAL']);
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        // Act
        const result = await startTeamCardSubscription(
            { userId: user.id, billingOptionId: option.id, returnUrl: 'https://example.test' },
            portsFor(fake)
        );
        // Assert
        expect(result.checkoutUrl).toMatch(/^https:\/\//);
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, user.id));
        expect(row).toMatchObject({
            id: result.subscriptionId,
            vertical: 'partner',
            status: 'PENDING_AUTHORIZATION',
            paymentMethod: 'CARD'
        });
        expect(authorize).toHaveBeenCalledTimes(1);
        expect(authorize.mock.calls[0]?.[0].firstChargeAt).toBeUndefined();
    });

    it('reuses the pending subscription and its link on a repeat', async () => {
        // Arrange
        const { user, option } = await partnerChoice(['CARD', 'MANUAL']);
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const input = {
            userId: user.id,
            billingOptionId: option.id,
            returnUrl: 'https://example.test'
        };
        const first = await startTeamCardSubscription(input, portsFor(fake));
        const authorize = vi.spyOn(fake, 'authorize');
        // Act
        const second = await startTeamCardSubscription(input, portsFor(fake));
        // Assert
        expect(second).toEqual(first);
        expect(authorize).not.toHaveBeenCalled();
    });

    it('refuses a plan that does not accept card, before any row or provider call', async () => {
        // Arrange
        const { user, option } = await partnerChoice(['MANUAL']);
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        // Act
        const outcome = await startTeamCardSubscription(
            { userId: user.id, billingOptionId: option.id, returnUrl: 'https://example.test' },
            portsFor(fake)
        ).then(
            () => null,
            (error: unknown) => error
        );
        // Assert
        expect(outcome).toMatchObject({ reason: 'PAYMENT_METHOD_NOT_ACCEPTED' });
        const rows = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, user.id));
        expect(rows).toHaveLength(0);
        expect(authorize).not.toHaveBeenCalled();
    });

    it('keeps the public checkout closed to a plan that also accepts manual payment, and opens a card-only one', async () => {
        // Arrange
        const both = await partnerChoice(['CARD', 'MANUAL']);
        const cardOnly = await partnerChoice(['CARD']);
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        // Act
        const refused = await startSubscription(
            {
                userId: both.user.id,
                billingOptionId: both.option.id,
                returnUrl: 'https://example.test'
            },
            portsFor(fake)
        ).then(
            () => null,
            (error: unknown) => error
        );
        const sold = await startSubscription(
            {
                userId: cardOnly.user.id,
                billingOptionId: cardOnly.option.id,
                returnUrl: 'https://example.test'
            },
            portsFor(fake)
        );
        // Assert
        expect(refused).toMatchObject({ reason: 'PLAN_NOT_SELF_SERVICE' });
        expect(sold.checkoutUrl).toMatch(/^https:\/\//);
    });
});
