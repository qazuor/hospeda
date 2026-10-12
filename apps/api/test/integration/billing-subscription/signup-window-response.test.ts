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
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { readSignupWindow } from '../../../src/routes/billing-subscription/read-signup-window';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const path = '/api/v1/protected/billing/subscriptions';
const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
const billingDeadlineVersion1Values = {
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
        .values({ version: 1, values: billingDeadlineVersion1Values })
        .onConflictDoNothing();
}

async function fixture() {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `b3-signup-window-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 signup window user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `b3-signup-window-${crypto.randomUUID()}`,
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

function headers(userId: string) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': userId,
        'x-mock-actor-role': 'USER',
        'x-mock-actor-permissions': '[]'
    };
}

describe('S1 signup window response', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    beforeEach(ensureBillingDeadlineVersion1);
    afterAll(async () => testDb.teardown());

    // B3 UI (B3.md:1045-1053)
    it('returns the vertical and the persisted window end for a new signup', async () => {
        const { user, option } = await fixture();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const app = initApp({ clock, paymentProvider: fake });
        const response = await app.request(path, {
            method: 'POST',
            headers: headers(user.id),
            body: JSON.stringify({ billingOptionId: option.id })
        });
        const body = await response.json();
        const [row] = await getDb()
            .select({
                vertical: subscriptions.vertical,
                endsAt: subscriptions.authorizationWindowEndsAt
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, body.data.subscriptionId))
            .limit(1);

        expect(response.status).toBe(201);
        expect(body.data.vertical).toBe(row?.vertical);
        expect(body.data.authorizationWindowEndsAt).toBe(row?.endsAt?.toISOString());
        expect(body.data.authorizationWindowEndsAt).toBe('2026-10-11T20:00:00.000Z');
    });

    // B3 UI (B3.md:1045-1053)
    it('returns the same row fields on reuse without authorizing twice', async () => {
        const { user, option } = await fixture();
        const fake = new FakePaymentProvider({
            clock,
            idNamespace: crypto.randomUUID(),
            honestAbout: [
                { lie: 'M1', why: 'inspect the persisted signup window after a healthy creation' }
            ]
        });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        const request = () =>
            app.request(path, {
                method: 'POST',
                headers: headers(user.id),
                body: JSON.stringify({ billingOptionId: option.id })
            });
        const first = await (await request()).json();
        const secondResponse = await request();
        const second = await secondResponse.json();

        expect(secondResponse.status).toBe(201);
        expect(second.data.subscriptionId).toBe(first.data.subscriptionId);
        expect(second.data.authorizationWindowEndsAt).toBe(first.data.authorizationWindowEndsAt);
        expect(second.data.vertical).toBe(first.data.vertical);
        expect(second.data.authorizationWindowEndsAt).toBe('2026-10-11T20:00:00.000Z');
        expect(authorize).toHaveBeenCalledOnce();
    });

    // B3 UI (B3.md:1045-1053)
    it('does not read a signup window for a different account', async () => {
        const { user, option } = await fixture();
        const [otherUser] = await getDb()
            .insert(users)
            .values({
                email: `b3-signup-window-other-${crypto.randomUUID()}@example.test`,
                displayName: 'Other account',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            })
            .returning();
        if (!otherUser) throw new Error('No other user');
        const fake = new FakePaymentProvider({
            clock,
            idNamespace: crypto.randomUUID(),
            honestAbout: [{ lie: 'M1', why: 'create a row for the ownership-scoped read' }]
        });
        const app = initApp({ clock, paymentProvider: fake });
        const response = await app.request(path, {
            method: 'POST',
            headers: headers(user.id),
            body: JSON.stringify({ billingOptionId: option.id })
        });
        const body = await response.json();

        expect(response.status).toBe(201);
        await expect(
            readSignupWindow({ subscriptionId: body.data.subscriptionId, userId: otherUser.id })
        ).resolves.toBeNull();
    });
});
