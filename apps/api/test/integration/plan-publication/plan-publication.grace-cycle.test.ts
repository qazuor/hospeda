import { eq, getDb, planVersions } from '@repo/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    insertPlan,
    insertVersion,
    publishBody,
    publishUrl,
    restoreProductionPlanCatalog,
    superAdmin,
    truncatePlanCatalog
} from './plan-publication.helpers.js';

const REJECTION_MESSAGE = 'la gracia debe ser menor que el ciclo más corto que la versión ofrece';

describe('TEST:B7:13 — publishing a plan version rejects a grace not shorter than its shortest cycle (AC:B7:19)', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });

    beforeEach(async () => truncatePlanCatalog());

    afterAll(async () => {
        await restoreProductionPlanCatalog();
        await testDb.teardown();
    });

    async function publish(args: { slug: string; graceDays: number; cycles?: string[] }) {
        const planId = await insertPlan({ vertical: 'accommodation', slug: args.slug });
        const overrides: Record<string, unknown> = {
            graceDays: args.graceDays,
            entitlements: [{ key: 'view_basic_stats' }],
            limits: [{ key: 'max_photos_per_accommodation', value: 20 }]
        };
        if (args.cycles) overrides.cycles = args.cycles;

        const response = await initApp().request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ overrides })
        });
        return { planId, response };
    }

    async function expectRejected(args: { slug: string; graceDays: number; cycles?: string[] }) {
        const { planId, response } = await publish(args);
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(REJECTION_MESSAGE);
        const versions = await getDb()
            .select({ id: planVersions.id })
            .from(planVersions)
            .where(eq(planVersions.planId, planId));
        expect(versions).toEqual([]);
    }

    async function expectPublished(args: { slug: string; graceDays: number; cycles?: string[] }) {
        const { planId, response } = await publish(args);
        expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
        const published = (await response.json()).data;
        const [version] = await getDb()
            .select({ graceDays: planVersions.graceDays })
            .from(planVersions)
            .where(eq(planVersions.id, published.id));
        expect(version).toEqual({ graceDays: args.graceDays });
        expect(published.planId).toBe(planId);
    }

    it('TEST:B7:13 equal monthly boundary rejects graceDays 28', async () => {
        await expectRejected({ slug: 'monthly-equal', cycles: ['monthly'], graceDays: 28 });
    });

    it('TEST:B7:13 greater than monthly boundary rejects graceDays 29', async () => {
        await expectRejected({ slug: 'monthly-greater', cycles: ['monthly'], graceDays: 29 });
    });

    it('TEST:B7:13 grace shorter than monthly cycle publishes grace_days 27', async () => {
        await expectPublished({ slug: 'monthly-shorter', cycles: ['monthly'], graceDays: 27 });
    });

    it('TEST:B7:13 the shortest requested cycle rejects graceDays 60', async () => {
        await expectRejected({
            slug: 'monthly-and-annual',
            cycles: ['monthly', 'annual'],
            graceDays: 60
        });
    });

    it('TEST:B7:13 annual cycle publishes graceDays 60', async () => {
        await expectPublished({ slug: 'annual-only', cycles: ['annual'], graceDays: 60 });
    });

    it('TEST:B7:13 quarterly boundary rejects graceDays 89', async () => {
        await expectRejected({ slug: 'quarterly-equal', cycles: ['quarterly'], graceDays: 89 });
    });

    it('TEST:B7:13 quarterly cycle publishes graceDays 88', async () => {
        await expectPublished({ slug: 'quarterly-shorter', cycles: ['quarterly'], graceDays: 88 });
    });

    it('TEST:B7:13 without request cycles validates against the current annual billing option', async () => {
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'current-annual' });
        await insertVersion({
            planId,
            vertical: 'accommodation',
            rank: 10,
            sellable: true,
            current: true,
            billingCycles: ['annual']
        });
        const response = await initApp().request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                overrides: {
                    graceDays: 60,
                    entitlements: [{ key: 'view_basic_stats' }],
                    limits: [{ key: 'max_photos_per_accommodation', value: 20 }]
                }
            })
        });
        expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
        const published = (await response.json()).data;
        const [version] = await getDb()
            .select({ graceDays: planVersions.graceDays })
            .from(planVersions)
            .where(eq(planVersions.id, published.id));
        expect(version).toEqual({ graceDays: 60 });
    });
});
