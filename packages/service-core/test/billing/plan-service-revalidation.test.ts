/**
 * Unit tests for PlanService pricing page revalidation (SPEC-168 T-017).
 *
 * Verifies that:
 * - Every successful plan write (create, update, toggleActive, softDelete, hardDelete)
 *   triggers revalidatePaths with the correct pricing page paths.
 * - Read operations (list, getById) do NOT trigger revalidation.
 * - A revalidation failure does NOT propagate as an error from the write method.
 * - When the RevalidationService singleton is not initialized, the write still succeeds
 *   (silent no-op for revalidation).
 *
 * The CRUD layer (plan.crud.ts) and the revalidation init module are both mocked
 * so these tests run without a real database or HTTP connection.
 *
 * @module test/billing/plan-service-revalidation.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the revalidation init so we can control getRevalidationService
// ---------------------------------------------------------------------------

const revalidatePaths = vi.fn().mockResolvedValue([]);
const getRevalidationServiceMock = vi.fn();

vi.mock('../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: () => getRevalidationServiceMock()
}));

// ---------------------------------------------------------------------------
// Mock the CRUD module — every function returns a success result by default.
// Individual tests can override to return a failure.
// ---------------------------------------------------------------------------

vi.mock('../../src/services/billing/plan/plan.crud.js', () => ({
    createPlan: vi.fn(),
    getPlanById: vi.fn(),
    hardDeletePlan: vi.fn(),
    listPlans: vi.fn(),
    restorePlan: vi.fn(),
    softDeletePlan: vi.fn(),
    togglePlanActive: vi.fn(),
    updatePlan: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (after vi.mock calls so hoisting works correctly)
// ---------------------------------------------------------------------------

import { ServiceErrorCode } from '@repo/schemas';
import * as crudModule from '../../src/services/billing/plan/plan.crud.js';
import { PlanService } from '../../src/services/billing/plan/plan.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The 6 pricing page paths expected across all locales */
const EXPECTED_PRICING_PATHS = [
    '/suscriptores/planes/',
    '/suscriptores/turistas/',
    '/en/suscriptores/planes/',
    '/en/suscriptores/turistas/',
    '/pt/suscriptores/planes/',
    '/pt/suscriptores/turistas/'
];

/** Minimal BillingPlanResponse shape used for success stubs */
const STUB_PLAN = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    slug: 'owner-basico',
    name: 'Básico',
    description: 'Plan básico',
    category: 'owner' as const,
    monthlyPriceArs: 1_000_000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 10,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 1,
    entitlements: [],
    limits: {},
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

