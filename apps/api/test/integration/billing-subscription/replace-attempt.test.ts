import {
    billingOptions,
    emailOutbox,
    eq,
    getDb,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
            email: `b3-route-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 replacement route user',
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
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('No version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 100000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('No option');
    return { user, option };
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

describe('TEST:1732:10 AC:1732:10 protected S1 route replaces a pending attempt', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    beforeEach(ensureBillingDeadlineVersion1);
    afterAll(async () => testDb.teardown());

    it('returns the new signup and leaves the old attempt abandoned with its notice in outbox', async () => {
        const { user, option } = await fixture();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'exercise an applied creation' }]
        });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        const firstEmail = `first-${crypto.randomUUID()}@example.test`;
        const secondEmail = `second-${crypto.randomUUID()}@example.test`;
        const send = async (payerEmail: string) =>
            app.request(path, {
                method: 'POST',
                headers: headers(user.id),
                body: JSON.stringify({ billingOptionId: option.id, payerEmail })
            });
        const first = await send(firstEmail);
        const firstBody = await first.json();
        const second = await send(secondEmail);
        const secondBody = await second.json();
        const rows = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, user.id));
        const notices = await getDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, user.id));
        expect(first.status).toBe(201);
        expect(second.status).toBe(201);
        expect(secondBody.data.subscriptionId).not.toBe(firstBody.data.subscriptionId);
        expect(secondBody.data.checkoutUrl).not.toBe(firstBody.data.checkoutUrl);
        expect(rows.map((row) => row.status).sort()).toEqual([
            'ABANDONED',
            'PENDING_AUTHORIZATION'
        ]);
        expect(
            rows.find((row) => row.id === firstBody.data.subscriptionId)?.declaredPayerEmail
        ).toBe(firstEmail);
        expect(
            rows.find((row) => row.id === secondBody.data.subscriptionId)?.declaredPayerEmail
        ).toBe(secondEmail);
        expect(notices.map((notice) => notice.template)).toContain(
            'billing.attempt-replaced-cancel'
        );
        expect(authorize).toHaveBeenCalledTimes(2);
    });
});
