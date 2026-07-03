/**
 * E2E: admin plan attribute edit reflects live without deploy (HOS-39 T-019)
 *
 * SCOPE REVISED (spec-realign 2026-07-02): this validates EXISTING behavior
 * (shipped via SPEC-168/192/211) — the admin edit → public read round trip
 * for `displayName` and `monthlyPriceArs` already works; this suite pins the
 * invariant rather than building new functionality.
 *
 * Validates that:
 *   1. A superadmin can update a plan's `name` (display name) and
 *      `monthlyPriceArs` via `PUT /api/v1/admin/billing/plans/{id}`.
 *   2. The public `GET /api/v1/public/plans` endpoint immediately returns
 *      the new values — no cache, no deploy, no restart involved.
 *
 * Both fields are classified `'commercial'` in `MODEL_C_FIELD_SPLIT`
 * (`packages/billing/src/config/model-c-field-split.ts`) — operator edits
 * via the admin UI are meant to be live immediately, never reverted by a
 * seed re-run or requiring a deploy. This suite is the integration-level
 * proof of that contract for HOS-39 Track B.
 *
 * The `displayName` case also asserts the typed `billing_plans.display_name`
 * column (promoted in HOS-39 T-003, dual-written since T-004) so a future
 * regression in that dual-write is caught here, not just in the plan.crud.ts
 * unit tests.
 *
 * HOS-39 T-019
 *
 * @module test/e2e/flows/billing/plan-attribute-edit-reflected-live
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
                    'mp-stub adapter not initialized — plan-attribute-edit-reflected-live.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { billingPlans, eq, getDb } from '@repo/db';
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

describe('HOS-39 T-019 — admin plan attribute edit reflects live without deploy', () => {
    let app: ReturnType<typeof initApp>;
    let adminClient: E2EApiClient;
    let userClient: E2EApiClient;

    /** UUID of the test plan created in beforeEach */
    let planId: string;
    const ORIGINAL_DISPLAY_NAME = 'HOS-39 T-019 Original Name';
    const NEW_DISPLAY_NAME = 'HOS-39 T-019 Updated Name';
    const ORIGINAL_MONTHLY_PRICE = 150_000; // 1,500 ARS in centavos
    const NEW_MONTHLY_PRICE = 300_000; // 3,000 ARS in centavos

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

        // Isolated test plan so edits do not affect the shared
        // seedBillingTestPlans() rows used by other e2e tests.
        const timestamp = Date.now();
        const plan = await createTestPlan({
            name: `HOS-39 T-019 Plan ${timestamp}`,
            description: 'Temporary plan for admin-edit-reflects-live e2e test',
            active: true,
            entitlements: ['ACCOMMODATION_LIST'],
            limits: { MAX_ACCOMMODATIONS: 1 },
            metadata: {
                slug: `hos39-t019-plan-${timestamp}`,
                category: 'owner',
                isDefault: false,
                sortOrder: 99,
                hasTrial: false,
                trialDays: 0,
                displayName: ORIGINAL_DISPLAY_NAME,
                monthlyPriceArs: ORIGINAL_MONTHLY_PRICE,
                annualPriceArs: null,
                monthlyPriceUsdRef: 1
            }
        });
        planId = plan.planId;

        await createTestPrice({
            planId,
            unitAmount: ORIGINAL_MONTHLY_PRICE,
            billingInterval: 'month',
            intervalCount: 1,
            active: true
        });

        // Superadmin actor with full billing permissions (BILLING_MANAGE
        // required for the PUT /admin/billing/plans/:id endpoint).
        const adminUser = await createTestUser({
            email: `plan-attribute-admin-${timestamp}@example.com`
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

        // Plain user actor — used for the public /plans read.
        const plainUser = await createTestUser({
            email: `plan-attribute-user-${timestamp}@example.com`
        });
        userClient = new E2EApiClient(app, createMockUserActor({ id: plainUser.id }));
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // ─── Tests ────────────────────────────────────────────────────────────────

    it('PUT admin displayName edit reflects immediately in GET /public/plans (no deploy)', async () => {
        // ARRANGE — confirm the original name is what the public endpoint sees.
        // The public route (createSimpleRoute) wraps the array in the standard
        // { success, data, metadata } envelope via createResponse — not a bare array.
        const beforeResponse = await userClient.get('/api/v1/public/plans');
        const beforeBody = (await beforeResponse.json()) as {
            readonly data: ReadonlyArray<{ readonly id: string; readonly name: string }>;
        };
        expect(beforeBody.data.find((p) => p.id === planId)?.name).toBe(ORIGINAL_DISPLAY_NAME);

        // ACT — admin edits the display name (wire field is `name`, mapped to
        // metadata.displayName + the typed displayName column internally).
        const updateResponse = await adminClient.put(`/api/v1/admin/billing/plans/${planId}`, {
            name: NEW_DISPLAY_NAME
        });
        expect(updateResponse.status).toBe(200);
        const updateBody = (await updateResponse.json()) as {
            readonly success: boolean;
            readonly data: { readonly name: string };
        };
        expect(updateBody.success).toBe(true);
        expect(updateBody.data.name).toBe(NEW_DISPLAY_NAME);

        // ASSERT — the public endpoint reads from the DB directly (no separate
        // caching layer in the test environment), so the edit must be visible
        // on the very next request with no deploy/restart in between.
        const afterResponse = await userClient.get('/api/v1/public/plans');
        const afterBody = (await afterResponse.json()) as {
            readonly data: ReadonlyArray<{ readonly id: string; readonly name: string }>;
        };
        const updatedPlan = afterBody.data.find((p) => p.id === planId);
        expect(updatedPlan?.name).toBe(NEW_DISPLAY_NAME);
        expect(updatedPlan?.name).not.toBe(ORIGINAL_DISPLAY_NAME);

        // ASSERT (HOS-39 T-004 regression guard) — the typed billing_plans.display_name
        // column was also dual-written, not just the metadata.displayName mirror.
        const db = getDb();
        const dbRow = await db
            .select({ displayName: billingPlans.displayName })
            .from(billingPlans)
            .where(eq(billingPlans.id, planId));
        expect(dbRow[0]?.displayName).toBe(NEW_DISPLAY_NAME);
    });

    it('PUT admin monthlyPriceArs edit reflects immediately in GET /public/plans (no deploy)', async () => {
        // ARRANGE — confirm the original price is what the public endpoint sees.
        const beforeResponse = await userClient.get('/api/v1/public/plans');
        const beforeBody = (await beforeResponse.json()) as {
            readonly data: ReadonlyArray<{
                readonly id: string;
                readonly monthlyPriceArs: number;
            }>;
        };
        expect(beforeBody.data.find((p) => p.id === planId)?.monthlyPriceArs).toBe(
            ORIGINAL_MONTHLY_PRICE
        );

        // ACT — admin edits the monthly price.
        const updateResponse = await adminClient.put(`/api/v1/admin/billing/plans/${planId}`, {
            monthlyPriceArs: NEW_MONTHLY_PRICE
        });
        expect(updateResponse.status).toBe(200);
        const updateBody = (await updateResponse.json()) as {
            readonly success: boolean;
            readonly data: { readonly monthlyPriceArs: number };
        };
        expect(updateBody.success).toBe(true);
        expect(updateBody.data.monthlyPriceArs).toBe(NEW_MONTHLY_PRICE);

        // ASSERT — visible immediately on the public endpoint, no deploy needed.
        const afterResponse = await userClient.get('/api/v1/public/plans');
        const afterBody = (await afterResponse.json()) as {
            readonly data: ReadonlyArray<{
                readonly id: string;
                readonly monthlyPriceArs: number;
            }>;
        };
        const updatedPlan = afterBody.data.find((p) => p.id === planId);
        expect(updatedPlan?.monthlyPriceArs).toBe(NEW_MONTHLY_PRICE);
        expect(updatedPlan?.monthlyPriceArs).not.toBe(ORIGINAL_MONTHLY_PRICE);
    });
});
