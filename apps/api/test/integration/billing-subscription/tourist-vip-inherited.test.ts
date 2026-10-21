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
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const path = '/api/v1/protected/billing/subscriptions';
const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
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

async function option(vertical: 'tourist' | 'accommodation', inheritsTouristVip = false) {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `b3-vip-route-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 VIP route',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('Expected user');
    const [plan] = await getDb()
        .insert(plans)
        .values({ vertical, slug: `b3-vip-${crypto.randomUUID()}`, name: 'VIP test' })
        .returning();
    if (!plan) throw new Error('Expected plan');
    const [version] = await getDb()
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip
        })
        .returning();
    if (!version) throw new Error('Expected version');
    const [billingOption] = await getDb()
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 250000,
            currency: 'ARS'
        })
        .returning();
    if (!billingOption) throw new Error('Expected billing option');
    return { user, version, billingOption };
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

describe('TEST:B3:29 Tourist VIP inherited S1 route guard', () => {
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

    it('rejects inherited VIP without a row/provider call, then admits the same request after title cancellation', async () => {
        const title = await option('accommodation', true);
        const vip = await option('tourist');
        const [titleRow] = await getDb()
            .insert(subscriptions)
            .values({
                userId: title.user.id,
                vertical: 'accommodation',
                planVersionId: title.version.id,
                billingOptionId: title.billingOption.id,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL'
            })
            .returning();
        if (!titleRow) throw new Error('Expected title row');
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        const send = (body: unknown, authenticated = true) =>
            app.request(path, {
                method: 'POST',
                headers: authenticated
                    ? headers(title.user.id)
                    : { 'content-type': 'application/json', 'user-agent': 'vitest' },
                body: JSON.stringify(body)
            });
        expect((await send({ billingOptionId: vip.billingOption.id }, false)).status).toBe(401);
        expect(
            (
                await send({
                    billingOptionId: 'not-a-uuid',
                    payerEmail: `mp-${crypto.randomUUID()}@example.test`
                })
            ).status
        ).toBe(400);
        const blocked = await send({
            billingOptionId: vip.billingOption.id,
            payerEmail: `mp-${crypto.randomUUID()}@example.test`
        });
        expect(blocked.status).toBe(409);
        expect((await blocked.json()).error.reason).toBe('TOURIST_VIP_INHERITED');
        expect(authorize).not.toHaveBeenCalled();
        expect(
            await getDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.userId, title.user.id))
        ).toHaveLength(1);
        await getDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, titleRow.id));
        const admitted = await send({
            billingOptionId: vip.billingOption.id,
            payerEmail: `mp-${crypto.randomUUID()}@example.test`
        });
        expect(admitted.status).toBe(201);
        expect((await admitted.json()).data.checkoutUrl).toBeDefined();
        expect(authorize).toHaveBeenCalledTimes(1);
    });

    it('does not reject a Tourist purchase when the title version does not inherit VIP', async () => {
        const title = await option('accommodation', false);
        const vip = await option('tourist');
        await getDb().insert(subscriptions).values({
            userId: title.user.id,
            vertical: 'accommodation',
            planVersionId: title.version.id,
            billingOptionId: title.billingOption.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        });
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const app = initApp({ clock, paymentProvider: fake });
        const response = await app.request(path, {
            method: 'POST',
            headers: headers(title.user.id),
            body: JSON.stringify({
                billingOptionId: vip.billingOption.id,
                payerEmail: `mp-${crypto.randomUUID()}@example.test`
            })
        });
        expect(response.status).toBe(201);
        expect((await response.json()).data.checkoutUrl).toBeDefined();
    });
});
