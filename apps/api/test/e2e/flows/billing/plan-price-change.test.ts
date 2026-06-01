/**
 * E2E: plan price change → checkout amount reflects the new price (SPEC-168 T-020)
 *
 * Validates the end-to-end invariant that:
 *   1. A superadmin can update a plan's monthlyPriceArs via the admin endpoint.
 *   2. The public /plans endpoint immediately returns the new price (DB is the
 *      single source of truth — no stale cache layer between write and read).
 *   3. The billing_prices row used by the subscription checkout carries the new
 *      unitAmount after the edit (the price the checkout would charge on a new
 *      subscription to that plan).
 *
 * What the MP stub CAN cover:
 * - Verifying that the admin PUT endpoint mutates billing_prices.unitAmount in
 *   the real (test) database.
 * - Verifying that the public GET /plans endpoint reads the mutated value.
 * - Verifying that the billing_prices row referenced by the plan's monthly
 *   price has the correct unitAmount after the write.
 *
 * What the stub CANNOT cover (requires staging + real MP sandbox):
 * - The full checkout session (MP checkout.create) charging the new unit amount.
 * - Cloudflare cache invalidation for the /suscriptores/planes/ web pages.
 * - The MercadoPago preapproval amount propagation after a price edit.
 * - (see: .claude/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md
 *    section "SPEC-168 admin plan management")
 *
 * SPEC-168 T-020
 *
 * @module test/e2e/flows/billing/plan-price-change
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
                    'mp-stub adapter not initialized — plan-price-change.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { billingPlans, billingPrices, eq, getDb } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { createMockAdminActor, createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestPlan, createTestPrice, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

describe('SPEC-168 T-020 — plan price change charges new amount', () => {
    let app: ReturnType<typeof initApp>;
    let adminClient: E2EApiClient;
    let userClient: E2EApiClient;

    /** UUID of the test plan created in beforeEach */
    let planId: string;
    /** UUID of the monthly billing_prices row for the test plan */
    let monthlyPriceId: string;
    /** Original monthly price in centavos */
    const ORIGINAL_MONTHLY_PRICE = 100_000; // 1,000 ARS in centavos
    /** New monthly price in centavos */
    const NEW_MONTHLY_PRICE = 250_000; // 2,500 ARS in centavos

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

        // Create an isolated test plan so edits do not affect the shared
        // seedBillingTestPlans() rows used by other e2e tests.
        const timestamp = Date.now();
        const plan = await createTestPlan({
            name: `SPEC-168 T-020 Plan ${timestamp}`,
            description: 'Temporary plan for price-change e2e test',
            active: true,
            entitlements: ['ACCOMMODATION_LIST'],
            limits: { MAX_ACCOMMODATIONS: 1 },
            metadata: {
                slug: `t020-plan-${timestamp}`,
                category: 'owner',
                isDefault: false,
                sortOrder: 99,
                hasTrial: false,
                trialDays: 0,
                displayName: `T-020 Test Plan ${timestamp}`,
                monthlyPriceArs: ORIGINAL_MONTHLY_PRICE,
                annualPriceArs: null,
                monthlyPriceUsdRef: 1
            }
        });
        planId = plan.planId;

        // Insert the monthly price row
        const price = await createTestPrice({
            planId,
            unitAmount: ORIGINAL_MONTHLY_PRICE,
            billingInterval: 'month',
            intervalCount: 1,
            active: true
        });
        monthlyPriceId = price.priceId;

        // Superadmin actor with full billing permissions (BILLING_MANAGE required
        // for the PUT /admin/billing/plans/:id endpoint).
        const adminUser = await createTestUser({
            email: `plan-price-admin-${timestamp}@example.com`
        });
        const adminActor = createMockAdminActor({
            id: adminUser.id,
            permissions: [
                PermissionEnum.ACCESS_API_PUBLIC,
                PermissionEnum.ACCESS_API_PRIVATE,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.BILLING_READ_ALL,
                PermissionEnum.BILLING_MANAGE
            ]
        });
        adminClient = new E2EApiClient(app, adminActor);

        // Plain user actor — used for the public /plans permission assertion.
        const plainUser = await createTestUser({
            email: `plan-price-user-${timestamp}@example.com`
        });
        userClient = new E2EApiClient(app, createMockUserActor({ id: plainUser.id }));
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // ─── Tests ────────────────────────────────────────────────────────────────

    it('PUT /admin/billing/plans/:id updates billing_prices.unitAmount in DB', async () => {
        // ARRANGE — verify the original price exists in DB before the edit.
        const db = getDb();
        const before = await db
            .select({ unitAmount: billingPrices.unitAmount })
            .from(billingPrices)
            .where(eq(billingPrices.id, monthlyPriceId));

        expect(before[0]?.unitAmount).toBe(ORIGINAL_MONTHLY_PRICE);

        // ACT — admin performs the price update.
        const response = await adminClient.put(`/api/v1/admin/billing/plans/${planId}`, {
            monthlyPriceArs: NEW_MONTHLY_PRICE
        });

        // ASSERT — the HTTP response reports the update succeeded.
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: {
                readonly id: string;
                readonly monthlyPriceArs: number;
            };
        };
        expect(body.success).toBe(true);
        expect(body.data.id).toBe(planId);
        expect(body.data.monthlyPriceArs).toBe(NEW_MONTHLY_PRICE);

        // ASSERT — the billing_prices row in the DB now carries the new unitAmount.
        // This is the exact value the subscription checkout would use when creating
        // a new subscription to this plan (via `monthlyPrice.id` lookup in
        // subscription-checkout.service.ts:380-392).
        const after = await db
            .select({ unitAmount: billingPrices.unitAmount })
            .from(billingPrices)
            .where(eq(billingPrices.id, monthlyPriceId));

        expect(after[0]?.unitAmount).toBe(NEW_MONTHLY_PRICE);
    });

    it('GET /public/plans returns the new monthlyPriceArs after an admin price edit', async () => {
        // ARRANGE — perform the price update through the admin endpoint.
        const updateResponse = await adminClient.put(`/api/v1/admin/billing/plans/${planId}`, {
            monthlyPriceArs: NEW_MONTHLY_PRICE
        });
        expect(updateResponse.status).toBe(200);

        // ACT — read back all active plans from the public endpoint.
        // The public endpoint reads from the DB (no separate caching layer in
        // the test environment), so the update must be immediately visible.
        const listResponse = await userClient.get('/api/v1/public/plans');

        // ASSERT — 200 OK, returns an array.
        expect(listResponse.status).toBe(200);
        const plans = (await listResponse.json()) as ReadonlyArray<{
            readonly id: string;
            readonly monthlyPriceArs: number;
            readonly isActive: boolean;
        }>;
        expect(Array.isArray(plans)).toBe(true);

        // ASSERT — the updated plan appears in the public list with the new price.
        const updatedPlan = plans.find((p) => p.id === planId);
        expect(updatedPlan).toBeDefined();
        expect(updatedPlan?.monthlyPriceArs).toBe(NEW_MONTHLY_PRICE);
        expect(updatedPlan?.isActive).toBe(true);

        // ASSERT — the OLD price is gone from this plan's record.
        expect(updatedPlan?.monthlyPriceArs).not.toBe(ORIGINAL_MONTHLY_PRICE);
    });

    it('display-vs-charge invariant: billing_prices.unitAmount matches public plans monthlyPriceArs after edit', async () => {
        // This test pins the most critical invariant for SPEC-168:
        // "the price displayed to the user equals the price charged at checkout".
        //
        // Both surfaces read from the SAME billing_prices.unitAmount cell
        // (the public list returns it as monthlyPriceArs; the checkout service
        // uses the row via monthlyPrice.id lookup). Any mismatch would mean
        // a user is shown one price and charged another — a billing discrepancy.

        // ARRANGE — perform the price update.
        await adminClient.put(`/api/v1/admin/billing/plans/${planId}`, {
            monthlyPriceArs: NEW_MONTHLY_PRICE
        });

        // ACT — query both surfaces.
        const db = getDb();
        const [dbRows, publicPlans] = await Promise.all([
            db
                .select({ unitAmount: billingPrices.unitAmount })
                .from(billingPrices)
                .where(eq(billingPrices.id, monthlyPriceId)),
            userClient.get('/api/v1/public/plans')
        ]);

        const publicPlansBody = (await publicPlans.json()) as ReadonlyArray<{
            readonly id: string;
            readonly monthlyPriceArs: number;
        }>;
        const publicPlan = publicPlansBody.find((p) => p.id === planId);

        // ASSERT — both surfaces agree on the same price value.
        expect(dbRows[0]?.unitAmount).toBe(NEW_MONTHLY_PRICE);
        expect(publicPlan?.monthlyPriceArs).toBe(NEW_MONTHLY_PRICE);
        expect(dbRows[0]?.unitAmount).toBe(publicPlan?.monthlyPriceArs);
    });

    it('deactivated plan is excluded from public /plans after a soft-delete', async () => {
        // Guards D4: soft-delete keeps the row but marks it inactive.
        // The public endpoint must only return active plans (active: true filter).
        // This is part of the SPEC-168 plan lifecycle — testing it here because
        // the public-plans endpoint is the consumer most affected by plan state changes.

        // ARRANGE — confirm plan is active and visible.
        const beforeResponse = await userClient.get('/api/v1/public/plans');
        const beforePlans = (await beforeResponse.json()) as ReadonlyArray<{
            readonly id: string;
            readonly isActive: boolean;
        }>;
        expect(beforePlans.find((p) => p.id === planId)).toBeDefined();

        // ACT — soft-delete the plan via the admin endpoint (sets active=false).
        const deleteResponse = await adminClient.delete(`/api/v1/admin/billing/plans/${planId}`);
        expect(deleteResponse.status).toBe(204);

        // ASSERT — the plan no longer appears in the public list.
        const afterResponse = await userClient.get('/api/v1/public/plans');
        const afterPlans = (await afterResponse.json()) as ReadonlyArray<{
            readonly id: string;
        }>;
        expect(afterPlans.find((p) => p.id === planId)).toBeUndefined();

        // ASSERT — the DB row still exists (soft-delete, not hard-delete).
        const db = getDb();
        const dbRow = await db
            .select({ id: billingPlans.id, active: billingPlans.active })
            .from(billingPlans)
            .where(eq(billingPlans.id, planId));
        expect(dbRow[0]).toBeDefined();
        expect(dbRow[0]?.active).toBe(false);
    });
});
