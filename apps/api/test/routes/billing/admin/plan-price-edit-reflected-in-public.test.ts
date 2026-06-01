/**
 * T-019: Integration test — admin price edit is reflected in /public/plans
 *
 * Guards the display-vs-charge invariant at the API boundary:
 * after a successful PUT to the admin plans endpoint updating monthlyPriceArs,
 * a subsequent GET to /api/v1/public/plans must return the new price.
 *
 * Strategy: mock PlanService methods — simulate an update that changes the
 * monthly price, then verify the public handler reads the updated value.
 * This test lives at the route/service level (no real DB), matching the
 * pattern of the sibling tests in this directory.
 *
 * SPEC-168 T-019
 *
 * @module test/routes/billing/admin/plan-price-edit-reflected-in-public
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — before imports
// ---------------------------------------------------------------------------

const {
    mockAdminPlanList,
    mockAdminPlanUpdate,
    mockPublicPlanList,
    mockCreateAdminRoute,
    mockCreateAdminListRoute,
    mockCreateSimpleRoute
} = vi.hoisted(() => ({
    mockAdminPlanList: vi.fn(),
    mockAdminPlanUpdate: vi.fn(),
    mockPublicPlanList: vi.fn(),
    mockCreateAdminRoute: vi.fn(),
    mockCreateAdminListRoute: vi.fn(),
    mockCreateSimpleRoute: vi.fn()
}));

// Mock PlanService — shared across admin and public routes.
// Both modules import from the same path so a single mock covers both.
vi.mock('../../../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        list: mockAdminPlanList,
        update: mockAdminPlanUpdate
    }))
}));

// Capture admin route factory calls (admin/plans.ts).
// admin/plans.ts uses both createAdminRoute and createAdminListRoute from this
// module (without the .js extension). The mock must export both so the module
// can initialize without throwing "export is not defined".
vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: mockCreateAdminRoute,
    createAdminListRoute: mockCreateAdminListRoute
}));

// Capture public route factory calls (public/listPlans.ts).
// Also expose createAdminRoute and createAdminListRoute here because Vitest
// resolves both `route-factory` and `route-factory.js` imports to the same
// mock module entry when the `.js` extension is present. Without them the
// admin/plans.ts module-load crashes with "export is not defined".
vi.mock('../../../../src/utils/route-factory.js', () => ({
    createSimpleRoute: mockCreateSimpleRoute,
    createAdminRoute: mockCreateAdminRoute,
    createAdminListRoute: mockCreateAdminListRoute
}));

// Mock @repo/schemas — preserve actual schemas, inject PermissionEnum values
vi.mock('@repo/schemas', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/schemas')>();
    return {
        ...actual,
        PermissionEnum: {
            BILLING_READ_ALL: 'billing:read_all',
            BILLING_MANAGE: 'billing:manage'
        }
    };
});

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// Mock audit logger
vi.mock('../../../../src/utils/audit-logger', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/audit-logger')>();
    return { ...actual, auditLog: vi.fn() };
});

// Mock create-app router
vi.mock('../../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({ route: vi.fn() }))
}));

// Mock actor
vi.mock('../../../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn().mockReturnValue({
        id: 'actor-00000000-0000-0000-0000-000000000001',
        role: 'SUPER_ADMIN',
        permissions: ['billing:read_all', 'billing:manage']
    })
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

// Import admin plans module — triggers createAdminRoute calls at module load
import '../../../../src/routes/billing/admin/plans';

// Import public plans module — triggers createSimpleRoute call at module load
import '../../../../src/routes/billing/public/listPlans';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORIGINAL_PLAN = {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'owner-basico',
    name: 'Básico',
    description: 'Plan básico para propietarios',
    category: 'owner' as const,
    monthlyPriceArs: 500000,
    annualPriceArs: 5000000,
    monthlyPriceUsdRef: 5,
    hasTrial: false,
    trialDays: 0,
    isDefault: true,
    sortOrder: 1,
    entitlements: ['ACCOMMODATION_LIST'],
    limits: { MAX_ACCOMMODATIONS: 1 },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z'
};

const NEW_MONTHLY_PRICE = 750000;

const UPDATED_PLAN = {
    ...ORIGINAL_PLAN,
    monthlyPriceArs: NEW_MONTHLY_PRICE,
    updatedAt: '2026-05-30T12:00:00.000Z'
};

/**
 * Finds a route factory call by method + path.
 */
function findAdminRouteCall(method: string, path: string): Record<string, unknown> | undefined {
    const call = mockCreateAdminRoute.mock.calls.find(
        (args: unknown[]) =>
            (args[0] as Record<string, unknown>)?.method === method &&
            (args[0] as Record<string, unknown>)?.path === path
    );
    return call ? (call[0] as Record<string, unknown>) : undefined;
}

const createMockContext = () => ({
    json: vi.fn((body: unknown, status?: number) => ({ body, status: status ?? 200 })),
    body: vi.fn((_body: unknown, status?: number) => ({ body: null, status: status ?? 204 }))
});

// ---------------------------------------------------------------------------
// T-019: Price edit reflected in public endpoint
// ---------------------------------------------------------------------------

