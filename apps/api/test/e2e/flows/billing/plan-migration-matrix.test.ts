/**
 * Plan migration matrix — cycle changes + combined tier+cycle (SPEC-143 T-143-61).
 *
 * Validates the change-plan endpoint behaviors that go BEYOND the baseline
 * tier upgrade/downgrade flows covered by T-143-11 / T-143-12. Specifically:
 *
 *   - Cycle change within the same tier (monthly ↔ annual same plan).
 *   - Combined tier + cycle change (e.g. cheap monthly → expensive annual).
 *   - The regression guard that same-plan + same-interval still rejects
 *     with 400 (so this file does NOT replace the existing checks in
 *     plan-upgrade.test.ts / plan-downgrade.test.ts — it complements them).
 *
 * Cycle change semantics (pinned by this file):
 *   - Monthly → Annual same tier: routed through the upgrade flow because
 *     the annual unit price is strictly higher than the monthly unit
 *     price. The user pays a prorated delta now and the local sub flips
 *     when the payment.updated webhook lands.
 *   - Annual → Monthly same tier: routed through the downgrade flow and
 *     scheduled to apply at the current_period_end. The user keeps the
 *     prepaid annual access for the rest of the cycle and switches at
 *     renewal — no refund mid-cycle (matches the existing scheduled
 *     downgrade contract from SPEC-141 D7).
 *
 * Matrix cells covered HERE (NEW vs existing coverage):
 *
 *   | From                  | To                    | Path     | Source |
 *   |-----------------------|-----------------------|----------|--------|
 *   | cheap monthly         | cheap monthly         | reject   | THIS   |
 *   | cheap monthly         | cheap annual          | upgrade  | THIS   |
 *   | cheap annual          | cheap monthly         | downgrade| THIS   |
 *   | cheap monthly         | expensive annual      | upgrade  | THIS   |
 *   | expensive annual      | cheap monthly         | downgrade| THIS   |
 *   | cheap monthly         | expensive monthly     | upgrade  | T-143-11 |
 *   | expensive monthly     | cheap monthly         | downgrade| T-143-12 |
 *   | free                  | paid (start-paid)     | new sub  | T-143-09/10 |
 *   | paid                  | free (cancel)         | cancel   | T-143-27 |
 *
 * The "annual → monthly same tier" pricing semantics are NOT exactly the
 * task description's "queued to renewal + cycle realign with refund"
 * because hospeda does NOT refund prepaid annual cycles. The user keeps
 * access until current_period_end then switches to monthly at renewal —
 * documented inline. SPEC-149 may revisit refund semantics if product
 * priorities change.
 *
 * Out of scope:
 *   - Webhook activation of the upgrade leg (covered by plan-upgrade.test.ts
 *     sub-commits 3+ for combined tier upgrades; the cycle-change path
 *     shares the same webhook code).
 *   - apply-scheduled-plan-changes cron execution (covered by
 *     plan-downgrade-cron.test.ts).
 *   - Addon transfer behavior on plan change (covered by
 *     addon-plan-change.service.test.ts).
 *
 * @module test/e2e/flows/billing/plan-migration-matrix
 */

import { vi } from 'vitest';

const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — plan-migration-matrix.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { billingSubscriptions, eq } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { providerResponseFixtures } from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import {
    type TestBillingPlansSeed,
    createTestUser,
    seedBillingTestPlans
} from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

/**
 * Response envelope for an upgrade leg of change-plan. Mirrors
 * `StartPaidSubscriptionResponse` shape pinned by plan-upgrade.test.ts.
 */
interface UpgradeResponseBody {
    readonly success: true;
    readonly data: {
        readonly status: 'pending_payment';
        readonly checkoutUrl: string;
        readonly localSubscriptionId: string;
        readonly expiresAt: string;
        readonly newPlanId: string;
        readonly deltaCentavos: number;
    };
}

/**
 * Response envelope for a downgrade leg (scheduled).
 */
interface DowngradeResponseBody {
    readonly success: true;
    readonly data: {
        readonly status: 'scheduled';
        readonly subscriptionId: string;
        readonly previousPlanId: string;
        readonly newPlanId: string;
        readonly effectiveAt: string;
    };
}

