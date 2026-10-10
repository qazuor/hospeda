import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
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

/**
 * The route files that write a `subscription`, measured from the source tree.
 * Today the new signup is the only one: its `POST` is the single door that
 * reaches `startSubscription` / `subscriptionModel`. If a future route starts
 * creating subscriptions this list fails, which is the point of the inventory
 * (AC:B3:5).
 */
const SUBSCRIPTION_CREATING_ROUTES = ['billing-subscription/index.ts'];

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

async function fixture(sellable: boolean) {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `b3-succession-route-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 succession route user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `b3-succession-route-${crypto.randomUUID()}`,
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

const LIVE_STATUSES = [
    'PENDING_AUTHORIZATION',
    'ACTIVE',
    'GRACE_PERIOD',
    'PAUSED',
    'SUSPENDED',
    'CANCEL_SCHEDULED'
] as const;

describe('TEST:B3:5 — no route of the branch declares a succession (AC:B3:5)', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    beforeEach(ensureBillingDeadlineVersion1);
    afterAll(async () => testDb.teardown());

    it('inventories the routes that create a subscription and finds no succession writer', () => {
        const routesDir = fileURLToPath(new URL('../../../src/routes', import.meta.url));
        const entries = readdirSync(routesDir, { recursive: true, encoding: 'utf8' })
            .map((entry) => entry.split(sep).join('/'))
            .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'));
        const creators = entries.filter((entry) =>
            /\b(startSubscription|createPendingAuthorization|subscriptionModel)\b/.test(
                readFileSync(join(routesDir, entry), 'utf8')
            )
        );
        expect(creators.sort()).toEqual([...SUBSCRIPTION_CREATING_ROUTES]);

        for (const entry of creators) {
            const source = readFileSync(join(routesDir, entry), 'utf8');
            for (const column of [
                'succeedsId',
                'succeededById',
                'succeeds_id',
                'succeeded_by_id'
            ]) {
                expect(source).not.toContain(column);
            }
        }
    });

    it('creates a healthy pending subscription through the only route, with no succession', async () => {
        const { user, option } = await fixture(true);
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'inspect a healthy creation through the route' }]
        });
        const app = initApp({ clock, paymentProvider: fake });
        const response = await app.request(path, {
            method: 'POST',
            headers: headers(user.id),
            body: JSON.stringify({ billingOptionId: option.id })
        });
        expect(response.status).toBe(201);

        const rows = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, user.id));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('PENDING_AUTHORIZATION');
        expect(rows[0]?.class).toBe('PRINCIPAL');
        expect(rows[0]?.succeedsId).toBeNull();
        expect(rows[0]?.succeededById).toBeNull();
    });

    it('answers a plan change over a live commitment with 409 and never a successor', async () => {
        for (const status of LIVE_STATUSES) {
            const mine = await fixture(true);
            const other = await fixture(true);
            const seeded = await subscriptionModel.createPendingAuthorization({
                userId: mine.user.id,
                vertical: 'accommodation',
                planVersionId: other.version.id,
                billingOptionId: other.option.id,
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
            });
            await getDb()
                .update(subscriptions)
                .set({ status })
                .where(eq(subscriptions.id, seeded.subscription.id));

            const fake = new FakePaymentProvider({ clock });
            const authorize = vi.spyOn(fake, 'authorize');
            const app = initApp({ clock, paymentProvider: fake });
            const response = await app.request(path, {
                method: 'POST',
                headers: headers(mine.user.id),
                body: JSON.stringify({ billingOptionId: mine.option.id })
            });

            expect(response.status).toBe(409);
            expect((await response.json()).error.reason).toBe('COMMITMENT_TAKEN');
            expect(authorize).not.toHaveBeenCalled();

            const rows = await getDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.userId, mine.user.id));
            expect(rows).toHaveLength(1);
            expect(rows[0]?.id).toBe(seeded.subscription.id);
            expect(rows[0]?.status).toBe(status);
            expect(rows[0]?.succeedsId).toBeNull();
            expect(rows[0]?.succeededById).toBeNull();
        }
    });
});
