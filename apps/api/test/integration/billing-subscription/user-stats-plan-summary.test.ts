import { billingOptions, eq, getDb, inArray, plans, planVersions, subscriptions } from '@repo/db';
import { UserStatsResponseSchema, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    retireSelfCancelRows,
    seedSelfComplement,
    seedSelfState,
    seedUser
} from './self-cancel-fixtures';

const route = '/api/v1/protected/users/me/stats';
let app: ReturnType<typeof initApp>;
const extraRows: string[] = [];

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp();
});

afterEach(async () => {
    const db = getDb();
    if (extraRows.length)
        await db.delete(subscriptions).where(inArray(subscriptions.id, extraRows));
    extraRows.length = 0;
    await retireSelfCancelRows();
});

afterAll(async () => {
    await retireSelfCancelRows();
    await testDb.teardown();
});

async function readStats(ownerId: string) {
    const response = await app.request(route, {
        headers: actorHeaders({ id: ownerId, role: 'USER', permissions: [] })
    });
    expect(response.status).toBe(200);
    return ((await response.json()) as { data: Record<string, unknown> }).data;
}

async function seedVenuePrincipal(ownerId: string) {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.VENUE,
            slug: `stats-${crypto.randomUUID()}`,
            name: 'Venue test plan'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: VerticalEnum.VENUE,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected plan version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 7300, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    const [row] = await db
        .insert(subscriptions)
        .values({
            userId: ownerId,
            vertical: VerticalEnum.VENUE,
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!row) throw new Error('Expected subscription');
    extraRows.push(row.id);
    return { slug: `stats-${plan.id}`, name: 'Venue test plan' };
}

describe('TEST:1756:1-7 user stats plan summary', () => {
    it('TEST:1756:1 returns the anchored plan for one live principal', async () => {
        const row = await seedSelfState('ACTIVE');
        const [anchor] = await getDb()
            .select({ slug: plans.slug, name: plans.name })
            .from(subscriptions)
            .innerJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
            .innerJoin(plans, eq(plans.id, planVersions.planId))
            .where(eq(subscriptions.id, row.subscriptionId));
        const data = await readStats(row.ownerId);
        expect(data.plan).toEqual({ ...anchor, status: 'ACTIVE', vertical: 'accommodation' });
        expect(data.activeSubscriptionsCount).toBe(1);
        expect(typeof data.bookmarkCount).toBe('number');
        expect(typeof data.reviewCount).toBe('number');
        expect(UserStatsResponseSchema.safeParse(data).success).toBe(true);
    });

    it('TEST:1756:2 returns required null and zero fields without subscriptions', async () => {
        const ownerId = await seedUser('stats-no-subscriptions');
        const data = await readStats(ownerId);
        expect(data).toHaveProperty('plan', null);
        expect(data).toHaveProperty('activeSubscriptionsCount', 0);
        expect(UserStatsResponseSchema.safeParse(data).success).toBe(true);
    });

    it('TEST:1756:3 returns no single plan for two live verticals', async () => {
        const row = await seedSelfState('ACTIVE');
        await seedVenuePrincipal(row.ownerId);
        const data = await readStats(row.ownerId);
        expect(data.plan).toBeNull();
        expect(data.activeSubscriptionsCount).toBe(2);
        expect(UserStatsResponseSchema.safeParse(data).success).toBe(true);
    });

    it('TEST:1756:6 parses the actual response body for zero, one, and multiple subscriptions', async () => {
        const emptyOwner = await seedUser('stats-schema-empty');
        const emptyData = await readStats(emptyOwner);
        expect(emptyData).toHaveProperty('plan', null);
        expect(emptyData).toHaveProperty('activeSubscriptionsCount', 0);
        expect(UserStatsResponseSchema.safeParse(emptyData).success).toBe(true);

        const one = await seedSelfState('ACTIVE');
        const oneData = await readStats(one.ownerId);
        expect(UserStatsResponseSchema.safeParse(oneData).success).toBe(true);

        const multiple = await seedSelfState('ACTIVE');
        await seedVenuePrincipal(multiple.ownerId);
        const multipleData = await readStats(multiple.ownerId);
        expect(UserStatsResponseSchema.safeParse(multipleData).success).toBe(true);
    });

    it.each([
        'GRACE_PERIOD',
        'SUSPENDED',
        'CANCEL_SCHEDULED'
    ] as const)('TEST:1756:4 counts %s', async (status) => {
        const row = await seedSelfState(status);
        const data = await readStats(row.ownerId);
        expect(data.activeSubscriptionsCount).toBe(1);
        expect((data.plan as { status: string }).status).toBe(status);
    });
    it.each([
        'PAUSED',
        'PENDING_AUTHORIZATION',
        'CANCELLED'
    ] as const)('TEST:1756:4 excludes %s', async (status) => {
        const row = await seedSelfState(status);
        const data = await readStats(row.ownerId);
        expect(data.activeSubscriptionsCount).toBe(0);
        expect(data.plan).toBeNull();
    });

    it('TEST:1756:5 ignores live complement rows', async () => {
        const row = await seedSelfState('ACTIVE');
        await seedSelfComplement(row.ownerId);
        expect((await readStats(row.ownerId)).activeSubscriptionsCount).toBe(1);
    });

    it('TEST:1756:7 isolates the owner from another account subscription', async () => {
        const ownerId = await seedUser('stats-isolated-empty');
        const other = await seedSelfState('ACTIVE');
        expect((await readStats(ownerId)).activeSubscriptionsCount).toBe(0);
        expect((await readStats(other.ownerId)).activeSubscriptionsCount).toBe(1);
    });
});
