import { eq, getDb, planVersionEntitlements, planVersionLimits } from '@repo/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    insertPlan,
    publishBody,
    publishUrl,
    superAdmin,
    truncatePlanCatalog
} from './plan-publication.helpers.js';

/**
 * TEST:V2:10 (integración con DB, HOS-1655) — trial override limits and the
 * DO exception for the Tourist floor (piece V2.4a, AC-2, AC-3).
 */

/**
 * Reads the exact stored limits and entitlement quotas of a version directly
 * from the database. The shared `readVersionEffects` helper returns keys only,
 * so the values and quotas are read here to make a `+1` in the service fail.
 * @param versionId - ID of the version to inspect.
 * @returns Stored limit rows and entitlement quota rows.
 */
async function readStoredEffects(versionId: string): Promise<{
    limits: { key: string; value: number }[];
    entitlements: { key: string; planQuota: number | null; trialQuota: number | null }[];
}> {
    const limits = await getDb()
        .select({ key: planVersionLimits.key, value: planVersionLimits.value })
        .from(planVersionLimits)
        .where(eq(planVersionLimits.planVersionId, versionId));
    const entitlements = await getDb()
        .select({
            key: planVersionEntitlements.key,
            planQuota: planVersionEntitlements.planQuota,
            trialQuota: planVersionEntitlements.trialQuota
        })
        .from(planVersionEntitlements)
        .where(eq(planVersionEntitlements.planVersionId, versionId));
    return { limits, entitlements };
}
describe('HOS-1655 V2.4a — trial overrides and Tourist floor DO exception', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });

    beforeEach(async () => truncatePlanCatalog());

    afterAll(async () => testDb.teardown());

    /* ------------------------------------------------------------------ */
    /*  (i) trial publishes its override limit; readVersionEffects confirms */
    /* ------------------------------------------------------------------ */

    it('TEST:V2:10 (i) trial accommodation publishes max_accommodations limit: 201, effects written', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: 'trial',
            role: 'trial'
        });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                overrides: {
                    sellable: false,
                    trialDays: 7,
                    limits: [{ key: 'max_accommodations', value: 1 }]
                }
            })
        });
        expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
        const published = (await response.json()).data;
        expect(published).toMatchObject({ planId, sellable: false, current: true });
        // The trial override limit IS stored with its exact value; entitlements
        // are zero. A `+1` on the value in the service must break this assertion.
        const effects = await readStoredEffects(published.id);
        expect(effects.entitlements).toEqual([]);
        expect(effects.limits).toEqual([{ key: 'max_accommodations', value: 1 }]);
    });

    /* ------------------------------------------------------------------ */
    /*  (ii) trial with a non-override limit is rejected                    */
    /* ------------------------------------------------------------------ */

    it('TEST:V2:10 (ii) trial: limit outside override list => 400', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: 'trial',
            role: 'trial'
        });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                overrides: {
                    sellable: false,
                    trialDays: 7,
                    limits: [{ key: 'max_favorites', value: 5 }]
                }
            })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(
            'el plan de trial sólo guarda como override la cantidad de fichas de su vertical'
        );
    });

    /* ------------------------------------------------------------------ */
    /*  (iii) Tourist floor publishes the DO exception list                 */
    /* ------------------------------------------------------------------ */

    it('TEST:V2:10 (iii) Tourist floor publishes DO list: 201, effects stored', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'tourist',
            slug: 'floor',
            role: 'floor'
        });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                overrides: {
                    sellable: false,
                    entitlements: [
                        { key: 'save_favorites' },
                        { key: 'write_reviews' },
                        { key: 'ai_search', planQuota: 10, trialQuota: 10 },
                        { key: 'ai_chat', planQuota: 10, trialQuota: 10 },
                        { key: 'subscribe_to_plan' },
                        { key: 'recover_own_listing' }
                    ],
                    limits: [
                        { key: 'max_favorites', value: 5 },
                        { key: 'max_ai_search_per_month', value: 10 },
                        { key: 'max_ai_chat_consumer_per_month', value: 10 }
                    ]
                }
            })
        });
        expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
        const published = (await response.json()).data;
        expect(published).toMatchObject({ planId, sellable: false, current: true });
        // Verify the COMPLETE DO list is stored: keys, values and quotas, read
        // straight from the DB. Any `+1` on a value or quota in the service
        // must break these exact assertions.
        const effects = await readStoredEffects(published.id);
        expect(effects.entitlements).toHaveLength(6);
        expect(effects.entitlements).toEqual(
            expect.arrayContaining([
                { key: 'save_favorites', planQuota: null, trialQuota: null },
                { key: 'write_reviews', planQuota: null, trialQuota: null },
                { key: 'ai_search', planQuota: 10, trialQuota: 10 },
                { key: 'ai_chat', planQuota: 10, trialQuota: 10 },
                { key: 'subscribe_to_plan', planQuota: null, trialQuota: null },
                { key: 'recover_own_listing', planQuota: null, trialQuota: null }
            ])
        );
        expect(effects.limits).toHaveLength(3);
        expect(effects.limits).toEqual(
            expect.arrayContaining([
                { key: 'max_favorites', value: 5 },
                { key: 'max_ai_search_per_month', value: 10 },
                { key: 'max_ai_chat_consumer_per_month', value: 10 }
            ])
        );
    });

    /* ------------------------------------------------------------------ */
    /*  (iv) Tourist floor with wrong limit value => 400                    */
    /* ------------------------------------------------------------------ */

    it('TEST:V2:10 (iv) Tourist floor: max_favorites=6 => 400 clave de más', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'tourist',
            slug: 'floor',
            role: 'floor'
        });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                overrides: {
                    sellable: false,
                    entitlements: [
                        { key: 'save_favorites' },
                        { key: 'write_reviews' },
                        { key: 'ai_search', planQuota: 10, trialQuota: 10 },
                        { key: 'ai_chat', planQuota: 10, trialQuota: 10 },
                        { key: 'subscribe_to_plan' },
                        { key: 'recover_own_listing' }
                    ],
                    limits: [
                        { key: 'max_favorites', value: 6 },
                        { key: 'max_ai_search_per_month', value: 10 },
                        { key: 'max_ai_chat_consumer_per_month', value: 10 }
                    ]
                }
            })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe('clave de más');
    });

    /* ------------------------------------------------------------------ */
    /*  (v) Accommodation floor with save_favorites => 400                  */
    /* ------------------------------------------------------------------ */

    it('TEST:V2:10 (v) accommodation floor: save_favorites => 400 clave de más', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: 'floor',
            role: 'floor'
        });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                overrides: {
                    sellable: false,
                    entitlements: [
                        { key: 'save_favorites' },
                        { key: 'subscribe_to_plan' },
                        { key: 'recover_own_listing' }
                    ],
                    limits: []
                }
            })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe('clave de más');
    });
});
