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
 * Migration `0138_woozy_dagger.sql` owns billing deadline version 1, but every
 * `hospeda-api` integration file shares one database and runs in series
 * (`vitest.config.integration.ts`: `fileParallelism: false`). `testDb.clean()`
 * truncates `billing_deadline_version` (it is not in the exempt catalog list)
 * and `billing-deadlines.test.ts` truncates it explicitly after every test, so
 * by the time this file runs the migration row is gone. The reuse path reads
 * `values['10'].cardHours` (`resolve-live-commitment.ts:43`), therefore this
 * file must recreate version 1 instead of assuming it survives.
 * `onConflictDoNothing` keeps the seed idempotent and never triggers the
 * UPDATE/DELETE-only immutability trigger.
 */
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
            email: `b3-reuse-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 reuse route user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `b3-reuse-${crypto.randomUUID()}`,
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

describe('TEST:B3:6 protected S1 route reuses the live commitment', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    beforeEach(ensureBillingDeadlineVersion1);
    afterAll(async () => testDb.teardown());

    it('answers the same domain body on a retry without calling authorize again', async () => {
        const { user, option } = await fixture(true);
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'inspect a healthy creation through the route' }]
        });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        const body = JSON.stringify({ billingOptionId: option.id });

        const first = await app.request(path, {
            method: 'POST',
            headers: headers(user.id),
            body
        });
        const firstBody = await first.json();
        const second = await app.request(path, {
            method: 'POST',
            headers: headers(user.id),
            body
        });
        const secondBody = await second.json();

        // The POST success status of this route is 201 (created) — the route
        // factory's default for POST — and the reuse is answered by the same
        // route, so both calls share it. The route is not editable from this
        // leaf (Coord-40: 201/201 is the contract, not a test bug).
        expect(first.status).toBe(201);
        expect(second.status).toBe(201);

        // Compare the COMPLETE body, not just `data`. The only fields that
        // legitimately change per request are `metadata.timestamp` and
        // `metadata.requestId`: `createResponse` stamps both on every response
        // (apps/api/src/utils/response-helpers.ts:270). Mask exactly those two
        // and deep-compare everything else — `success`, the whole `data`
        // payload and the remaining `metadata` keys — between both calls.
        const maskPerRequestMetadata = (body: unknown) => {
            const envelope = body as {
                readonly metadata: { readonly timestamp: string; readonly requestId: string };
            };
            return {
                ...envelope,
                metadata: {
                    ...envelope.metadata,
                    timestamp: 'PER_REQUEST',
                    requestId: 'PER_REQUEST'
                }
            };
        };
        expect(maskPerRequestMetadata(secondBody)).toEqual(maskPerRequestMetadata(firstBody));

        // The masked comparison keeps `metadata.timestamp` / `metadata.requestId`
        // honest: both must be present strings, so the exclusion above is not
        // hiding an absent field.
        expect(firstBody).toMatchObject({
            success: true,
            data: {
                subscriptionId: expect.any(String),
                authorizationId: expect.any(String),
                checkoutUrl: expect.any(String)
            },
            metadata: {
                timestamp: expect.any(String),
                requestId: expect.any(String)
            }
        });
        expect(authorize).toHaveBeenCalledOnce();
        expect(
            await getDb().select().from(subscriptions).where(eq(subscriptions.userId, user.id))
        ).toHaveLength(1);
    });

    it('answers 409 COMMITMENT_TAKEN when the live commitment is another plan', async () => {
        const mine = await fixture(true);
        const other = await fixture(true);
        // TEST:B3:10 (base: versión y vencimiento guardados al abrir la ventana)
        await subscriptionModel.createPendingAuthorization({
            userId: mine.user.id,
            vertical: 'accommodation',
            planVersionId: other.version.id,
            billingOptionId: other.option.id,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
        });
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
    });
});
