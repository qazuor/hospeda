import { getDb, sql } from '@repo/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    insertPlan,
    insertVersion,
    otherAdmin,
    publishBody,
    publishUrl,
    restoreProductionPlanCatalog,
    superAdmin,
    truncatePlanCatalog
} from './plan-publication.helpers.js';

const app = initApp();

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
});
beforeEach(async () => truncatePlanCatalog());
afterAll(async () => {
    await restoreProductionPlanCatalog();
    await testDb.teardown();
});

describe('TEST:1704:4 admin plan catalog read route', () => {
    it('reads current versions, rejects unauthorized/invalid queries, and sees a published version', async () => {
        const planSlug = `hos1704-a-${crypto.randomUUID()}`;
        const emptySlug = `hos1704-b-${crypto.randomUUID()}`;
        const planId = await insertPlan({ vertical: 'accommodation', slug: planSlug });
        const emptyPlanId = await insertPlan({ vertical: 'accommodation', slug: emptySlug });
        const otherVerticalId = await insertPlan({
            vertical: 'venue',
            slug: `hos1704-venue-${crypto.randomUUID()}`
        });
        const previousVersionId = await insertVersion({
            planId,
            vertical: 'accommodation',
            rank: 17,
            sellable: false,
            current: false
        });
        const currentVersionId = await insertVersion({
            planId,
            vertical: 'accommodation',
            rank: 18,
            sellable: true,
            current: true,
            trialDays: 3,
            graceDays: 5,
            entitlements: [{ key: 'view_basic_stats' }],
            limits: [{ key: 'max_photos_per_accommodation', value: 21 }],
            billingCycles: ['monthly', 'annual']
        });
        const get = () =>
            app.request('/api/v1/admin/plan-catalog/plans?vertical=accommodation', {
                headers: superAdmin
            });
        const count = async () =>
            getDb().execute(sql`SELECT
            (SELECT count(*) FROM plan) AS plans,
            (SELECT count(*) FROM plan_version) AS versions,
            (SELECT count(*) FROM plan_version_entitlement) AS entitlements,
            (SELECT count(*) FROM plan_version_limit) AS limits,
            (SELECT count(*) FROM billing_option) AS options`);
        const before = await count();
        const response = await get();
        const body = (await response.json()) as {
            data: { vertical: string; plans: Array<Record<string, unknown>> };
        };
        const after = await count();
        expect(response.status).toBe(200);
        const actual = body.data.plans.filter((plan) =>
            [planId, emptyPlanId].includes(String(plan.planId))
        );
        expect(actual).toEqual([
            {
                planId,
                slug: planSlug,
                name: `Plan ${planSlug}`,
                description: null,
                pricingOrder: 0,
                role: null,
                currentVersion: {
                    versionId: currentVersionId,
                    rank: 18,
                    sellable: true,
                    trialDays: 3,
                    graceDays: 5,
                    allowsPause: true,
                    inheritsTouristVip: false,
                    entitlements: [{ key: 'view_basic_stats', planQuota: null, trialQuota: null }],
                    limits: [{ key: 'max_photos_per_accommodation', value: 21 }],
                    cycles: ['annual', 'monthly']
                }
            },
            {
                planId: emptyPlanId,
                slug: emptySlug,
                name: `Plan ${emptySlug}`,
                description: null,
                pricingOrder: 0,
                role: null,
                currentVersion: null
            }
        ]);
        expect(body.data.vertical).toBe('accommodation');
        expect(body.data.plans.some((plan) => plan.planId === otherVerticalId)).toBe(false);
        expect(after.rows).toEqual(before.rows);
        expect(actual.some((plan) => JSON.stringify(plan).includes(previousVersionId))).toBe(false);

        const forbidden = await app.request(
            '/api/v1/admin/plan-catalog/plans?vertical=accommodation',
            { headers: otherAdmin }
        );
        expect(forbidden.status).toBe(403);
        expect((await forbidden.json()).error.code).toBe('FORBIDDEN');
        for (const query of ['', '?vertical=foo']) {
            const invalid = await app.request(`/api/v1/admin/plan-catalog/plans${query}`, {
                headers: superAdmin
            });
            expect(invalid.status).toBe(400);
            expect((await invalid.json()).error.code).toBe('VALIDATION_ERROR');
        }

        const published = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                overrides: {
                    rank: 19,
                    trialDays: 2,
                    entitlements: [{ key: 'view_basic_stats' }],
                    limits: [{ key: 'max_photos_per_accommodation', value: 22 }]
                }
            })
        });
        expect(published.status, JSON.stringify(await published.clone().json())).toBe(201);
        const publishedBody = (await published.json()) as { data: { id: string } };
        const refreshed = await get();
        const refreshedBody = (await refreshed.json()) as {
            data: {
                plans: Array<{
                    planId: string;
                    currentVersion: { versionId: string; rank: number } | null;
                }>;
            };
        };
        expect(
            refreshedBody.data.plans.find((plan) => plan.planId === planId)?.currentVersion
        ).toEqual({
            versionId: publishedBody.data.id,
            rank: 19
        });
    });
});
