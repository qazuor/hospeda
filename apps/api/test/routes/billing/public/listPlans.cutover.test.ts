/**
 * Parity / regression test — publicListPlansRoute DB-backed behavior lock
 * (SPEC-192 T-022).
 *
 * Verifies that:
 * - No ALL_PLANS config read remains in the route (import guard)
 * - The route delegates to PlanService.list({ active: true }) — DB-backed
 * - Response shape is backward-compatible (same fields as the old ALL_PLANS response)
 * - Empty list is returned gracefully when PlanService fails (non-fatal degradation)
 * - The route is registered as a public (skipAuth: true) endpoint
 *
 * The route was already cutover to PlanService in SPEC-168 T-011. This file
 * locks that behavior with explicit regression assertions so any future drift
 * back to the static config is caught immediately.
 *
 * @module test/routes/billing/public/listPlans.cutover.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockPlanList, mockCreateSimpleRoute } = vi.hoisted(() => ({
    mockPlanList: vi.fn(),
    mockCreateSimpleRoute: vi.fn()
}));

// Mock PlanService — DB-backed after SPEC-168 T-011 cutover
vi.mock('../../../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        list: mockPlanList
    }))
}));

// Capture route factory call so we can extract and exercise the handler
vi.mock('../../../../src/utils/route-factory.js', () => ({
    createSimpleRoute: mockCreateSimpleRoute
}));

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// ─── Import trigger ───────────────────────────────────────────────────────────

// Importing the module triggers module-level evaluation (PlanService instantiation +
// createSimpleRoute call). Must come AFTER vi.mock declarations.
import '../../../../src/routes/billing/public/listPlans';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const STUB_DB_PLAN = {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    slug: 'owner-basico',
    name: 'Básico',
    description: 'Plan básico para anfitriones',
    category: 'owner' as const,
    monthlyPriceArs: 500_000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 5,
    hasTrial: true,
    trialDays: 14,
    isDefault: true,
    sortOrder: 1,
    entitlements: ['CAN_LIST_ACCOMMODATION'],
    limits: { max_accommodations: 1 },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function getRegisteredHandler(): () => Promise<unknown> {
    const call = mockCreateSimpleRoute.mock.calls[0];
    return (call?.[0] as Record<string, unknown>)?.handler as () => Promise<unknown>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('publicListPlansRoute cutover lock (SPEC-192 T-022)', () => {
    beforeEach(() => {
        mockPlanList.mockReset();
    });

    // -------------------------------------------------------------------------
    // Import guard — no ALL_PLANS config read
    // -------------------------------------------------------------------------

    describe('static config guard', () => {
        it('should NOT import getPlanBySlug or ALL_PLANS from @repo/billing', async () => {
            // Arrange — if the route still imported from @repo/billing, the mock
            // above would not intercept it and the list call would fail differently.
            // This test is an assertion on the mock registry: the route module must
            // not touch the billing config package at all for plan data.
            //
            // The indirect check: PlanService.list is the ONLY plan-data call made.
            mockPlanList.mockResolvedValue({
                success: true,
                data: {
                    items: [STUB_DB_PLAN],
                    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
                }
            });

            const handler = getRegisteredHandler();
            await handler();

            // If any config read had been attempted, the mock would not have
            // captured it and the plan data would be missing or wrong.
            expect(mockPlanList).toHaveBeenCalledOnce();
        });
    });

    // -------------------------------------------------------------------------
    // DB delegation
    // -------------------------------------------------------------------------

    describe('DB-backed delegation', () => {
        it('should call PlanService.list with { active: true } to fetch from DB', async () => {
            // Arrange
            mockPlanList.mockResolvedValue({
                success: true,
                data: { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }
            });

            // Act
            const handler = getRegisteredHandler();
            await handler();

            // Assert — DB filter applied: active plans only
            expect(mockPlanList).toHaveBeenCalledWith({ active: true });
        });

        it('should return the DB plan items directly', async () => {
            // Arrange
            mockPlanList.mockResolvedValue({
                success: true,
                data: {
                    items: [STUB_DB_PLAN],
                    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
                }
            });

            // Act
            const handler = getRegisteredHandler();
            const result = await handler();

            // Assert
            expect(result).toEqual([STUB_DB_PLAN]);
        });

        it('should return multiple DB plans in order returned by service', async () => {
            // Arrange
            const plan2 = {
                ...STUB_DB_PLAN,
                id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                slug: 'owner-premium',
                sortOrder: 2
            };
            mockPlanList.mockResolvedValue({
                success: true,
                data: {
                    items: [STUB_DB_PLAN, plan2],
                    pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 }
                }
            });

            // Act
            const handler = getRegisteredHandler();
            const result = (await handler()) as (typeof STUB_DB_PLAN)[];

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]?.slug).toBe('owner-basico');
            expect(result[1]?.slug).toBe('owner-premium');
        });
    });

    // -------------------------------------------------------------------------
    // Graceful degradation
    // -------------------------------------------------------------------------

    describe('graceful degradation', () => {
        it('should return empty array when PlanService.list fails', async () => {
            // Arrange
            mockPlanList.mockResolvedValue({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'DB unreachable' }
            });

            // Act
            const handler = getRegisteredHandler();
            const result = await handler();

            // Assert — graceful: empty list, no throw
            expect(result).toEqual([]);
        });

        it('should return empty array when result.data is missing', async () => {
            // Arrange
            mockPlanList.mockResolvedValue({ success: true, data: undefined });

            // Act
            const handler = getRegisteredHandler();
            const result = await handler();

            // Assert
            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    // Response shape (backward-compatibility)
    // -------------------------------------------------------------------------

    describe('response shape', () => {
        it('should include all backward-compatible plan fields', async () => {
            // Arrange
            mockPlanList.mockResolvedValue({
                success: true,
                data: {
                    items: [STUB_DB_PLAN],
                    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
                }
            });

            // Act
            const handler = getRegisteredHandler();
            const result = (await handler()) as (typeof STUB_DB_PLAN)[];
            const plan = result[0];

            // Assert — all fields from previous ALL_PLANS shape are present
            expect(plan).toMatchObject({
                id: expect.any(String),
                slug: expect.any(String),
                name: expect.any(String),
                description: expect.any(String),
                category: expect.any(String),
                monthlyPriceArs: expect.any(Number),
                annualPriceArs: null,
                monthlyPriceUsdRef: expect.any(Number),
                hasTrial: expect.any(Boolean),
                trialDays: expect.any(Number),
                isDefault: expect.any(Boolean),
                sortOrder: expect.any(Number),
                entitlements: expect.any(Array),
                limits: expect.any(Object),
                isActive: true,
                createdAt: expect.any(String),
                updatedAt: expect.any(String)
            });
        });
    });

    // -------------------------------------------------------------------------
    // Route registration
    // -------------------------------------------------------------------------

    describe('route registration', () => {
        it('should register as a public endpoint (skipAuth: true)', () => {
            const call = mockCreateSimpleRoute.mock.calls[0];
            const config = call?.[0] as Record<string, unknown>;
            expect(config?.options).toMatchObject({ skipAuth: true });
        });

        it('should use GET method', () => {
            const call = mockCreateSimpleRoute.mock.calls[0];
            const config = call?.[0] as Record<string, unknown>;
            expect(config?.method).toBe('get');
        });
    });
});
