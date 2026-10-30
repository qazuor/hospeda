import {
    billingDeadlineVersions,
    billingOptions,
    getDb,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

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

describe('subscription Tourist VIP S1 guard (TEST:B3:29)', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        await getDb()
            .insert(billingDeadlineVersions)
            .values({ version: 1, values: deadlines })
            .onConflictDoNothing();
    });
    afterAll(async () => testDb.teardown());

    it('admits another vertical purchase when the active title inherits Tourist VIP', async () => {
        const [user] = await getDb()
            .insert(users)
            .values({
                email: `b3-s1-other-vertical-${crypto.randomUUID()}@example.test`,
                displayName: 'B3 S1 other vertical',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            })
            .returning();
        const [titlePlan] = await getDb()
            .insert(plans)
            .values({
                vertical: 'accommodation',
                slug: `b3-title-${crypto.randomUUID()}`,
                name: 'Inherited plan'
            })
            .returning();
        const [titleVersion] = await getDb()
            .insert(planVersions)
            .values({
                planId: titlePlan!.id,
                vertical: 'accommodation',
                rank: 700001,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false,
                inheritsTouristVip: true
            })
            .returning();
        const [titleOption] = await getDb()
            .insert(billingOptions)
            .values({
                planVersionId: titleVersion!.id,
                cycle: 'monthly',
                amount: 250000,
                currency: 'ARS'
            })
            .returning();
        const [purchasePlan] = await getDb()
            .insert(plans)
            .values({
                vertical: 'venue',
                slug: `b3-other-${crypto.randomUUID()}`,
                name: 'Other plan'
            })
            .returning();
        const [purchaseVersion] = await getDb()
            .insert(planVersions)
            .values({
                planId: purchasePlan!.id,
                vertical: 'venue',
                rank: 700002,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning();
        const [purchaseOption] = await getDb()
            .insert(billingOptions)
            .values({
                planVersionId: purchaseVersion!.id,
                cycle: 'monthly',
                amount: 250000,
                currency: 'ARS'
            })
            .returning();
        await getDb().insert(subscriptions).values({
            userId: user!.id,
            vertical: 'accommodation',
            planVersionId: titleVersion!.id,
            billingOptionId: titleOption!.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        });
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        const response = await initApp({ clock, paymentProvider: fake }).request(
            '/api/v1/protected/billing/subscriptions',
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    'x-mock-actor-id': user!.id,
                    'x-mock-actor-role': 'USER',
                    'x-mock-actor-permissions': '[]'
                },
                body: JSON.stringify({
                    billingOptionId: purchaseOption!.id,
                    payerEmail: `mp-${crypto.randomUUID()}@example.test`
                })
            }
        );
        expect(response.status).toBe(201);
        expect(authorize).toHaveBeenCalledTimes(1);
    });
});
