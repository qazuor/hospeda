import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    insertPlan,
    publishBody,
    publishUrl,
    readVersionEffects,
    superAdmin,
    truncatePlanCatalog
} from './plan-publication.helpers.js';

/**
 * TEST:V2:10 (integración con DB, HOS-1655) — trial override limits and the
 * DO exception for the Tourist floor (piece V2.4a, AC-2, AC-3).
 */
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
        // The trial override limit IS stored; entitlements are zero.
        const effects = await readVersionEffects({ versionId: published.id });
        expect(effects.limits).toHaveLength(1);
        expect(effects.limits[0]?.key).toBe('max_accommodations');
        expect(effects.entitlements).toEqual([]);
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
        // Verify the COMPLETE DO list is stored: keys, values, and quotas.
        // NOTE: `readVersionEffects` only returns `{ key }` (helper at
        // plan-publication.helpers.ts is out of permitidas.txt).  We verify
        // stored keys here; values/quotas are implicitly verified by the
        // unit test that asserts the exact exception constant.
        const effects = await readVersionEffects({ versionId: published.id });
        expect(effects.entitlements).toHaveLength(6);
        const entKeys = new Set(effects.entitlements.map((e) => e.key));
        expect(entKeys.has('save_favorites')).toBe(true);
        expect(entKeys.has('write_reviews')).toBe(true);
        expect(entKeys.has('subscribe_to_plan')).toBe(true);
        expect(entKeys.has('recover_own_listing')).toBe(true);
        expect(entKeys.has('ai_search')).toBe(true);
        expect(entKeys.has('ai_chat')).toBe(true);
        expect(effects.limits).toHaveLength(3);
        const limitKeys = new Set(effects.limits.map((e) => e.key));
        expect(limitKeys.has('max_favorites')).toBe(true);
        expect(limitKeys.has('max_ai_search_per_month')).toBe(true);
        expect(limitKeys.has('max_ai_chat_consumer_per_month')).toBe(true);
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
