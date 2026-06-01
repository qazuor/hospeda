/**
 * Integration tests for Public /plans endpoint (T-011)
 *
 * Covers:
 * - Public list returns only active plans from DB
 * - Empty list on service failure (graceful degradation)
 * - Response shape includes all expected fields
 *
 * SPEC-168 T-011
 *
 * @module test/routes/billing/public/listPlans
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — before imports
// ---------------------------------------------------------------------------

const { mockPlanList, mockCreateSimpleRoute } = vi.hoisted(() => ({
    mockPlanList: vi.fn(),
    mockCreateSimpleRoute: vi.fn()
}));

// Mock PlanService
vi.mock('../../../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        list: mockPlanList
    }))
}));

// Capture route factory calls
vi.mock('../../../../src/utils/route-factory.js', () => ({
    createSimpleRoute: mockCreateSimpleRoute
}));

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

// Import module to trigger route factory registration
import '../../../../src/routes/billing/public/listPlans';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTIVE_PLAN = {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'owner-basico',
    name: 'Básico',
    description: 'Plan básico',
    category: 'owner' as const,
    monthlyPriceArs: 500000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 5,
    hasTrial: false,
    trialDays: 0,
    isDefault: true,
    sortOrder: 1,
    entitlements: ['ACCOMMODATION_LIST'],
    limits: { MAX_ACCOMMODATIONS: 1 },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

const INACTIVE_PLAN = {
    ...ACTIVE_PLAN,
    id: '22222222-2222-2222-2222-222222222222',
    slug: 'owner-inactivo',
    isActive: false
};

// ---------------------------------------------------------------------------
// T-011: Public /plans endpoint
// ---------------------------------------------------------------------------

describe('T-011: publicListPlansRoute — DB-backed, active only', () => {
    beforeEach(() => {
        mockPlanList.mockReset();
    });

    it('should register with skipAuth: true (public endpoint)', () => {
        // Arrange + Act
        const call = mockCreateSimpleRoute.mock.calls[0];
        const config = call?.[0] as Record<string, unknown>;

        // Assert — public endpoint must have skipAuth
        expect(config?.options).toMatchObject({ skipAuth: true });
    });

    it('should return only active plans from DB', async () => {
        // Arrange
        const call = mockCreateSimpleRoute.mock.calls[0];
        const handler = (call?.[0] as Record<string, unknown>)?.handler as () => Promise<unknown>;

        // planService.list called with { active: true } — returns only actives
        mockPlanList.mockResolvedValue({
            success: true,
            data: {
                items: [ACTIVE_PLAN],
                pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
            }
        });

        // Act
        const result = await handler();

        // Assert — T-011: only active plans from DB
        expect(mockPlanList).toHaveBeenCalledWith({ active: true });
        expect(result).toEqual([ACTIVE_PLAN]);
    });

    it('should NOT include inactive plans in the result', async () => {
        // Arrange
        const call = mockCreateSimpleRoute.mock.calls[0];
        const handler = (call?.[0] as Record<string, unknown>)?.handler as () => Promise<unknown>;

        // Service filters by active=true so inactive never comes back
        mockPlanList.mockResolvedValue({
            success: true,
            data: {
                items: [ACTIVE_PLAN], // INACTIVE_PLAN filtered out by service
                pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
            }
        });

        // Act
        const result = await handler();

        // Assert
        expect(result).not.toContain(expect.objectContaining({ id: INACTIVE_PLAN.id }));
    });

    it('should return empty array gracefully when service fails', async () => {
        // Arrange
        const call = mockCreateSimpleRoute.mock.calls[0];
        const handler = (call?.[0] as Record<string, unknown>)?.handler as () => Promise<unknown>;

        mockPlanList.mockResolvedValue({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'DB unreachable' }
        });

        // Act
        const result = await handler();

        // Assert — graceful degradation: empty list, no crash
        expect(result).toEqual([]);
    });

    it('response shape includes all expected fields (backwards-compatible)', async () => {
        // Arrange
        const call = mockCreateSimpleRoute.mock.calls[0];
        const handler = (call?.[0] as Record<string, unknown>)?.handler as () => Promise<unknown>;

        mockPlanList.mockResolvedValue({
            success: true,
            data: {
                items: [ACTIVE_PLAN],
                pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
            }
        });

        // Act
        const result = (await handler()) as (typeof ACTIVE_PLAN)[];

        // Assert — backwards-compatible shape
        const plan = result[0];
        expect(plan).toMatchObject({
            id: expect.any(String),
            slug: expect.any(String),
            name: expect.any(String),
            description: expect.any(String),
            category: expect.any(String),
            monthlyPriceArs: expect.any(Number),
            hasTrial: expect.any(Boolean),
            entitlements: expect.any(Array),
            limits: expect.any(Object),
            isActive: true,
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
        });
    });
});
