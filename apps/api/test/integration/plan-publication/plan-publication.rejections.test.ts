import { billingOptions, getDb } from '@repo/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    insertPlan,
    insertVersion,
    publishBody,
    publishUrl,
    readVersionEffects,
    superAdmin,
    truncatePlanCatalog
} from './plan-publication.helpers.js';

/**
 * TEST:V2:10 (integration with DB) — each of the eight causes of AC:V2:7 makes
 * the publication fail with its own message; a valid version publishes
 * (HOS-1436, piece V2.3, AC:V2:7). Also covers the trial plan's derived effects.
 */
describe('HOS-1436 V2.3 — action 18 (rejections, TEST:V2:10)', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });

    beforeEach(async () => truncatePlanCatalog());

    afterAll(async () => testDb.teardown());

    it('TEST:V2:10 (a) a non-sellable version that grants a commercial key is rejected: clave de más', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: 'pre-trial',
            role: 'pre_trial'
        });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                overrides: { sellable: false, entitlements: [{ key: 'view_basic_stats' }] }
            })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe('clave de más');
    });

    it('TEST:V2:10 (a) a non-sellable version that grants a metered entitlement is rejected: clave de más', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: 'pre-trial',
            role: 'pre_trial'
        });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                overrides: {
                    sellable: false,
                    entitlements: [{ key: 'subscribe_to_plan', planQuota: 5, trialQuota: 5 }]
                }
            })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe('clave de más');
    });

    it('TEST:V2:10 a trial plan publishes a valid version without stored effects', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: 'trial',
            role: 'trial'
        });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ overrides: { sellable: false, trialDays: 7 } })
        });
        expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
        const published = (await response.json()).data;
        expect(published).toMatchObject({ planId, sellable: false, current: true });
        // The trial plan's entitlements and limits are derived, never stored.
        const effects = await readVersionEffects({ versionId: published.id });
        expect(effects.entitlements).toEqual([]);
        expect(effects.limits).toEqual([]);
    });

    it('TEST:V2:10 a trial plan that declares explicit effects is rejected with its own message', async () => {
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
                    entitlements: [{ key: 'view_basic_stats' }]
                }
            })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(
            'los limits y entitlements del plan de trial no se guardan: se derivan'
        );
    });

    it('TEST:V2:10 (b) a floor version missing a floor key is rejected: clave de piso que falta', async () => {
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
                    entitlements: [{ key: 'subscribe_to_plan' }]
                }
            })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe('clave de piso que falta');
    });

    it('TEST:V2:10 (c) granting activation when it does not correspond is rejected', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: 'pre-trial',
            role: 'pre_trial'
        });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                overrides: {
                    sellable: false,
                    entitlements: [{ key: 'activate_trial' }]
                }
            })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe('activación fuera del si y sólo si');
    });

    it('TEST:V2:10 (c) withholding activation when it does correspond is rejected', async () => {
        const app = initApp();
        // 'accommodation' declares the activation event (migration 0129); a trial
        // plan with trial days > 0 makes the right side of the biconditional true.
        const trialPlanId = await insertPlan({
            vertical: 'accommodation',
            slug: 'trial',
            role: 'trial'
        });
        await insertVersion({
            planId: trialPlanId,
            vertical: 'accommodation',
            rank: 5,
            sellable: false,
            current: true,
            trialDays: 7
        });
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: 'pre-trial',
            role: 'pre_trial'
        });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                overrides: {
                    sellable: false,
                    entitlements: [{ key: 'subscribe_to_plan' }]
                }
            })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe('activación fuera del si y sólo si');
    });

    it('TEST:V2:10 (d) a trial version that inherits Turista VIP is rejected', async () => {
        const app = initApp();
        const planId = await insertPlan({ vertical: 'tourist', slug: 'trial', role: 'trial' });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                overrides: { sellable: false, trialDays: 7, inheritsTouristVip: true }
            })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(
            'herencia de VIP fuera de una versión vendible'
        );
    });

    it('TEST:V2:10 (e) a repeated rank among the sellable current versions is rejected', async () => {
        const app = initApp();
        const other = await insertPlan({ vertical: 'gastronomy', slug: 'basic' });
        await insertVersion({
            planId: other,
            vertical: 'gastronomy',
            rank: 20,
            sellable: true,
            current: true
        });
        const planId = await insertPlan({ vertical: 'gastronomy', slug: 'pro' });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ overrides: { rank: 20 } })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(
            'rank repetido entre las versiones vendibles y vigentes de la vertical'
        );
    });

    it('TEST:V2:10 (f) leaving a plan without exactly one current version is rejected', async () => {
        const app = initApp();
        await insertPlan({ vertical: 'experience', slug: 'orphan' });
        const planId = await insertPlan({ vertical: 'experience', slug: 'pro' });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ overrides: {} })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(
            'el plan no queda con exactamente una versión vigente'
        );
    });

    it('TEST:V2:10 (g) passing trial days from 0 to more is rejected', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: 'trial',
            role: 'trial'
        });
        await insertVersion({
            planId,
            vertical: 'accommodation',
            rank: 10,
            sellable: false,
            current: true,
            trialDays: 0
        });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ overrides: { sellable: false, trialDays: 7 } })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(
            'los días de prueba de la vertical no pueden pasar de cero a más, ni al revés'
        );
    });

    it('TEST:V2:10 (g) passing trial days from more to 0 is rejected', async () => {
        const app = initApp();
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: 'trial',
            role: 'trial'
        });
        await insertVersion({
            planId,
            vertical: 'accommodation',
            rank: 10,
            sellable: false,
            current: true,
            trialDays: 7
        });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ overrides: { sellable: false, trialDays: 0 } })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(
            'los días de prueba de la vertical no pueden pasar de cero a más, ni al revés'
        );
    });

    it('TEST:V2:10 (h) a grace not shorter than the shortest cycle of the request is rejected', async () => {
        const app = initApp();
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'basic' });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ overrides: { graceDays: 28, cycles: ['monthly'] } })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(
            'la gracia debe ser menor que el ciclo más corto que la versión ofrece'
        );
    });

    it('TEST:V2:10 (h) a grace not shorter than the previous version billing option is rejected without request cycles', async () => {
        const app = initApp();
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'basic' });
        const previousVersionId = await insertVersion({
            planId,
            vertical: 'accommodation',
            rank: 10,
            sellable: true,
            current: true
        });
        await getDb().insert(billingOptions).values({
            planVersionId: previousVersionId,
            cycle: 'monthly',
            amount: 1000,
            currency: 'ARS'
        });

        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({ overrides: { graceDays: 28 } })
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error.message).toBe(
            'la gracia debe ser menor que el ciclo más corto que la versión ofrece'
        );
    });

    it('TEST:V2:10 a valid version is published', async () => {
        const app = initApp();
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'basic' });
        const response = await app.request(publishUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: publishBody({
                overrides: {
                    cycles: ['annual'],
                    entitlements: [{ key: 'view_basic_stats' }],
                    limits: [{ key: 'max_photos_per_accommodation', value: 20 }]
                }
            })
        });
        expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
        const published = (await response.json()).data;
        expect(published).toMatchObject({ planId, current: true, sellable: true });
    });
});
