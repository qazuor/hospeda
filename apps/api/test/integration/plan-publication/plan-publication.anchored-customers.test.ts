import { billingOptions, getDb, LIVE_SUBSCRIPTION_STATUSES, subscriptions, users } from '@repo/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    insertPlan,
    insertVersion,
    previewBody,
    previewUrl,
    restoreProductionPlanCatalog,
    superAdmin,
    truncatePlanCatalog
} from './plan-publication.helpers.js';

// HOS-1653 covers AC:V2:6: the confirmation says how many customers it reaches.
describe('HOS-1653 anchored customers in action 18 preview', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });
    beforeEach(async () => truncatePlanCatalog());
    afterAll(async () => {
        await restoreProductionPlanCatalog();
        await testDb.teardown();
    });

    async function seedSubscription(input: {
        planVersionId: string;
        billingOptionId: string;
        status: string;
    }): Promise<void> {
        const [user] = await getDb()
            .insert(users)
            .values({
                email: `hos-1653-${crypto.randomUUID()}@example.test`,
                displayName: 'HOS-1653 customer',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            })
            .returning({ id: users.id });
        if (!user) throw new Error('No user');
        await getDb().insert(subscriptions).values({
            userId: user.id,
            vertical: 'accommodation',
            planVersionId: input.planVersionId,
            billingOptionId: input.billingOptionId,
            paymentMethod: 'CARD',
            class: 'PRINCIPAL',
            status: input.status
        });
    }

    async function seedOption(planVersionId: string): Promise<string> {
        const [option] = await getDb()
            .insert(billingOptions)
            .values({ planVersionId, cycle: 'monthly', amount: 1000, currency: 'ARS' })
            .returning({ id: billingOptions.id });
        if (!option) throw new Error('No option');
        return option.id;
    }

    async function preview(planId: string): Promise<{ anchoredCustomers: number }> {
        const response = await initApp().request(previewUrl({ planId }), {
            method: 'POST',
            headers: superAdmin,
            body: previewBody({ overrides: { rank: 20 } })
        });
        expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
        return (await response.json()).data;
    }

    it('HOS-1653 counts three live customers on the prior current version only', async () => {
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'hos-1653-current' });
        const current = await insertVersion({
            planId,
            vertical: 'accommodation',
            rank: 10,
            sellable: true,
            current: true
        });
        const other = await insertVersion({
            planId,
            vertical: 'accommodation',
            rank: 9,
            sellable: true,
            current: false
        });
        const currentOption = await seedOption(current);
        const otherOption = await seedOption(other);
        for (const status of ['ACTIVE', 'PAUSED', 'SUSPENDED']) {
            await seedSubscription({
                planVersionId: current,
                billingOptionId: currentOption,
                status
            });
        }
        for (const status of ['CANCELLED', 'ABANDONED', 'CHARGE_DECLINED']) {
            await seedSubscription({
                planVersionId: current,
                billingOptionId: currentOption,
                status
            });
        }
        await seedSubscription({
            planVersionId: other,
            billingOptionId: otherOption,
            status: 'ACTIVE'
        });
        expect((await preview(planId)).anchoredCustomers).toBe(3);
    });

    it('HOS-1653 counts each of the six live subscription statuses', async () => {
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'hos-1653-six' });
        const current = await insertVersion({
            planId,
            vertical: 'accommodation',
            rank: 10,
            sellable: true,
            current: true
        });
        const option = await seedOption(current);
        for (const status of LIVE_SUBSCRIPTION_STATUSES) {
            await seedSubscription({ planVersionId: current, billingOptionId: option, status });
        }
        expect((await preview(planId)).anchoredCustomers).toBe(6);
    });

    it('HOS-1653 returns zero for a plan without a prior version', async () => {
        const planId = await insertPlan({ vertical: 'accommodation', slug: 'hos-1653-first' });
        expect((await preview(planId)).anchoredCustomers).toBe(0);
    });
});
