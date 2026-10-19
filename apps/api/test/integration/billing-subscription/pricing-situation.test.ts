import { randomUUID } from 'node:crypto';
import {
    billingOptions,
    eq,
    getDb,
    inArray,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { createApiBillingCoverage } from '../../../src/utils/listing-access/billing-coverage';
import { createBootstrapCoverageReader } from '../../../src/utils/listing-access/bootstrap-coverage-reader';
import { testDb } from '../../e2e/setup/test-database';
import {
    createTrial,
    ensurePublicationCatalog
} from '../listing-publication/publication-routes.helpers';
import { cleanGrantCoverageFixtures, makeGrantCoverageHarness } from './grant-coverage-fixtures';

const route = '/api/v1/protected/billing-subscription/pricing-situation';
const now = new Date('2026-10-10T12:00:00.000Z');
const clock = { now: () => now };
const madeVersions: string[] = [];

async function user() {
    const [row] = await getDb()
        .insert(users)
        .values({
            email: `pricing-situation-${randomUUID()}@example.test`,
            displayName: 'Pricing situation test',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!row) throw new Error('Expected pricing situation user');
    return row.id;
}

async function option(vertical: string, inheritsTouristVip = false) {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical,
            slug: `pricing-situation-${randomUUID()}`,
            name: 'Pricing situation plan'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: Math.floor(Math.random() * 1_000_000_000) + 1,
            sellable: true,
            current: true,
            trialDays: 14,
            allowsPause: false,
            inheritsTouristVip
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected plan version');
    madeVersions.push(version.id);
    const [billingOption] = await db
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 100000,
            currency: 'ARS'
        })
        .returning({ id: billingOptions.id });
    if (!billingOption) throw new Error('Expected billing option');
    return { planVersionId: version.id, billingOptionId: billingOption.id };
}

async function commitment(
    userId: string,
    status: 'ACTIVE' | 'PENDING_AUTHORIZATION',
    vertical = 'accommodation'
) {
    const selected = await option(vertical);
    const [row] = await getDb()
        .insert(subscriptions)
        .values({
            userId,
            vertical,
            planVersionId: selected.planVersionId,
            billingOptionId: selected.billingOptionId,
            paymentMethod: 'CARD',
            status,
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!row) throw new Error('Expected subscription commitment');
    return selected;
}

function headers(userId?: string) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        ...(userId
            ? {
                  'x-mock-actor-id': userId,
                  'x-mock-actor-role': 'USER',
                  'x-mock-actor-permissions': '[]'
              }
            : {})
    };
}

const app = initApp({
    clock,
    paymentProvider: new FakePaymentProvider({ clock, idNamespace: randomUUID() })
});
async function read(userId: string | undefined, vertical: string) {
    const response = await app.request(`${route}/${vertical}`, { headers: headers(userId) });
    return { response, body: await response.json() };
}

describe('TEST:1621:3 pricing situation is resolved through the protected route', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        injectClock({ clock });
        await ensurePublicationCatalog(VerticalEnum.ACCOMMODATION);
        await ensurePublicationCatalog(VerticalEnum.GASTRONOMY);
        await ensurePublicationCatalog(VerticalEnum.EXPERIENCE);
    });

    afterAll(async () => {
        const db = getDb();
        if (madeVersions.length) {
            // Published catalog versions are immutable except for retirement.
            await db
                .update(planVersions)
                .set({ current: false })
                .where(inArray(planVersions.id, madeVersions));
        }
        // Trial rows have an intentional no-delete trigger; clean the isolated
        // integration database's mutable rows using its test-only harness.
        await testDb.clean();
        await testDb.teardown();
    });

    it('TEST:1621:3 (a) reports the trial plan days for first use', async () => {
        const id = await user();
        const result = await read(id, 'accommodation');
        expect(result.response.status).toBe(200);
        expect(result.body.data).toEqual({ situation: 'FIRST_USE', trialDays: 30 });
    });

    it('TEST:1621:3 (b)(c) returns the exact active and pending commitment references', async () => {
        for (const status of ['ACTIVE', 'PENDING_AUTHORIZATION'] as const) {
            const id = await user();
            const selected = await commitment(id, status);
            const result = await read(id, 'accommodation');
            expect(result.response.status).toBe(200);
            expect(result.body.data).toEqual({
                situation: 'SUBSCRIBED',
                status,
                planVersionId: selected.planVersionId,
                billingOptionId: selected.billingOptionId
            });
        }
    });

    it('TEST:1621:3 (d)(e) distinguishes a running and a consumed trial', async () => {
        const active = await user();
        await createTrial({ userId: active, status: 'TRIAL_ACTIVE' });
        const running = await read(active, 'accommodation');
        expect(running.response.status).toBe(200);
        expect(running.body.data).toEqual({ situation: 'TRIAL' });

        const consumed = await user();
        await createTrial({ userId: consumed, status: 'TRIAL_EXPIRED' });
        const checkout = await read(consumed, 'accommodation');
        expect(checkout.response.status).toBe(200);
        expect(checkout.body.data).toEqual({ situation: 'CHECKOUT' });
    });

    it('TEST:1621:3 (f)(g)(j) reports inherited VIP, checkout, and each actor only sees their own state', async () => {
        const inherited = await user();
        const title = await option('accommodation', true);
        const touristCommitment = await commitment(inherited, 'ACTIVE', 'tourist');
        const [titleRow] = await getDb()
            .insert(subscriptions)
            .values({
                userId: inherited,
                vertical: 'accommodation',
                planVersionId: title.planVersionId,
                billingOptionId: title.billingOptionId,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL'
            })
            .returning({ id: subscriptions.id });
        if (!titleRow) throw new Error('Expected inherited title');
        await option('tourist');

        const inheritedView = await read(inherited, 'tourist');
        expect(inheritedView.response.status).toBe(200);
        expect(inheritedView.body.data).toEqual({ situation: 'TOURIST_VIP_INHERITED' });
        await getDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, titleRow.id));
        await getDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.planVersionId, touristCommitment.planVersionId));
        const lost = await read(inherited, 'tourist');
        expect(lost.response.status).toBe(200);
        expect(lost.body.data).toEqual({ situation: 'CHECKOUT' });

        const other = await user();
        const otherCommitment = await commitment(other, 'ACTIVE');
        expect((await read(other, 'accommodation')).body.data).toMatchObject({
            situation: 'SUBSCRIBED',
            planVersionId: otherCommitment.planVersionId
        });
        expect((await read(inherited, 'accommodation')).body.data).toEqual({
            situation: 'FIRST_USE',
            trialDays: 30
        });
    });

    it('TEST:1621:3 (h)(i) rejects unsupported verticals and guests', async () => {
        const id = await user();
        expect((await read(id, 'partner')).response.status).toBe(400);
        expect((await read(undefined, 'accommodation')).response.status).toBe(401);
    });

    it('TEST:1621:3 (k) keeps permanent coverage distinct from a running trial', async () => {
        const { coverage } = createApiBillingCoverage({ reader: createBootstrapCoverageReader() });
        const harness = await makeGrantCoverageHarness({ subject: { coverage } });
        const id = harness.newUserId();
        await harness.arrange.liveGrant(id, VerticalEnum.ACCOMMODATION);
        const result = await read(id, 'accommodation');
        expect(result.response.status).toBe(200);
        expect(result.body.data).toEqual({ situation: 'COVERED' });
    });

    afterEach(cleanGrantCoverageFixtures);
});