describe('T-019: admin price edit is reflected in GET /public/plans', () => {
    beforeEach(() => {
        mockAdminPlanUpdate.mockReset();
        mockAdminPlanList.mockReset();
        mockPublicPlanList.mockReset();
    });

    it('PUT price update (admin) → GET /public/plans returns the new monthlyPriceArs', async () => {
        // ─── Arrange ──────────────────────────────────────────────────────────

        // Step 1: admin performs a price update via the PUT /:id handler
        const adminUpdateConfig = findAdminRouteCall('put', '/{id}');
        expect(adminUpdateConfig).toBeDefined();

        const adminUpdateHandler = adminUpdateConfig?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        // Service returns the plan with the new price after the update
        mockAdminPlanUpdate.mockResolvedValue({ success: true, data: UPDATED_PLAN });

        // ─── Act (write) ───────────────────────────────────────────────────────

        const updateResult = await adminUpdateHandler(
            createMockContext(),
            { id: ORIGINAL_PLAN.id },
            { monthlyPriceArs: NEW_MONTHLY_PRICE }
        );

        // Assert the admin route returned the updated plan with the new price
        expect(updateResult).toEqual(
            expect.objectContaining({
                id: ORIGINAL_PLAN.id,
                monthlyPriceArs: NEW_MONTHLY_PRICE
            })
        );
        expect(mockAdminPlanUpdate).toHaveBeenCalledWith(
            ORIGINAL_PLAN.id,
            { monthlyPriceArs: NEW_MONTHLY_PRICE },
            expect.objectContaining({ actorId: 'actor-00000000-0000-0000-0000-000000000001' })
        );

        // ─── Arrange (read) ────────────────────────────────────────────────────

        // Step 2: the public list endpoint now returns the updated plan (service
        // reads from DB which already has the new price after the write above)
        const publicRouteCall = mockCreateSimpleRoute.mock.calls[0];
        const publicHandler = (publicRouteCall?.[0] as Record<string, unknown>)
            ?.handler as () => Promise<unknown>;

        mockAdminPlanList.mockResolvedValue({
            success: true,
            data: {
                items: [UPDATED_PLAN],
                pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
            }
        });

        // ─── Act (read) ────────────────────────────────────────────────────────

        const publicResult = (await publicHandler()) as (typeof UPDATED_PLAN)[];

        // ─── Assert ────────────────────────────────────────────────────────────

        // The public endpoint must expose the NEW price — not the original one
        expect(publicResult).toHaveLength(1);
        const plan = publicResult[0];
        expect(plan?.monthlyPriceArs).toBe(NEW_MONTHLY_PRICE);
        expect(plan?.monthlyPriceArs).not.toBe(ORIGINAL_PLAN.monthlyPriceArs);

        // Verify the plan id is consistent between admin write and public read
        expect(plan?.id).toBe(ORIGINAL_PLAN.id);
        expect(plan?.slug).toBe(ORIGINAL_PLAN.slug);
    });

    it('display-vs-charge invariant: public response monthlyPriceArs equals the value persisted by the admin update', async () => {
        // ─── Arrange ──────────────────────────────────────────────────────────
        // This test pins the invariant as a regression guard: the value written
        // through the admin route must match the value served by the public
        // route. Any mismatch (e.g. public reads from a stale cache layer that
        // bypasses the DB write) would cause users to be charged a different
        // amount from what they were shown.

        const adminUpdateConfig = findAdminRouteCall('put', '/{id}');
        const adminUpdateHandler = adminUpdateConfig?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        const newPrice = 1_200_000; // 12,000 ARS in centavos
        const planAfterUpdate = { ...ORIGINAL_PLAN, monthlyPriceArs: newPrice };

        mockAdminPlanUpdate.mockResolvedValue({ success: true, data: planAfterUpdate });

        // ─── Act (write) ───────────────────────────────────────────────────────
        const adminResult = (await adminUpdateHandler(
            createMockContext(),
            { id: ORIGINAL_PLAN.id },
            { monthlyPriceArs: newPrice }
        )) as typeof ORIGINAL_PLAN;

        // Capture the exact price the admin write confirmed
        const confirmedPrice = adminResult.monthlyPriceArs;

        // ─── Arrange (read) ────────────────────────────────────────────────────
        const publicRouteCall = mockCreateSimpleRoute.mock.calls[0];
        const publicHandler = (publicRouteCall?.[0] as Record<string, unknown>)
            ?.handler as () => Promise<unknown>;

        // Public service returns the same post-update plan (DB is the single
        // source of truth; both read from the same billing_plans/billing_prices rows)
        mockAdminPlanList.mockResolvedValue({
            success: true,
            data: {
                items: [planAfterUpdate],
                pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
            }
        });

        // ─── Act (read) ────────────────────────────────────────────────────────
        const publicResult = (await publicHandler()) as (typeof ORIGINAL_PLAN)[];

        // ─── Assert ────────────────────────────────────────────────────────────
        // The public-facing price must exactly match what the admin write confirmed
        expect(publicResult[0]?.monthlyPriceArs).toBe(confirmedPrice);
    });

    it('public endpoint returns empty array gracefully when service fails after a price edit', async () => {
        // ─── Arrange ──────────────────────────────────────────────────────────
        // Guards the public endpoint's graceful-degradation contract: even if the
        // DB becomes momentarily unavailable after a write, the public route must
        // return [] rather than crashing with a 500.

        const publicRouteCall = mockCreateSimpleRoute.mock.calls[0];
        const publicHandler = (publicRouteCall?.[0] as Record<string, unknown>)
            ?.handler as () => Promise<unknown>;

        mockAdminPlanList.mockResolvedValue({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'DB unreachable' }
        });

        // ─── Act ───────────────────────────────────────────────────────────────
        const result = await publicHandler();

        // ─── Assert ────────────────────────────────────────────────────────────
        expect(result).toEqual([]);
    });
});
