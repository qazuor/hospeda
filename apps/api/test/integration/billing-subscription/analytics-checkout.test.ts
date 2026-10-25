import {
    billingDeadlineVersions,
    billingOptions,
    getDb,
    plans,
    planVersions,
    users
} from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import {
    createAnalyticsFactSink,
    resetAnalyticsFactSinkForTests,
    setAnalyticsFactSinkForTests
} from '../../../src/utils/analytics/analytics-facts';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const path = '/api/v1/protected/billing/subscriptions';
const occurredAt = new Date('2026-10-08T20:00:00.000Z');
let currentTime = occurredAt;
const clock = { now: () => currentTime };
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

async function ensureBillingDeadlineVersion1() {
    await getDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: deadlines })
        .onConflictDoNothing();
}

async function fixture() {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `analytics-${crypto.randomUUID()}@example.test`,
            displayName: 'Analytics user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    const [plan] = await getDb()
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `analytics-${crypto.randomUUID()}`,
            name: 'Basic'
        })
        .returning();
    const [version] = await getDb()
        .insert(planVersions)
        .values({
            planId: plan!.id,
            vertical: VerticalEnum.ACCOMMODATION,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    const [option] = await getDb()
        .insert(billingOptions)
        .values({ planVersionId: version!.id, cycle: 'monthly', amount: 100000, currency: 'ARS' })
        .returning();
    return { user: user!, option: option! };
}

function request(
    userId: string,
    optionId: string,
    payerEmail: string,
    app: ReturnType<typeof initApp>
) {
    return app.request(path, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            'x-mock-actor-id': userId,
            'x-mock-actor-role': 'USER',
            'x-mock-actor-permissions': '[]'
        },
        body: JSON.stringify({ billingOptionId: optionId, payerEmail })
    });
}

describe('TEST:1878:1, TEST:1878:2 S1 checkout analytics', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    beforeEach(async () => {
        currentTime = occurredAt;
        await ensureBillingDeadlineVersion1();
    });
    afterEach(resetAnalyticsFactSinkForTests);
    afterAll(async () => testDb.teardown());

    it('emits one persisted checkout fact on a create and a retry with stable uuid and timestamp', async () => {
        const { user, option } = await fixture();
        const capture = vi.fn();
        setAnalyticsFactSinkForTests(createAnalyticsFactSink({ capture }));
        const app = initApp({
            clock,
            paymentProvider: new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock })
        });
        const email = `payer-${crypto.randomUUID()}@example.test`;
        const first = await request(user.id, option.id, email, app);
        const firstBody = await first.json();
        currentTime = new Date(occurredAt.getTime() + 60_000);
        const second = await request(user.id, option.id, email, app);
        const secondBody = await second.json();
        expect(first.status).toBe(201);
        expect(second.status).toBe(201);
        expect(secondBody.data.subscriptionId).toBe(firstBody.data.subscriptionId);
        expect(capture).toHaveBeenCalledTimes(2);
        const events = capture.mock.calls.map(
            ([event]) =>
                event as {
                    name: string;
                    uuid: string;
                    timestamp: Date;
                    properties: Record<string, unknown>;
                }
        );
        expect(events.map(({ name }) => name)).toEqual([
            'billing_checkout_started',
            'billing_checkout_started'
        ]);
        expect(events[0]?.uuid).toBe(events[1]?.uuid);
        expect(events[0]?.timestamp).toEqual(events[1]?.timestamp);
        expect(events[0]?.properties).toEqual({
            vertical: VerticalEnum.ACCOMMODATION,
            subscription_class: 'PRINCIPAL',
            actor_kind: 'USER',
            subscription_id: firstBody.data.subscriptionId,
            plan_version_id: expect.any(String),
            billing_option_id: option.id,
            cycle: 'monthly',
            amount_minor: 100000,
            currency: 'ARS',
            is_succession: undefined
        });
    });

    it('does not emit when the provider rejects authorization with 422', async () => {
        const { user, option } = await fixture();
        const capture = vi.fn();
        setAnalyticsFactSinkForTests(createAnalyticsFactSink({ capture }));
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        vi.spyOn(fake, 'authorize').mockRejectedValueOnce(
            new PaymentProviderError({
                code: 'REJECTED',
                capability: 'authorize',
                message: 'provider rejected'
            })
        );
        const response = await request(
            user.id,
            option.id,
            `payer-${crypto.randomUUID()}@example.test`,
            initApp({ clock, paymentProvider: fake })
        );
        expect(response.status).toBe(422);
        expect(capture).toHaveBeenCalledTimes(0);
    });
});
