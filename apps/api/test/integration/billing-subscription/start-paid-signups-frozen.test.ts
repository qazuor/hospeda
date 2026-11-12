import {
    billingOptions,
    eq,
    getDb,
    plans,
    planVersions,
    platformSettings,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { ensureBillingDeadlineVersion1 } from '../helpers/billing-deadline-version.js';

const path = '/api/v1/protected/billing/subscriptions';
const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };

async function fixture() {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `hos1749-s1-${crypto.randomUUID()}@example.test`,
            displayName: 'HOS-1749 S1 user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `hos1749-s1-${crypto.randomUUID()}`,
            name: 'HOS-1749 plan'
        })
        .returning();
    if (!plan) throw new Error('No plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('No version');
    const [option] = await db
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 100000,
            currency: 'ARS'
        })
        .returning();
    if (!option) throw new Error('No option');
    return { user, option };
}

async function setFreeze(frozen: boolean, updatedBy: string): Promise<void> {
    await getDb()
        .insert(platformSettings)
        .values({
            key: 'billing.paidSignupsFreeze',
            value: { frozen },
            updatedBy
        })
        .onConflictDoUpdate({
            target: platformSettings.key,
            set: { value: { frozen }, updatedBy }
        });
}

function headers(userId: string) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': userId,
        'x-mock-actor-role': 'USER',
        'x-mock-actor-permissions': '[]'
    };
}

async function checkout(userId: string, email: string, optionId: string) {
    const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const app = initApp({ clock, paymentProvider: provider });
    return app.request(path, {
        method: 'POST',
        headers: headers(userId),
        body: JSON.stringify({ billingOptionId: optionId, payerEmail: email })
    });
}

describe('HOS-1749 POST /protected/billing/subscriptions answers 409 NEW_PAID_SIGNUPS_FROZEN while frozen', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    beforeEach(async () => {
        await testDb.clean();
        await ensureBillingDeadlineVersion1();
    });
    afterEach(async () => {
        await getDb()
            .delete(platformSettings)
            .where(eq(platformSettings.key, 'billing.paidSignupsFreeze'));
    });
    afterAll(async () => testDb.teardown());

    it('frozen checkout returns NEW_PAID_SIGNUPS_FROZEN and creates no subscription', async () => {
        const { user, option } = await fixture();
        await setFreeze(true, user.id);

        const response = await checkout(user.id, user.email, option.id);
        const body: unknown = await response.json();
        const rows = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, user.id));

        expect(response.status).toBe(409);
        expect(body).toMatchObject({
            success: false,
            error: { code: 'NEW_PAID_SIGNUPS_FROZEN' }
        });
        expect(rows).toEqual([]);
    });

    it('a false freeze row allows checkout to proceed', async () => {
        const { user, option } = await fixture();
        await setFreeze(false, user.id);

        const response = await checkout(user.id, user.email, option.id);
        const body: unknown = await response.json();
        const rows = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, user.id));

        expect(response.status).toBe(201);
        expect(body).toMatchObject({ success: true, data: { checkoutUrl: expect.any(String) } });
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('PENDING_AUTHORIZATION');
    });

    it('an absent freeze row allows checkout to proceed', async () => {
        const { user, option } = await fixture();

        const response = await checkout(user.id, user.email, option.id);
        const body: unknown = await response.json();
        const rows = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, user.id));

        expect(response.status).toBe(201);
        expect(body).toMatchObject({ success: true, data: { checkoutUrl: expect.any(String) } });
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('PENDING_AUTHORIZATION');
    });
});
