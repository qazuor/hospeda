import {
    billingDeadlineVersions,
    billingOptions,
    eq,
    idempotencyKeys,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
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

async function partnerChoice() {
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
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('Could not seed partner plan version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 3000000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('Could not seed partner billing option');
    return { user, option };
}

describe('TEST:1739:1 S1 rejects manual-only Partner plans', () => {
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
                reason: 'PARTNER_MANUAL_ONLY'
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
});
