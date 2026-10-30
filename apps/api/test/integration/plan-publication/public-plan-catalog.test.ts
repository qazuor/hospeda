import { billingOptions, eq, getDb, planVersions } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { testDb } from '../../e2e/setup/test-database';
import {
    insertPlan,
    insertVersion,
    restoreProductionPlanCatalog,
    truncatePlanCatalog
} from './plan-publication.helpers.js';

const publicHeaders = { 'User-Agent': 'vitest' };

describe('HOS-1621 public plan catalog (TEST:1621:1)', () => {
    beforeAll(async () => {
        await testDb.setup();
        await truncatePlanCatalog();
    });

    afterAll(async () => {
        await restoreProductionPlanCatalog();
        await testDb.teardown();
    });

    it('TEST:1621:1 (a)(b)(c)(f) returns exactly the current sellable versions and their billing choices publicly', async () => {
        const first = await insertPlan({ vertical: 'accommodation', slug: 'first' });
        const firstVersion = await insertVersion({
            planId: first,
            vertical: 'accommodation',
            rank: 1,
            sellable: true,
            current: true,
            billingCycles: ['annual', 'monthly'],
            entitlements: [{ key: 'view_basic_stats' }],
            limits: [{ key: 'max_photos_per_accommodation', value: 12 }]
        });
        const retired = await insertPlan({ vertical: 'accommodation', slug: 'retired' });
        await insertVersion({
            planId: retired,
            vertical: 'accommodation',
            rank: 2,
            sellable: false,
            current: true
        });
        const previous = await insertPlan({ vertical: 'accommodation', slug: 'previous' });
        await insertVersion({
            planId: previous,
            vertical: 'accommodation',
            rank: 5,
            sellable: true,
            current: false
        });
        const current = await insertVersion({
            planId: previous,
            vertical: 'accommodation',
            rank: 3,
            sellable: true,
            current: true
        });
        const noOptions = await insertPlan({ vertical: 'accommodation', slug: 'no-options' });
        const noOptionsVersion = await insertVersion({
            planId: noOptions,
            vertical: 'accommodation',
            rank: 4,
            sellable: true,
            current: true
        });

        const response = await initApp().request(
            '/api/v1/public/plan-catalog?vertical=accommodation',
            { headers: publicHeaders }
        );
        expect(response.status, await response.clone().text()).toBe(200);
        const body = (await response.json()).data;
        expect(body.plans.map((item: { planVersionId: string }) => item.planVersionId)).toEqual([
            firstVersion,
            current,
            noOptionsVersion
        ]);
        expect(body.plans[0].billingOptions).toEqual([
            expect.objectContaining({ cycle: 'monthly', amount: 1000, currency: 'ARS' }),
            expect.objectContaining({ cycle: 'annual', amount: 1000, currency: 'ARS' })
        ]);
        expect(body.plans[0].entitlements).toEqual(['view_basic_stats']);
        expect(body.plans[0].limits).toEqual({ max_photos_per_accommodation: 12 });
        expect(body.plans[2].billingOptions).toEqual([]);
    });

    it('TEST:1621:1 (d) includes only a current tourist floor outside the sellable plans', async () => {
        const vip = await insertPlan({ vertical: 'tourist', slug: 'vip' });
        const vipVersion = await insertVersion({
            planId: vip,
            vertical: 'tourist',
            rank: 1,
            sellable: true,
            current: true,
            inheritsTouristVip: false
        });
        const floorPlan = await insertPlan({
            vertical: 'tourist',
            slug: 'tourist-free',
            role: 'floor'
        });
        const oldFloorVersion = await insertVersion({
            planId: floorPlan,
            vertical: 'tourist',
            rank: 0,
            sellable: false,
            current: false,
            entitlements: [{ key: 'view_basic_stats' }],
            limits: [{ key: 'max_photos_per_accommodation', value: 5 }]
        });
        const floorVersion = await insertVersion({
            planId: floorPlan,
            vertical: 'tourist',
            rank: 0,
            sellable: false,
            current: true,
            entitlements: [{ key: 'view_advanced_stats' }, { key: 'view_basic_stats' }],
            limits: [{ key: 'max_photos_per_accommodation', value: 7 }],
            billingCycles: ['monthly']
        });
        await getDb().insert(billingOptions).values({
            planVersionId: oldFloorVersion,
            cycle: 'annual',
            amount: 1000,
            currency: 'ARS'
        });

        const app = initApp();
        const response = await app.request('/api/v1/public/plan-catalog?vertical=tourist', {
            headers: publicHeaders
        });
        expect(response.status, await response.clone().text()).toBe(200);
        const body = (await response.json()).data;
        expect(body.plans.map((item: { planVersionId: string }) => item.planVersionId)).toEqual([
            vipVersion
        ]);
        expect(body.plans[0].inheritsTouristVip).toBe(false);
        expect(body.plans[0].billingOptions).toEqual([]);
        expect(body.floor).toEqual(
            expect.objectContaining({
                planVersionId: floorVersion,
                entitlements: ['view_advanced_stats', 'view_basic_stats'],
                limits: { max_photos_per_accommodation: 7 }
            })
        );
        expect(body.floor).not.toHaveProperty('billingOptions');
        expect(body.plans.some((item: { planId: string }) => item.planId === floorPlan)).toBe(
            false
        );

        await getDb()
            .update(planVersions)
            .set({ current: false })
            .where(eq(planVersions.id, floorVersion));
        const noCurrentFloorResponse = await app.request(
            '/api/v1/public/plan-catalog?vertical=tourist',
            { headers: publicHeaders }
        );
        expect(noCurrentFloorResponse.status, await noCurrentFloorResponse.clone().text()).toBe(
            200
        );
        const noCurrentFloor = (await noCurrentFloorResponse.json()).data;
        expect(
            noCurrentFloor.plans.map((item: { planVersionId: string }) => item.planVersionId)
        ).toEqual([vipVersion]);
        expect(noCurrentFloor.floor).toBeNull();
    });

    it('HOS-1967 the trial offer comes from the vertical trial plan and follows its current version', async () => {
        // Arrange: a sellable plan whose OWN trial_days disagrees with the trial plan.
        const app = initApp();
        const sellable = await insertPlan({ vertical: 'venue', slug: 'venue-sellable' });
        await insertVersion({
            planId: sellable,
            vertical: 'venue',
            rank: 1,
            sellable: true,
            current: true,
            trialDays: 99,
            billingCycles: ['monthly']
        });
        const read = async (vertical: string) => {
            const response = await app.request(`/api/v1/public/plan-catalog?vertical=${vertical}`, {
                headers: publicHeaders
            });
            expect(response.status, await response.clone().text()).toBe(200);
            return (await response.json()).data;
        };

        // Act + Assert: no trial plan yet, so nothing is offered.
        expect((await read('venue')).trialOffer).toBeNull();

        const trialPlan = await insertPlan({ vertical: 'venue', slug: 'trial', role: 'trial' });
        const firstTrial = await insertVersion({
            planId: trialPlan,
            vertical: 'venue',
            rank: 0,
            sellable: false,
            current: true,
            trialDays: 21
        });
        expect((await read('venue')).trialOffer).toEqual({ trialDays: 21 });

        // Changing the trial plan's current version changes the offer.
        await getDb()
            .update(planVersions)
            .set({ current: false })
            .where(eq(planVersions.id, firstTrial));
        await insertVersion({
            planId: trialPlan,
            vertical: 'venue',
            rank: 0,
            sellable: false,
            current: true,
            trialDays: 7
        });
        expect((await read('venue')).trialOffer).toEqual({ trialDays: 7 });
    });

    it('HOS-1967 tourist is never offered a trial, even with trial days in its trial plan', async () => {
        const trialPlan = await insertPlan({ vertical: 'tourist', slug: 'trial', role: 'trial' });
        await insertVersion({
            planId: trialPlan,
            vertical: 'tourist',
            rank: 0,
            sellable: false,
            current: true,
            trialDays: 30
        });

        const response = await initApp().request('/api/v1/public/plan-catalog?vertical=tourist', {
            headers: publicHeaders
        });

        expect(response.status, await response.clone().text()).toBe(200);
        expect((await response.json()).data.trialOffer).toBeNull();
    });

    it('TEST:1621:1 (e) rejects invalid and missing verticals by request shape', async () => {
        const app = initApp();
        expect(
            (
                await app.request('/api/v1/public/plan-catalog?vertical=partner', {
                    headers: publicHeaders
                })
            ).status
        ).toBe(400);
        expect(
            (await app.request('/api/v1/public/plan-catalog', { headers: publicHeaders })).status
        ).toBe(400);
    });
});
