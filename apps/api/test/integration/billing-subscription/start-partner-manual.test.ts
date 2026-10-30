import {
    billingDeadlineVersions,
    billingOptions,
    eq,
    getDb,
    plans,
    planVersions,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const path = '/api/v1/protected/billing/subscriptions';
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

async function fixture() {
    const db = getDb();
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

function request(app: ReturnType<typeof initApp>, userId: string, billingOptionId: string) {
    return app.request(path, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            'x-mock-actor-id': userId,
            'x-mock-actor-role': 'USER',
            'x-mock-actor-permissions': '[]'
        },
        body: JSON.stringify({ billingOptionId, payerEmail: 'payer@example.test' })
    });
}

describe('TEST:1739:2 partner manual-only API rejection', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    beforeEach(async () => {
        await getDb()
            .insert(billingDeadlineVersions)
            .values({ version: 1, values: deadlines })
            .onConflictDoNothing();
    });
    afterAll(async () => testDb.teardown());

    it('returns typed 422 without a subscription or provider authorization', async () => {
        const { user, option } = await fixture();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        const readAuthorization = vi.spyOn(fake, 'readAuthorization');
        const response = await request(
            initApp({ clock, paymentProvider: fake }),
            user.id,
            option.id
        );

        expect(response.status).toBe(422);
        const body = await response.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.reason).toBe('PARTNER_MANUAL_ONLY');
        const rows = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, user.id));
        expect(rows).toHaveLength(0);
        expect(authorize).not.toHaveBeenCalled();
        expect(readAuthorization).not.toHaveBeenCalled();
        expect(
            await subscriptionModel.findLiveCommitment({ userId: user.id, vertical: 'partner' })
        ).toBeNull();
    });
});