const successResult = { success: true as const, data: STUB_PLAN };
const failureResult = {
    success: false as const,
    error: { code: ServiceErrorCode.NOT_FOUND, message: 'not found' }
};
const successEmpty = { success: true as const, data: undefined };

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('PlanService — pricing page revalidation (SPEC-168 T-017)', () => {
    let service: PlanService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new PlanService();

        // Default: RevalidationService is initialized and revalidatePaths succeeds
        getRevalidationServiceMock.mockReturnValue({ revalidatePaths });
        revalidatePaths.mockResolvedValue([]);
    });

    // -------------------------------------------------------------------------
    // Pricing paths helper
    // -------------------------------------------------------------------------

    describe('getPricingPaths (indirectly via revalidatePaths call)', () => {
        it('should call revalidatePaths with all 6 pricing page paths for es/en/pt locales', async () => {
            // Arrange
            vi.mocked(crudModule.createPlan).mockResolvedValue(successResult);

            // Act
            await service.create(
                {
                    slug: 'owner-basico',
                    name: 'Básico',
                    description: 'Plan básico',
                    category: 'owner',
                    monthlyPriceArs: 1_000_000,
                    annualPriceArs: null,
                    monthlyPriceUsdRef: 10,
                    hasTrial: false,
                    trialDays: 0,
                    isDefault: false,
                    sortOrder: 1,
                    entitlements: [],
                    limits: {},
                    isActive: true
                },
                {}
            );

            // Let the fire-and-forget promise settle
            await vi.runAllTimersAsync().catch(() => undefined);
            await new Promise((r) => setTimeout(r, 0));

            // Assert
            expect(revalidatePaths).toHaveBeenCalledWith(
                expect.objectContaining({
                    paths: expect.arrayContaining(EXPECTED_PRICING_PATHS),
                    trigger: 'hook',
                    entityType: 'plan'
                })
            );
            const callArg = revalidatePaths.mock.calls[0]?.[0] as { paths: string[] };
            expect(callArg.paths).toHaveLength(EXPECTED_PRICING_PATHS.length);
        });
    });

    // -------------------------------------------------------------------------
    // Write operations — revalidation IS triggered on success
    // -------------------------------------------------------------------------

    describe('create', () => {
        it('should trigger revalidatePaths when create succeeds', async () => {
            // Arrange
            vi.mocked(crudModule.createPlan).mockResolvedValue(successResult);

            // Act
            const result = await service.create(
                {
                    slug: 'new-plan',
                    name: 'New',
                    description: 'desc',
                    category: 'owner',
                    monthlyPriceArs: 500_000,
                    annualPriceArs: null,
                    monthlyPriceUsdRef: 5,
                    hasTrial: false,
                    trialDays: 0,
                    isDefault: false,
                    sortOrder: 2,
                    entitlements: [],
                    limits: {},
                    isActive: true
                },
                {}
            );
            await new Promise((r) => setTimeout(r, 0));

            // Assert
            expect(result.success).toBe(true);
            expect(revalidatePaths).toHaveBeenCalledOnce();
        });

        it('should NOT trigger revalidatePaths when create fails', async () => {
            // Arrange
            vi.mocked(crudModule.createPlan).mockResolvedValue(failureResult);

            // Act
            const result = await service.create(
                {
                    slug: 'dupe-plan',
                    name: 'Dupe',
                    description: 'desc',
                    category: 'owner',
                    monthlyPriceArs: 500_000,
                    annualPriceArs: null,
                    monthlyPriceUsdRef: 5,
                    hasTrial: false,
                    trialDays: 0,
                    isDefault: false,
                    sortOrder: 2,
                    entitlements: [],
                    limits: {},
                    isActive: true
                },
                {}
            );

            // Assert
            expect(result.success).toBe(false);
            expect(revalidatePaths).not.toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('should trigger revalidatePaths when update succeeds', async () => {
            // Arrange
            vi.mocked(crudModule.updatePlan).mockResolvedValue(successResult);

            // Act
            const result = await service.update('plan-uuid', { name: 'Updated Name' }, {});
            await new Promise((r) => setTimeout(r, 0));

            // Assert
            expect(result.success).toBe(true);
            expect(revalidatePaths).toHaveBeenCalledOnce();
        });

        it('should NOT trigger revalidatePaths when update fails', async () => {
            // Arrange
            vi.mocked(crudModule.updatePlan).mockResolvedValue(failureResult);

            // Act
            const result = await service.update('missing-uuid', { name: 'X' }, {});

            // Assert
            expect(result.success).toBe(false);
            expect(revalidatePaths).not.toHaveBeenCalled();
        });
    });

    describe('toggleActive', () => {
        it('should trigger revalidatePaths when toggleActive succeeds', async () => {
            // Arrange
            vi.mocked(crudModule.togglePlanActive).mockResolvedValue(successResult);

            // Act
            const result = await service.toggleActive('plan-uuid', false, {});
            await new Promise((r) => setTimeout(r, 0));

            // Assert
            expect(result.success).toBe(true);
            expect(revalidatePaths).toHaveBeenCalledOnce();
        });

        it('should NOT trigger revalidatePaths when toggleActive fails', async () => {
            // Arrange
            vi.mocked(crudModule.togglePlanActive).mockResolvedValue(failureResult);

            // Act
            const result = await service.toggleActive('missing-uuid', true, {});

            // Assert
            expect(result.success).toBe(false);
            expect(revalidatePaths).not.toHaveBeenCalled();
        });
    });

    describe('softDelete', () => {
        it('should trigger revalidatePaths when softDelete succeeds', async () => {
            // Arrange
            vi.mocked(crudModule.softDeletePlan).mockResolvedValue(successEmpty);

            // Act
            const result = await service.softDelete('plan-uuid', {});
            await new Promise((r) => setTimeout(r, 0));

            // Assert
            expect(result.success).toBe(true);
            expect(revalidatePaths).toHaveBeenCalledOnce();
        });

        it('should NOT trigger revalidatePaths when softDelete fails', async () => {
            // Arrange
            vi.mocked(crudModule.softDeletePlan).mockResolvedValue(failureResult);

            // Act
            const result = await service.softDelete('missing-uuid', {});

            // Assert
            expect(result.success).toBe(false);
            expect(revalidatePaths).not.toHaveBeenCalled();
        });
    });

    describe('restore', () => {
        it('should trigger revalidatePaths when restore succeeds', async () => {
            // Arrange
            vi.mocked(crudModule.restorePlan).mockResolvedValue(successResult);

            // Act
            const result = await service.restore('plan-uuid', {});
            await new Promise((r) => setTimeout(r, 0));

            // Assert
            expect(result.success).toBe(true);
            expect(revalidatePaths).toHaveBeenCalledOnce();
        });

        it('should NOT trigger revalidatePaths when restore fails', async () => {
            // Arrange
            vi.mocked(crudModule.restorePlan).mockResolvedValue(failureResult);

            // Act
            const result = await service.restore('missing-uuid', {});

            // Assert
            expect(result.success).toBe(false);
            expect(revalidatePaths).not.toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('should trigger revalidatePaths when hardDelete succeeds', async () => {
            // Arrange
            vi.mocked(crudModule.hardDeletePlan).mockResolvedValue(successEmpty);

            // Act
            const result = await service.hardDelete('plan-uuid', {});
            await new Promise((r) => setTimeout(r, 0));

            // Assert
            expect(result.success).toBe(true);
            expect(revalidatePaths).toHaveBeenCalledOnce();
        });

        it('should NOT trigger revalidatePaths when hardDelete fails (e.g. referenced by subscription)', async () => {
            // Arrange
            vi.mocked(crudModule.hardDeletePlan).mockResolvedValue(failureResult);

            // Act
            const result = await service.hardDelete('referenced-uuid', {});

            // Assert
            expect(result.success).toBe(false);
            expect(revalidatePaths).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Read operations — revalidation is NOT triggered
    // -------------------------------------------------------------------------

    describe('read operations', () => {
        it('should NOT trigger revalidatePaths on list', async () => {
            // Arrange
            vi.mocked(crudModule.listPlans).mockResolvedValue({
                success: true as const,
                data: {
                    items: [],
                    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
                }
            });

            // Act
            await service.list({});

            // Assert
            expect(revalidatePaths).not.toHaveBeenCalled();
        });

        it('should NOT trigger revalidatePaths on getById', async () => {
            // Arrange
            vi.mocked(crudModule.getPlanById).mockResolvedValue(successResult);

            // Act
            await service.getById('plan-uuid');

            // Assert
            expect(revalidatePaths).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Resilience: revalidation failure does not propagate to the write caller
    // -------------------------------------------------------------------------

    describe('revalidation failure resilience', () => {
        it('should return write success even when revalidatePaths rejects', async () => {
            // Arrange
            vi.mocked(crudModule.updatePlan).mockResolvedValue(successResult);
            revalidatePaths.mockRejectedValue(new Error('Cloudflare unreachable'));

            // Act — should NOT throw
            const result = await service.update('plan-uuid', { name: 'New Name' }, {});
            // Wait for fire-and-forget rejection to settle
            await new Promise((r) => setTimeout(r, 0));

            // Assert — write result is still success
            expect(result.success).toBe(true);
        });

        it('should return write success when RevalidationService is not initialized', async () => {
            // Arrange — singleton not initialized
            getRevalidationServiceMock.mockReturnValue(undefined);
            vi.mocked(crudModule.createPlan).mockResolvedValue(successResult);

            // Act — should NOT throw
            const result = await service.create(
                {
                    slug: 'no-reval-plan',
                    name: 'Test',
                    description: 'desc',
                    category: 'owner',
                    monthlyPriceArs: 0,
                    annualPriceArs: null,
                    monthlyPriceUsdRef: 0,
                    hasTrial: false,
                    trialDays: 0,
                    isDefault: false,
                    sortOrder: 1,
                    entitlements: [],
                    limits: {},
                    isActive: true
                },
                {}
            );

            // Assert — write result is success, no revalidation attempted
            expect(result.success).toBe(true);
            expect(revalidatePaths).not.toHaveBeenCalled();
        });

        it('should return write success when getRevalidationService itself throws', async () => {
            // Arrange — accessor throws (misconfiguration edge case)
            getRevalidationServiceMock.mockImplementation(() => {
                throw new Error('Singleton access error');
            });
            vi.mocked(crudModule.updatePlan).mockResolvedValue(successResult);

            // Act — should NOT throw
            const result = await service.update('plan-uuid', { name: 'Safe' }, {});

            // Assert
            expect(result.success).toBe(true);
        });
    });
});
