import {
    billingDeadlineVersions,
    billingOptions,
    getDb,
    plans,
    planVersions,
    subscriptionModel,
    users
} from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
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

async function ensureBillingDeadlineVersion1(): Promise<void> {
    await getDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: deadlines })
        .onConflictDoNothing();
}

async function fixture() {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `reject-${crypto.randomUUID()}@example.test`,
            displayName: 'Retry user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    const [plan] = await db
        .insert(plans)
        .values({ vertical: 'accommodation', slug: `reject-${crypto.randomUUID()}`, name: 'Basic' })
        .returning();
    const [version] = await db
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
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version!.id, cycle: 'monthly', amount: 100000, currency: 'ARS' })
        .returning();
    return { user: user!, option: option! };
}

function request(
    app: ReturnType<typeof initApp>,
    userId: string,
    billingOptionId: string,
    payerEmail: string
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
        body: JSON.stringify({ billingOptionId, payerEmail })
    });
}

describe('TEST:1746:4/5 signup provider rejection route', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    beforeEach(ensureBillingDeadlineVersion1);
    afterAll(async () => testDb.teardown());

    it('returns a correctable rejection and recreates the same option on the same row', async () => {
        const { user, option } = await fixture();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize').mockRejectedValueOnce(
            new PaymentProviderError({
                code: 'REJECTED',
                capability: 'authorize',
                message: 'Mercado Pago request failed (400)',
                cause: {
                    status: 400,
                    body: { message: 'invalid payer_email', error: 'bad_request' }
                }
            })
        );
        const app = initApp({ clock, paymentProvider: fake });
        const first = await request(app, user.id, option.id, user.email);
        expect(first.status).toBe(422);
        expect((await first.json()).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: 'PROVIDER_REJECTED'
        });
        const row = await subscriptionModel.findLiveCommitment({
            userId: user.id,
            vertical: 'accommodation'
        });
        expect(row).toBeTruthy();
        const retry = await request(app, user.id, option.id, `corrected-${user.email}`);
        expect(retry.status).toBe(200);
        expect((await retry.json()).subscriptionId).toBe(row!.subscription.id);
        expect(authorize).toHaveBeenCalledTimes(2);
    });

    it('keeps unavailable provider failures retryable as server errors', async () => {
        const { user, option } = await fixture();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        vi.spyOn(fake, 'authorize').mockRejectedValueOnce(
            new PaymentProviderError({
                code: 'UNAVAILABLE',
                capability: 'authorize',
                message: 'Mercado Pago request failed (503)',
                cause: { status: 503, body: '' }
            })
        );
        const response = await request(
            initApp({ clock, paymentProvider: fake }),
            user.id,
            option.id,
            user.email
        );
        expect(response.status).toBeGreaterThanOrEqual(500);
        expect((await response.json()).error.reason).not.toBe('PROVIDER_REJECTED');
    });
});
