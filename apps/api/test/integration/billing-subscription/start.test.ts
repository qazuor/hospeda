import {
    billingOptions,
    emailOutbox,
    eq,
    getDb,
    plans,
    planVersions,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { beforeCancelNotice } from '../../../src/routes/billing-subscription/before-cancel-notice';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const path = '/api/v1/protected/billing/subscriptions';
const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };

async function fixture(sellable: boolean, current = true) {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `b3-route-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 route user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `b3-route-${crypto.randomUUID()}`,
            name: 'Básico'
        })
        .returning();
    if (!plan) throw new Error('No plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable,
            current,
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
    return { user, version, option };
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

describe('TEST:B3:2 protected S1 route rejects a retired checkout link', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    afterAll(async () => testDb.teardown());

    it('orders auth, shape, missing id and plan policy before the provider, without creating a row', async () => {
        const { user, option } = await fixture(false);
        const fake = new FakePaymentProvider({ clock });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        const request = (body: unknown, authenticated = true) =>
            app.request(path, {
                method: 'POST',
                headers: authenticated
                    ? headers(user.id)
                    : { 'content-type': 'application/json', 'user-agent': 'vitest' },
                body: JSON.stringify(body)
            });
        expect((await request({ billingOptionId: option.id }, false)).status).toBe(401);
        expect((await request({ billingOptionId: 'invalid' })).status).toBe(400);
        expect(
            (await request({ billingOptionId: option.id, paymentToken: 'forbidden' })).status
        ).toBe(400);
        expect((await request({ billingOptionId: crypto.randomUUID() })).status).toBe(404);
        const retired = await request({ billingOptionId: option.id });
        expect(retired.status).toBe(422);
        expect((await retired.json()).error.reason).toBe('PLAN_NOT_FOR_SALE');
        expect(authorize).not.toHaveBeenCalled();
        expect(
            await getDb().select().from(subscriptions).where(eq(subscriptions.userId, user.id))
        ).toEqual([]);
    });

    it('returns a distinct 409 when the durable commitment is occupied', async () => {
        const { user, version, option } = await fixture(true);
        await subscriptionModel.createPendingAuthorization({
            userId: user.id,
            vertical: 'accommodation',
            planVersionId: version.id,
            billingOptionId: option.id
        });
        const fake = new FakePaymentProvider({ clock });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        const response = await app.request(path, {
            method: 'POST',
            headers: headers(user.id),
            body: JSON.stringify({ billingOptionId: option.id })
        });
        expect(response.status).toBe(409);
        expect((await response.json()).error.reason).toBe('COMMITMENT_TAKEN');
        expect(authorize).not.toHaveBeenCalled();
    });

    it('rejects a version that is no longer current before reaching the provider', async () => {
        const { user, option } = await fixture(true, false);
        const fake = new FakePaymentProvider({ clock });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        const response = await app.request(path, {
            method: 'POST',
            headers: headers(user.id),
            body: JSON.stringify({ billingOptionId: option.id })
        });
        expect(response.status).toBe(422);
        expect((await response.json()).error.reason).toBe('PLAN_NOT_FOR_SALE');
        expect(authorize).not.toHaveBeenCalled();
        expect(
            await getDb().select().from(subscriptions).where(eq(subscriptions.userId, user.id))
        ).toEqual([]);
    });

    it('TEST:B3:3 enqueues one before-cancel notice and reads its four delivery outcomes', async () => {
        const { user } = await fixture(true);
        const subscriptionId = crypto.randomUUID();
        const input = { subscriptionId, userId: user.id };
        expect(await beforeCancelNotice.beforeCancel(input)).toBe('NOT_YET_SENT');
        expect(await beforeCancelNotice.beforeCancel(input)).toBe('NOT_YET_SENT');
        const rows = await getDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, user.id));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.template).toBe('billing.before-cancel');
        if (!rows[0]) throw new Error('Notice was not enqueued');
        await getDb()
            .update(emailOutbox)
            .set({ status: 'sent' })
            .where(eq(emailOutbox.id, rows[0].id));
        expect(await beforeCancelNotice.beforeCancel(input)).toBe('SENT');
        await getDb()
            .update(emailOutbox)
            .set({ status: 'failed', lastError: 'undeliverable:hard_bounce' })
            .where(eq(emailOutbox.id, rows[0].id));
        expect(await beforeCancelNotice.beforeCancel(input)).toBe('NO_RECIPIENT');
        await getDb()
            .update(emailOutbox)
            .set({ lastError: 'undeliverable:retries_exhausted' })
            .where(eq(emailOutbox.id, rows[0].id));
        expect(await beforeCancelNotice.beforeCancel(input)).toBe('DELIVERY_EXHAUSTED');
        await getDb()
            .update(users)
            .set({ deletedAt: new Date('2026-10-08T20:00:00.000Z') })
            .where(eq(users.id, user.id));
        expect(
            await beforeCancelNotice.beforeCancel({
                subscriptionId: crypto.randomUUID(),
                userId: user.id
            })
        ).toBe('NO_RECIPIENT');
        expect(
            await getDb().select().from(emailOutbox).where(eq(emailOutbox.recipientUserId, user.id))
        ).toHaveLength(2);
    });
});
