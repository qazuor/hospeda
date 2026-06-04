/**
 * Unit tests for PlanService.getBySlug (SPEC-192 T-020).
 *
 * Verifies that:
 * - `getBySlug` resolves a known slug to a BillingPlanResponse
 * - `getBySlug` returns NOT_FOUND for an unknown slug
 * - The underlying `getPlanBySlug` CRUD function is delegated to (no revalidation triggered)
 *
 * The CRUD module is mocked so these tests run without a real database.
 *
 * @module test/billing/plan-service.get-by-slug.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the revalidation init (PlanService imports it)
// ---------------------------------------------------------------------------

vi.mock('../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: () => undefined
}));

// ---------------------------------------------------------------------------
// Mock the CRUD module — getBySlug is the only function under test here
// ---------------------------------------------------------------------------

vi.mock('../../src/services/billing/plan/plan.crud.js', () => ({
    createPlan: vi.fn(),
    getPlanById: vi.fn(),
    getPlanBySlug: vi.fn(),
    hardDeletePlan: vi.fn(),
    listPlans: vi.fn(),
    restorePlan: vi.fn(),
    softDeletePlan: vi.fn(),
    togglePlanActive: vi.fn(),
    updatePlan: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (after vi.mock hoisting)
// ---------------------------------------------------------------------------

import { ServiceErrorCode } from '@repo/schemas';
import * as crudModule from '../../src/services/billing/plan/plan.crud.js';
import { PlanService } from '../../src/services/billing/plan/plan.service.js';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

/** Minimal BillingPlanResponse stub for owner-basico */
const STUB_OWNER_BASICO = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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

const successResult = { success: true as const, data: STUB_OWNER_BASICO };
const notFoundResult = {
    success: false as const,
    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Plan not found: unknown-slug' }
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlanService.getBySlug (SPEC-192 T-020)', () => {
    let service: PlanService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new PlanService();
    });

    describe('when the slug resolves to a known plan', () => {
        it('should return success with BillingPlanResponse', async () => {
            // Arrange
            vi.mocked(crudModule.getPlanBySlug).mockResolvedValue(successResult);

            // Act
            const result = await service.getBySlug('owner-basico');

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.slug).toBe('owner-basico');
                expect(result.data.category).toBe('owner');
                expect(result.data.entitlements).toContain('CAN_LIST_ACCOMMODATION');
                expect(result.data.limits).toEqual({ max_accommodations: 1 });
            }
        });

        it('should delegate to getPlanBySlug CRUD function with the correct slug', async () => {
            // Arrange
            vi.mocked(crudModule.getPlanBySlug).mockResolvedValue(successResult);

            // Act
            await service.getBySlug('owner-basico');

            // Assert
            expect(crudModule.getPlanBySlug).toHaveBeenCalledOnce();
            expect(crudModule.getPlanBySlug).toHaveBeenCalledWith('owner-basico', undefined);
        });

        it('should NOT trigger pricing revalidation (read operation)', async () => {
            // Arrange
            vi.mocked(crudModule.getPlanBySlug).mockResolvedValue(successResult);

            // Act
            await service.getBySlug('owner-basico');

            // Assert — no write side-effects expected
            expect(crudModule.createPlan).not.toHaveBeenCalled();
            expect(crudModule.updatePlan).not.toHaveBeenCalled();
        });
    });

    describe('when the slug is unknown', () => {
        it('should return NOT_FOUND for an unrecognised slug', async () => {
            // Arrange
            vi.mocked(crudModule.getPlanBySlug).mockResolvedValue(notFoundResult);

            // Act
            const result = await service.getBySlug('unknown-slug');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        });

        it('should propagate the error message from the CRUD layer', async () => {
            // Arrange
            vi.mocked(crudModule.getPlanBySlug).mockResolvedValue(notFoundResult);

            // Act
            const result = await service.getBySlug('unknown-slug');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.message).toContain('unknown-slug');
            }
        });
    });

    describe('query context forwarding', () => {
        it('should forward an optional QueryContext to the CRUD function', async () => {
            // Arrange
            vi.mocked(crudModule.getPlanBySlug).mockResolvedValue(successResult);
            const fakeCtx = { tx: {} as never };

            // Act
            await service.getBySlug('owner-basico', fakeCtx);

            // Assert
            expect(crudModule.getPlanBySlug).toHaveBeenCalledWith('owner-basico', fakeCtx);
        });
    });
});
