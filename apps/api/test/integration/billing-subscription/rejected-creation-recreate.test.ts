import {
    billingDeadlineVersions,
    billingOptions,
    eq,
    getDb,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const path = '/api/v1/protected/billing/subscriptions';
const clock = { now: () => new Date() };
const deadlineValues = {
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

describe('TEST:1732:19 rejected creation retry route', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        await getDb()
            .insert(billingDeadlineVersions)
            .values({ version: 1, values: deadlineValues })
            .onConflictDoNothing();
    });
    afterAll(async () => testDb.teardown());

    it('recreates on the same subscription using the retry payer email', async () => {
        const [user] = await getDb()
            .insert(users)
            .values({
                email: `retry-${crypto.randomUUID()}@example.test`,
                displayName: 'Retry user',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            })
            .returning();
        const [plan] = await getDb()
            .insert(plans)
            .values({
                vertical: 'accommodation',
                slug: `retry-${crypto.randomUUID()}`,
                name: 'Basic'
            })
            .returning();
        const [version] = await getDb()
            .insert(planVersions)
            .values({
                planId: plan!.id,
                vertical: 'accommodation',
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning();
        const [option] = await getDb()
            .insert(billingOptions)
            .values({
                planVersionId: version!.id,
                cycle: 'monthly',
                amount: 100000,
                currency: 'ARS'
            })
            .returning();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize').mockRejectedValueOnce(
            new PaymentProviderError({
                code: 'REJECTED',
                capability: 'authorize',
                message: 'Rejected by fake provider'
            })
        );
        const app = initApp({ clock, paymentProvider: fake });
        const request = (payerEmail: string) =>
            app.request(path, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    'x-mock-actor-id': user!.id,
                    'x-mock-actor-role': 'USER',
                    'x-mock-actor-permissions': '[]'
                },
                body: JSON.stringify({ billingOptionId: option!.id, payerEmail })
            });
        const first = await request(user!.email);
        const secondEmail = 'retry@example.test';
        const retry = await request(secondEmail);
        expect(first.status).toBeGreaterThanOrEqual(500);
        expect(retry.status).toBe(201);
        const body = await retry.json();
        const rows = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, user!.id));
        expect(rows).toHaveLength(1);
        expect(body.data.subscriptionId).toBe(rows[0]!.id);
        expect(rows[0]!.declaredPayerEmail).toBe(secondEmail);
        expect(authorize).toHaveBeenCalledTimes(2);
    });
});
