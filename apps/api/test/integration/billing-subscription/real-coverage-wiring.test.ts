/**
 * TEST:B4:1 (AC:B4:1), composition half: when verticals calls `coverage()`
 * through the production composition root (`getListingAccessPorts().billing`),
 * billing's real SUBSCRIPTION source answers from the subscription row. Before
 * HOS-1532 the root composed the bootstrap coverage, which never emits a
 * SUBSCRIPTION source, so this file fails if `ports.ts` goes back to it.
 *
 * Cleans only its own rows in `afterEach`; never TRUNCATE.
 */
import { billingOptions, eq, getDb, plans, planVersions, subscriptions, users } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingAccessPorts } from '../../../src/utils/listing-access/ports';
import { testDb } from '../../e2e/setup/test-database';

const now = new Date('2026-10-12T12:00:00.000Z');

/**
 * The rows one case created, deleted in `afterEach` (children first). The plan
 * and its version stay: `plan_version` is immutable by trigger
 * (`reject_plan_version_effect_change`), and both are neither current nor
 * sellable, so no catalog lookup and no global population sees them.
 */
interface Created {
    userId?: string;
    billingOptionId?: string;
}

const created: Created[] = [];

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => now } });
});

afterEach(async () => {
    const db = getDb();
    for (const rows of created.splice(0)) {
        if (rows.userId)
            await db.delete(subscriptions).where(eq(subscriptions.userId, rows.userId));
        if (rows.billingOptionId) {
            await db.delete(billingOptions).where(eq(billingOptions.id, rows.billingOptionId));
        }
        if (rows.userId) await db.delete(users).where(eq(users.id, rows.userId));
    }
});

/** A fresh account, registered for cleanup. */
async function seedUser(): Promise<{ readonly userId: string; readonly rows: Created }> {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `b4-real-coverage-${crypto.randomUUID()}@example.test`,
            displayName: 'B4 real coverage',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Expected user');
    const rows: Created = { userId: user.id };
    created.push(rows);
    return { userId: user.id, rows };
}

/**
 * An `ACTIVE` PRINCIPAL subscription of `userId` in accommodation, over its own
 * plan version (neither current nor sellable, so no catalog lookup sees it).
 */
async function seedActiveSubscription(args: { readonly userId: string; readonly rows: Created }) {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `b4-real-coverage-${crypto.randomUUID()}`,
            name: 'B4 real coverage'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: VerticalEnum.ACCOMMODATION,
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
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 250000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    args.rows.billingOptionId = option.id;
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId: args.userId,
            vertical: VerticalEnum.ACCOMMODATION,
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id, createdAt: subscriptions.createdAt });
    if (!subscription) throw new Error('Expected subscription');
    return { planVersionId: version.id, createdAt: subscription.createdAt };
}

describe('TEST:B4:1 — the composition root answers coverage from the real billing sources', () => {
    it('emits the SUBSCRIPTION source, with its eight fields, for an ACTIVE subscription', async () => {
        const { userId, rows } = await seedUser();
        const seeded = await seedActiveSubscription({ userId, rows });

        const response = await getListingAccessPorts().billing.coverage({
            userId,
            vertical: VerticalEnum.ACCOMMODATION
        });

        expect(response.covered).toBe(true);
        expect(response.sources.filter((source) => source.type === 'SUBSCRIPTION')).toEqual([
            {
                type: 'SUBSCRIPTION',
                reference: { kind: 'PLAN_VERSION', planVersionId: seeded.planVersionId },
                scope: 'VERTICAL',
                target: null,
                since: seeded.createdAt,
                until: 'NO_KNOWN_DATE',
                charged: false,
                floor: null
            }
        ]);
        expect(response.sources.some((source) => source.type === 'BASE')).toBe(true);
    });

    it('does not carry the subscription into another vertical', async () => {
        const { userId, rows } = await seedUser();
        await seedActiveSubscription({ userId, rows });

        const response = await getListingAccessPorts().billing.coverage({
            userId,
            vertical: VerticalEnum.GASTRONOMY
        });

        expect(response.sources.some((source) => source.type === 'SUBSCRIPTION')).toBe(false);
        expect(response.sources.some((source) => source.type === 'BASE')).toBe(true);
    });

    it('answers only trial and BASE, uncovered, without a subscription', async () => {
        const { userId } = await seedUser();

        const response = await getListingAccessPorts().billing.coverage({
            userId,
            vertical: VerticalEnum.ACCOMMODATION
        });

        expect(response.covered).toBe(false);
        expect(response.sources.map((source) => source.type).sort()).toEqual(['BASE', 'TRIAL']);
    });
});