describe('SPEC-143 T-143-61 — plan migration matrix (cycle + combined tier+cycle)', () => {
    let app: ReturnType<typeof initApp>;
    let client: E2EApiClient;
    let seed: TestBillingPlansSeed;
    let customerId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        seed = await seedBillingTestPlans();

        const user = await createTestUser({
            email: `plan-migration-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });
        customerId = customer.customerId;

        const actor = createMockUserActor({ id: user.id });
        client = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    /**
     * Helper: insert an active subscription for the test user. Each test
     * configures the starting interval/plan to exercise a specific cell
     * of the matrix.
     */
    async function seedActiveSub(opts: {
        readonly planId: string;
        readonly billingInterval: 'month' | 'year';
    }): Promise<string> {
        const sub = await createTestSubscription({
            customerId,
            planId: opts.planId,
            status: 'active',
            billingInterval: opts.billingInterval,
            intervalCount: 1,
            metadata: { source: 'test-factory-plan-migration-matrix' }
        });
        return sub.subscriptionId;
    }

    /**
     * Helper: stub the checkout.create call that the upgrade flow makes.
     * Each upgrade test programs its own MP-side checkout id/url so the
     * assertion can pin which call landed.
     */
    function stubUpgradeCheckout(opts: {
        readonly checkoutId: string;
        readonly checkoutUrl: string;
    }): void {
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: opts.checkoutId,
                url: opts.checkoutUrl
            })
        );
    }

    // ---------------------------------------------------------------------
    // Regression guard: same plan + same interval STILL rejects with 400.
    // ---------------------------------------------------------------------

    it('rejects same plan + same interval with 400 (matches existing handler-level check)', async () => {
        await seedActiveSub({ planId: seed.cheap.planId, billingInterval: 'month' });

        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: seed.cheap.planId,
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(400);
        // No side effects: adapter not touched, sub unchanged.
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(0);
    });

    // ---------------------------------------------------------------------
    // Cycle change within same tier — upgrade direction (monthly → annual).
    // ---------------------------------------------------------------------

    it('cheap monthly → cheap annual routes through the upgrade flow with a positive delta', async () => {
        await seedActiveSub({ planId: seed.cheap.planId, billingInterval: 'month' });

        stubUpgradeCheckout({
            checkoutId: 'chk_cycle_upgrade_same_tier',
            checkoutUrl: 'https://stub.example/checkout/cycle-upgrade-same-tier'
        });

        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: seed.cheap.planId,
            billingInterval: 'annual'
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as UpgradeResponseBody;
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('pending_payment');
        expect(body.data.newPlanId).toBe(seed.cheap.planId);
        // Annual is 10x monthly per seed, so the delta is strictly
        // positive — exact value depends on remaining proration.
        expect(body.data.deltaCentavos).toBeGreaterThan(0);
        // Checkout was created exactly once with the correct adapter op.
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(1);
    });

    // ---------------------------------------------------------------------
    // Cycle change within same tier — downgrade direction (annual → monthly).
    // ---------------------------------------------------------------------

    it('cheap annual → cheap monthly routes through the scheduled-downgrade flow', async () => {
        const subscriptionId = await seedActiveSub({
            planId: seed.cheap.planId,
            billingInterval: 'year'
        });

        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: seed.cheap.planId,
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as DowngradeResponseBody;
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('scheduled');
        expect(body.data.subscriptionId).toBe(subscriptionId);
        // The scheduled change preserves the previous plan id and lands
        // a new one. For same-tier cycle change, both ids match.
        expect(body.data.previousPlanId).toBe(seed.cheap.planId);
        expect(body.data.newPlanId).toBe(seed.cheap.planId);
        // Adapter NOT called during downgrade scheduling — the cron will
        // propagate to MP later.
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(0);

        // The sub row is NOT mutated yet — scheduledPlanChange is set,
        // plan_id and interval remain on the current cycle. The
        // apply-scheduled-plan-changes cron handles the commit.
        const row = (
            await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, subscriptionId))
        )[0];
        expect(row?.planId).toBe(seed.cheap.planId);
        expect(row?.billingInterval).toBe('year');
        expect(row?.scheduledPlanChange).not.toBeNull();
    });

    // ---------------------------------------------------------------------
    // Combined tier + cycle change — upgrade direction.
    // ---------------------------------------------------------------------

    it('cheap monthly → expensive annual routes through the upgrade flow with a positive delta', async () => {
        await seedActiveSub({ planId: seed.cheap.planId, billingInterval: 'month' });

        stubUpgradeCheckout({
            checkoutId: `chk_combined_upgrade_${randomUUID()}`,
            checkoutUrl: 'https://stub.example/checkout/combined-upgrade'
        });

        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: seed.expensive.planId,
            billingInterval: 'annual'
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as UpgradeResponseBody;
        expect(body.data.status).toBe('pending_payment');
        expect(body.data.newPlanId).toBe(seed.expensive.planId);
        // The delta should be substantial — moving from cheap monthly
        // ($1,000) to expensive annual ($50,000) is a large upgrade.
        // Pin `> 1_000_000` (10,000 ARS in centavos) as a generous
        // lower bound that absorbs proration jitter without hiding a
        // regression to deltaCentavos ≤ 0.
        expect(body.data.deltaCentavos).toBeGreaterThan(1_000_000);
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(1);
    });

    // ---------------------------------------------------------------------
    // Combined tier + cycle change — downgrade direction.
    // ---------------------------------------------------------------------

    it('expensive annual → cheap monthly routes through the scheduled-downgrade flow', async () => {
        const subscriptionId = await seedActiveSub({
            planId: seed.expensive.planId,
            billingInterval: 'year'
        });

        const response = await client.post('/api/v1/protected/billing/subscriptions/change-plan', {
            newPlanId: seed.cheap.planId,
            billingInterval: 'monthly'
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as DowngradeResponseBody;
        expect(body.data.status).toBe('scheduled');
        expect(body.data.subscriptionId).toBe(subscriptionId);
        expect(body.data.previousPlanId).toBe(seed.expensive.planId);
        expect(body.data.newPlanId).toBe(seed.cheap.planId);
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(0);

        // The sub row is NOT mutated yet — scheduledPlanChange is set,
        // plan_id and interval remain on the current cycle (expensive,
        // annual). The cron will commit the migration at
        // current_period_end.
        const row = (
            await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, subscriptionId))
        )[0];
        expect(row?.planId).toBe(seed.expensive.planId);
        expect(row?.billingInterval).toBe('year');
        expect(row?.scheduledPlanChange).not.toBeNull();
    });
});
