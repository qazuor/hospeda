import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { subscriptionModel } from '../../src/models/subscription/subscription.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingDeadlineVersions } from '../../src/schemas/vertical/billing-deadline-version.dbschema.ts';
import { billingOptions } from '../../src/schemas/vertical/billing-option.dbschema.ts';
import { plans, planVersions } from '../../src/schemas/vertical/plan-catalog.dbschema.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

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

describe('TEST:1730:3 subscription.declared_payer_email', () => {
    it('persists the exact declared string and leaves it NULL when omitted', async () => {
        await withTestTransaction(async (tx) => {
            await tx
                .insert(billingDeadlineVersions)
                .values({ version: 1, values: deadlines })
                .onConflictDoNothing();
            const [user] = await tx.insert(users).values(testData.user()).returning();
            if (!user) throw new Error('Expected user');
            const [plan] = await tx
                .insert(plans)
                .values({
                    vertical: 'accommodation',
                    slug: `declared-${crypto.randomUUID()}`,
                    name: 'Basic'
                })
                .returning();
            if (!plan) throw new Error('Expected plan');
            const [version] = await tx
                .insert(planVersions)
                .values({
                    planId: plan.id,
                    vertical: 'accommodation',
                    rank: 18888,
                    sellable: true,
                    current: true,
                    trialDays: 0,
                    allowsPause: false
                })
                .returning();
            if (!version) throw new Error('Expected version');
            const [option] = await tx
                .insert(billingOptions)
                .values({
                    planVersionId: version.id,
                    cycle: 'monthly',
                    amount: 1000,
                    currency: 'ARS'
                })
                .returning();
            if (!option) throw new Error('Expected option');
            const input = {
                userId: user.id,
                vertical: 'accommodation',
                planVersionId: version.id,
                billingOptionId: option.id,
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: new Date('2026-11-01T00:00:00Z'),
                tx
            };
            const declared = await subscriptionModel.createPendingAuthorization({
                ...input,
                declaredPayerEmail: 'Exact.Case+tag@example.test'
            });
            const [legacyUser] = await tx.insert(users).values(testData.user()).returning();
            if (!legacyUser) throw new Error('Expected legacy user');
            const legacy = await subscriptionModel.createPendingAuthorization({
                ...input,
                userId: legacyUser.id
            });
            expect(declared.subscription.declaredPayerEmail).toBe('Exact.Case+tag@example.test');
            expect(legacy.subscription.declaredPayerEmail).toBeNull();
        });
    });
});
