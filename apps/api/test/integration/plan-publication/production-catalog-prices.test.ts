import { billingOptions, eq, getDb, plans, planVersions } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { testDb } from '../../e2e/setup/test-database';
import { restoreProductionPlanCatalog } from './plan-publication.helpers.js';

/**
 * Regression: the production catalog shipped plans without prices, so every
 * public pricing page answered `billingOptions: []` ("Planes no disponibles").
 * Migration 0176 loads the live production prices; this file reads them back
 * through the public route, the way the pricing pages do.
 *
 * The expected table is the owner's (2026-10-20), in ARS minor units, written
 * here by hand on purpose: deriving it from the generator would make the test
 * agree with whatever the generator says.
 */
const EXPECTED_PRICES: Readonly<
    Record<string, Readonly<Record<string, readonly [monthly: number, annual: number]>>>
> = {
    accommodation: {
        'owner-basico': [1_800_000, 18_000_000],
        'owner-pro': [3_500_000, 35_000_000],
        'owner-premium': [6_500_000, 65_000_000]
    },
    gastronomy: {
        'gastronomy-basico': [3_000_000, 30_000_000],
        'gastronomy-pro': [6_500_000, 65_000_000],
        'gastronomy-premium': [8_000_000, 80_000_000]
    },
    experience: {
        'experience-basico': [1_500_000, 15_000_000],
        'experience-pro': [3_500_000, 35_000_000],
        'experience-premium': [5_000_000, 50_000_000]
    },
    tourist: { 'tourist-vip': [1_500_000, 15_000_000] },
    partner: {
        'partner-silver': [1_500_000, 15_000_000],
        'partner-gold': [3_000_000, 30_000_000]
    }
};

/** The verticals the public plan catalog route serves (partner is read from the DB). */
const PUBLIC_VERTICALS = ['accommodation', 'gastronomy', 'experience', 'tourist'] as const;

const publicHeaders = { 'User-Agent': 'vitest' };

interface PublicPlan {
    readonly slug: string;
    readonly billingOptions: readonly { cycle: string; amount: number; currency: string }[];
}

describe('production catalog prices (migration 0176)', () => {
    beforeAll(async () => {
        await testDb.setup();
        // Arrange: other files of this database truncate the catalog; put the
        // migrations' rows back exactly as 0144 and 0176 write them.
        await restoreProductionPlanCatalog();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    it.each(
        PUBLIC_VERTICALS
    )('the public %s catalog prices every sellable plan monthly and annually', async (vertical) => {
        // Act
        const response = await initApp().request(
            `/api/v1/public/plan-catalog?vertical=${vertical}`,
            { headers: publicHeaders }
        );

        // Assert
        expect(response.status, await response.clone().text()).toBe(200);
        const body = (await response.json()).data as { plans: PublicPlan[] };
        const expected = EXPECTED_PRICES[vertical];
        expect(body.plans.map((plan) => plan.slug).sort()).toEqual(
            Object.keys(expected ?? {}).sort()
        );
        for (const plan of body.plans) {
            const [monthly, annual] = expected?.[plan.slug] ?? [];
            expect(
                plan.billingOptions.map(({ cycle, amount, currency }) => ({
                    cycle,
                    amount,
                    currency
                })),
                plan.slug
            ).toEqual([
                { cycle: 'monthly', amount: monthly, currency: 'ARS' },
                { cycle: 'annual', amount: annual, currency: 'ARS' }
            ]);
        }
    });

    it('prices both partner plans and no role plan', async () => {
        // Act
        const rows = await getDb()
            .select({
                vertical: plans.vertical,
                slug: plans.slug,
                role: plans.role,
                cycle: billingOptions.cycle,
                amount: billingOptions.amount
            })
            .from(billingOptions)
            .innerJoin(planVersions, eq(planVersions.id, billingOptions.planVersionId))
            .innerJoin(plans, eq(plans.id, planVersions.planId));

        // Assert
        expect(rows).toHaveLength(24);
        expect(rows.filter((row) => row.role !== null)).toEqual([]);
        const partner = rows
            .filter((row) => row.vertical === 'partner')
            .map(({ slug, cycle, amount }) => `${slug}:${cycle}:${amount}`)
            .sort();
        expect(partner).toEqual([
            'partner-gold:annual:30000000',
            'partner-gold:monthly:3000000',
            'partner-silver:annual:15000000',
            'partner-silver:monthly:1500000'
        ]);
    });
});
