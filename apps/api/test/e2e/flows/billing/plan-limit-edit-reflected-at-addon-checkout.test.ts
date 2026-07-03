/**
 * E2E: admin limit-value edit reflects at addon-checkout limit lookup
 * without deploy (HOS-39 T-020)
 *
 * SCOPE REVISED (spec-realign 2026-07-02): this validates EXISTING behavior
 * (shipped via SPEC-168/192/211) — the admin edit → addon-checkout limit
 * resolution round trip already works; this suite pins the invariant
 * rather than building new functionality.
 *
 * Validates that:
 *   1. A superadmin can update a plan's `limits` (a commercial-layer field
 *      per `MODEL_C_FIELD_SPLIT` — DB wins, the seed never reverts it) via
 *      `PUT /api/v1/admin/billing/plans/{id}`.
 *   2. `AddonEntitlementService.applyAddonEntitlements()` — the addon-checkout
 *      limit lookup (SPEC-192 T-025) — resolves the base plan limit via
 *      `PlanService.getById()`, which reads the live `billing_plans.limits`
 *      DB column directly. It must pick up the admin's edit immediately,
 *      not a stale pre-edit value and not the static `@repo/billing` config
 *      (the test plan doesn't even exist in that config).
 *
 * `applyAddonEntitlements` is called directly against a real QZPay billing
 * instance (`getQZPayBilling()`) rather than through the full
 * checkout→webhook flow — the plan-limit resolution this task cares about
 * lives entirely inside that one service call (see
 * `apps/api/test/services/addon-entitlement-plan-bug.test.ts` for the
 * unit-level regression coverage of the same resolution logic against a
 * mocked DB; this file is the missing real-DB integration layer, per this
 * task's own "Test requirements").
 *
 * HOS-39 T-020
 *
 * @module test/e2e/flows/billing/plan-limit-edit-reflected-at-addon-checkout
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
                    'mp-stub adapter not initialized — plan-limit-edit-reflected-at-addon-checkout.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { billingAddonPurchases, billingCustomerLimits, eq, getDb } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { getQZPayBilling, resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { AddonEntitlementService } from '../../../../src/services/addon-entitlement.service.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestAddon,
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestPlan, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

/** Real LimitKey enum value (packages/billing/src/types/plan.types.ts). */
const MAX_ACCOMMODATIONS = 'max_accommodations';

describe('HOS-39 T-020 — admin limit-value edit reflects at addon-checkout limit lookup without deploy', () => {
    let app: ReturnType<typeof initApp>;
    let adminClient: E2EApiClient;

    /** UUID of the isolated test plan created in beforeEach */
    let planId: string;
    /** billing_customers.id for the isolated test customer */
    let customerId: string;
    const ORIGINAL_LIMIT = 1;
    const NEW_LIMIT = 5;
    const ADDON_INCREASE = 2;

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

        const timestamp = Date.now();

        // Isolated test plan so edits do not affect the shared
        // seedBillingTestPlans() rows used by other e2e tests. Only carries
        // the one limit key under test — the admin PUT below is a full
        // replace of `limits`, not a merge (packages/service-core/src/
        // services/billing/plan/plan.crud.ts:599).
        const plan = await createTestPlan({
            name: `HOS-39 T-020 Plan ${timestamp}`,
            description: 'Temporary plan for limit-edit-reflects-at-checkout e2e test',
            active: true,
            entitlements: [],
            limits: { [MAX_ACCOMMODATIONS]: ORIGINAL_LIMIT },
            // BillingPlanResponse.category only accepts 'owner' | 'complex' | 'tourist'
            // (createTestPlan's own default 'test' fails the admin PUT response schema).
            metadata: { category: 'owner' }
        });
        planId = plan.planId;

        const adminUser = await createTestUser({
            email: `plan-limit-admin-${timestamp}@example.com`
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

        const customerUser = await createTestUser({
            email: `plan-limit-customer-${timestamp}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: customerUser.id,
            email: customerUser.email
        });
        customerId = customer.customerId;

        await createTestSubscription({
            customerId,
            planId,
            status: 'active'
        });
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // ─── Tests ────────────────────────────────────────────────────────────────

    it('AddonEntitlementService resolves the freshly-edited plan limit, not the pre-edit value', async () => {
        // ARRANGE — sanity: the plan starts at ORIGINAL_LIMIT.
        const db = getDb();

        // ACT — admin edits the plan's limits live (T-008 mutation).
        const updateResponse = await adminClient.put(`/api/v1/admin/billing/plans/${planId}`, {
            limits: { [MAX_ACCOMMODATIONS]: NEW_LIMIT }
        });
        expect(updateResponse.status).toBe(200);
        const updateBody = (await updateResponse.json()) as {
            readonly success: boolean;
            readonly data: { readonly limits: Record<string, number> };
        };
        expect(updateBody.success).toBe(true);
        expect(updateBody.data.limits[MAX_ACCOMMODATIONS]).toBe(NEW_LIMIT);

        // ARRANGE — a limit-increasing addon. applyAddonEntitlements sums
        // increments from ALL of the customer's *active* billing_addon_purchases
        // rows (plan.crud.ts's "no limit stomping" aggregation) — the caller
        // (real checkout confirmation) is responsible for inserting that row
        // BEFORE calling applyAddonEntitlements, so the test must too.
        const addon = await createTestAddon({
            slug: `t020-limit-addon-${Date.now()}`,
            billingType: 'one_time',
            limits: { [MAX_ACCOMMODATIONS]: ADDON_INCREASE }
        });
        await db.insert(billingAddonPurchases).values({
            customerId,
            addonSlug: addon.slug,
            status: 'active',
            purchasedAt: new Date(),
            expiresAt: null,
            limitAdjustments: [],
            entitlementAdjustments: [],
            metadata: {}
        });

        // ACT — the addon-checkout limit lookup (T-009): resolve the base
        // plan limit via PlanService.getById() and compute the new
        // aggregated limit. This is the exact call the real checkout →
        // webhook confirmation path makes (payment-logic.ts's
        // confirmAddonPurchase → applyAddonEntitlements).
        const billing = getQZPayBilling();
        const service = new AddonEntitlementService(billing);
        const result = await service.applyAddonEntitlements({
            customerId,
            addonSlug: addon.slug,
            purchaseId: randomUUID()
        });
        expect(result.success).toBe(true);

        // ASSERT — the persisted customer limit is NEW_LIMIT + ADDON_INCREASE
        // (5 + 2 = 7), proving `basePlanLimit` was read from the DB row AS
        // EDITED by the admin, not the pre-edit value (1 + 2 = 3 would mean
        // the resolution used a stale value) and not any static config
        // value (this plan does not exist in `@repo/billing`'s ALL_PLANS).
        const limitRows = await db
            .select()
            .from(billingCustomerLimits)
            .where(eq(billingCustomerLimits.customerId, customerId));
        const resolvedLimit = limitRows.find((row) => row.limitKey === MAX_ACCOMMODATIONS);
        expect(resolvedLimit?.maxValue).toBe(NEW_LIMIT + ADDON_INCREASE);
        expect(resolvedLimit?.maxValue).not.toBe(ORIGINAL_LIMIT + ADDON_INCREASE);
    });
});
