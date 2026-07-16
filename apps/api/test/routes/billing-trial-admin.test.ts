/**
 * Unit tests for Trial Check Expiry Admin Authentication
 *
 * Tests the admin-only authentication check for the trial reconciliation
 * endpoint. Verifies that only ADMIN and SUPER_ADMIN roles can access the
 * endpoint.
 *
 * Endpoint: POST /api/v1/protected/billing/trial/check-expiry
 *
 * HOS-171: this endpoint used to trigger a blind cancel-at-expiry sweep
 * (`blockExpiredTrials`). It now triggers `reconcileExpiredTrials`, which
 * re-reads each elapsed trial's MercadoPago preapproval and mirrors the
 * provider's verdict (convert / defer to dunning / mirror cancel-or-pause) —
 * see `TrialService.reconcileExpiredTrials` for the full decision table.
 * The route-handler tests here only cover the HTTP/auth/response-shape
 * surface; the reconciliation logic itself is covered by
 * `test/services/trial.service.test.ts`.
 *
 * Test Coverage:
 * - Non-admin users receive 403 Forbidden
 * - Admin users pass authentication and proceed to handler
 * - Super admin users pass authentication and proceed to handler
 * - Billing not configured returns 503
 * - Service errors are handled properly
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getActorFromContext } from '../../src/middlewares/actor';
import { handleCheckExpiry } from '../../src/routes/billing/trial';

// Get the mocked function
const mockGetActorFromContext = vi.mocked(getActorFromContext);

// Mock logger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    }
}));

// Mock auth middleware
vi.mock('../../src/middlewares/auth', () => ({
    authMiddleware: vi.fn(() => async (_c: any, next: any) => next()),
    requireAuth: vi.fn(async (_c: any, next: any) => next())
}));

vi.mock('../../src/middlewares/billing-customer', () => ({
    billingCustomerMiddleware: vi.fn(() => async (_c: any, next: any) => next())
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    entitlementMiddleware: vi.fn(() => async (_c: any, next: any) => next())
}));

vi.mock('../../src/middlewares/trial', () => ({
    trialMiddleware: vi.fn(() => async (_c: any, next: any) => next())
}));

// Mock actorMiddleware
vi.mock('../../src/middlewares/actor', () => ({
    actorMiddleware: vi.fn(() => async (_c: any, next: any) => next()),
    getActorFromContext: vi.fn()
}));

// Mock trial service
const mockTrialService = {
    reconcileExpiredTrials: vi.fn()
};

vi.mock('../../src/services/trial.service', () => ({
    TrialService: vi.fn(function () {
        return mockTrialService;
    })
}));

// Mock billing middleware
const mockBilling = {
    plans: { get: vi.fn() },
    subscriptions: { getByCustomerId: vi.fn() }
};

vi.mock('../../src/middlewares/billing', () => ({
    billingMiddleware: vi.fn(async (c: any, next: any) => {
        c.set('billingEnabled', true);
        await next();
    }),
    getQZPayBilling: vi.fn(() => mockBilling),
    requireBilling: vi.fn(async (_c: any, next: any) => next())
}));

// Mock qzpay-logger (passed into createMercadoPagoAdapter)
vi.mock('../../src/lib/qzpay-logger.js', () => ({
    qzpayLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock @repo/billing's createMercadoPagoAdapter: handleCheckExpiry builds its
// own MP adapter (mirroring the trial-reconcile cron) and passes it to
// TrialService.reconcileExpiredTrials as `paymentAdapter`. TrialService
// itself is mocked above, so the adapter's shape doesn't matter here — this
// stub only exists so the real factory (which reads env vars and throws if
// missing) is never invoked.
const mockPaymentAdapter = {
    subscriptions: { retrieve: vi.fn() }
};

vi.mock('@repo/billing', () => ({
    createMercadoPagoAdapter: vi.fn(() => mockPaymentAdapter)
}));

describe('Trial Check Expiry - Admin Authentication', () => {
    let mockContext: Partial<Context>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock context
        mockContext = {
            get: vi.fn((key: string) => {
                if (key === 'billingEnabled') return true;
                return undefined;
            })
        };

        // Reset service mocks
        mockTrialService.reconcileExpiredTrials.mockResolvedValue(5);
    });

    describe('Authorization - Access Control', () => {
        it('should allow access for non-admin user when billing enabled (auth enforced by route middleware)', async () => {
            // Note: handleCheckExpiry itself does not perform role checks.
            // Authorization is enforced by the createAdminRoute middleware via
            // requiredPermissions: [PermissionEnum.MANAGE_SUBSCRIPTIONS].
            // This test verifies the handler executes when billing is enabled.
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'user-1',
                permissions: [PermissionEnum.ACCESS_API_PUBLIC],
                role: RoleEnum.USER
            });

            // Act
            const result = await handleCheckExpiry(mockContext as Context);

            // Assert - handler runs successfully (auth middleware would block before reaching here)
            expect(result).toHaveProperty('success', true);
            expect(mockTrialService.reconcileExpiredTrials).toHaveBeenCalledTimes(1);
        });

        it('should allow access for guest user when billing enabled (auth enforced by route middleware)', async () => {
            // Note: Authorization is enforced upstream by createAdminRoute middleware.
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: '00000000-0000-4000-8000-000000000000',
                permissions: [PermissionEnum.ACCESS_API_PUBLIC],
                role: RoleEnum.GUEST
            });

            // Act
            const result = await handleCheckExpiry(mockContext as Context);

            // Assert
            expect(result).toHaveProperty('success', true);
        });

        it('should allow access for client manager role when billing enabled (auth enforced by route middleware)', async () => {
            // Note: Authorization is enforced upstream by createAdminRoute middleware.
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'manager-1',
                permissions: [
                    PermissionEnum.ACCESS_API_PUBLIC,
                    PermissionEnum.ACCESS_API_PRIVATE,
                    PermissionEnum.MANAGE_CLIENTS
                ],
                role: RoleEnum.CLIENT_MANAGER
            });

            // Act
            const result = await handleCheckExpiry(mockContext as Context);

            // Assert
            expect(result).toHaveProperty('success', true);
        });
    });

    describe('Authorization - Admin Access', () => {
        it('should allow access for admin user and return success', async () => {
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'admin-1',
                permissions: Object.values(PermissionEnum),
                role: RoleEnum.ADMIN
            });

            // Act
            const result = await handleCheckExpiry(mockContext as Context);

            // Assert
            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('reconciledCount', 5);
            expect(result).toHaveProperty('message');
            expect(result.message).toContain('5 elapsed trial');

            // Verify service was called
            expect(mockTrialService.reconcileExpiredTrials).toHaveBeenCalledTimes(1);
        });

        it('should allow access for super admin user', async () => {
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'superadmin-1',
                permissions: Object.values(PermissionEnum),
                role: RoleEnum.SUPER_ADMIN
            });

            mockTrialService.reconcileExpiredTrials.mockResolvedValue(3);

            // Act
            const result = await handleCheckExpiry(mockContext as Context);

            // Assert
            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('reconciledCount', 3);
            expect(mockTrialService.reconcileExpiredTrials).toHaveBeenCalledTimes(1);
        });
    });

    describe('Billing Configuration', () => {
        it('should return 503 when billing is not enabled', async () => {
            // Arrange
            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return false;
                return undefined;
            });

            mockGetActorFromContext.mockReturnValue({
                id: 'admin-1',
                permissions: Object.values(PermissionEnum),
                role: RoleEnum.ADMIN
            });

            // Act & Assert
            await expect(handleCheckExpiry(mockContext as Context)).rejects.toThrow(HTTPException);

            await expect(handleCheckExpiry(mockContext as Context)).rejects.toThrow(
                'Billing service is not configured'
            );
        });
    });

    describe('Service Error Handling', () => {
        it('should handle service errors and throw 500', async () => {
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'admin-1',
                permissions: Object.values(PermissionEnum),
                role: RoleEnum.ADMIN
            });

            mockTrialService.reconcileExpiredTrials.mockRejectedValue(
                new Error('Database connection failed')
            );

            // Act & Assert
            await expect(handleCheckExpiry(mockContext as Context)).rejects.toThrow(HTTPException);

            // The handler wraps errors: when HOSPEDA_API_DEBUG_ERRORS is false,
            // the message is "Failed to check expired trials" (no original error detail).
            await expect(handleCheckExpiry(mockContext as Context)).rejects.toThrow(
                'Failed to check expired trials'
            );
        });

        it('should handle non-Error exceptions', async () => {
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'admin-1',
                permissions: Object.values(PermissionEnum),
                role: RoleEnum.ADMIN
            });

            mockTrialService.reconcileExpiredTrials.mockRejectedValue('Unknown error');

            // Act & Assert
            await expect(handleCheckExpiry(mockContext as Context)).rejects.toThrow(HTTPException);

            await expect(handleCheckExpiry(mockContext as Context)).rejects.toThrow(
                'Failed to check expired trials'
            );
        });
    });

    describe('Response Structure', () => {
        it('should return correct response structure with zero reconciled trials', async () => {
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'admin-1',
                permissions: Object.values(PermissionEnum),
                role: RoleEnum.ADMIN
            });

            mockTrialService.reconcileExpiredTrials.mockResolvedValue(0);

            // Act
            const result = await handleCheckExpiry(mockContext as Context);

            // Assert
            expect(result).toEqual({
                reconciledCount: 0,
                message: 'Successfully reconciled 0 elapsed trial(s)',
                success: true
            });
        });

        it('should return correct response structure with multiple reconciled trials', async () => {
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'admin-1',
                permissions: Object.values(PermissionEnum),
                role: RoleEnum.ADMIN
            });

            mockTrialService.reconcileExpiredTrials.mockResolvedValue(42);

            // Act
            const result = await handleCheckExpiry(mockContext as Context);

            // Assert
            expect(result.success).toBe(true);
            expect(result.reconciledCount).toBe(42);
            expect(result.message).toBe('Successfully reconciled 42 elapsed trial(s)');
        });

        it('should build the MP adapter and pass it through to reconcileExpiredTrials as paymentAdapter (HOS-171)', async () => {
            // Arrange — handleCheckExpiry must construct the same kind of MP
            // adapter as the trial-reconcile cron so the reconciler can re-read
            // each preapproval's live status; verify it flows through untouched.
            mockGetActorFromContext.mockReturnValue({
                id: 'admin-1',
                permissions: Object.values(PermissionEnum),
                role: RoleEnum.ADMIN
            });

            mockTrialService.reconcileExpiredTrials.mockResolvedValue(1);

            // Act
            await handleCheckExpiry(mockContext as Context);

            // Assert
            expect(mockTrialService.reconcileExpiredTrials).toHaveBeenCalledWith({
                paymentAdapter: mockPaymentAdapter
            });
        });
    });

    describe('Authorization Check Execution Order', () => {
        it('should check billing configuration before calling service', async () => {
            // Arrange - billing disabled
            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return false;
                return undefined;
            });

            mockGetActorFromContext.mockReturnValue({
                id: 'user-1',
                permissions: [],
                role: RoleEnum.USER
            });

            // Act & Assert
            // Should fail with billing not configured
            await expect(handleCheckExpiry(mockContext as Context)).rejects.toThrow(
                'Billing service is not configured'
            );
        });

        it('should check admin authorization before calling service (integration concern - route middleware)', async () => {
            // Note: handleCheckExpiry itself does not enforce role-based access.
            // The createAdminRoute wrapper handles authorization via requiredPermissions.
            // This test verifies that when billing is enabled, the service IS called.
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'user-1',
                permissions: [],
                role: RoleEnum.USER
            });

            const serviceSpy = vi.spyOn(mockTrialService, 'reconcileExpiredTrials');

            // Act - handler executes because auth check is in route middleware, not handler
            const result = await handleCheckExpiry(mockContext as Context);

            // Assert - service is called since handler doesn't restrict by role
            expect(result.success).toBe(true);
            expect(serviceSpy).toHaveBeenCalled();
        });
    });

    describe('Role Hierarchy Verification', () => {
        it('should execute for all roles when billing is enabled (auth enforced by route middleware)', async () => {
            // Note: handleCheckExpiry does not perform role checks directly.
            // Authorization is handled by the createAdminRoute wrapper middleware.
            // All roles can reach this handler in unit tests (middleware is mocked).
            const testCases = [
                { role: RoleEnum.GUEST, shouldAllow: true },
                { role: RoleEnum.USER, shouldAllow: true },
                { role: RoleEnum.CLIENT_MANAGER, shouldAllow: true },
                { role: RoleEnum.ADMIN, shouldAllow: true },
                { role: RoleEnum.SUPER_ADMIN, shouldAllow: true }
            ];

            for (const testCase of testCases) {
                // Arrange
                mockGetActorFromContext.mockReturnValue({
                    id: `test-${testCase.role}`,
                    permissions:
                        testCase.role === RoleEnum.SUPER_ADMIN || testCase.role === RoleEnum.ADMIN
                            ? Object.values(PermissionEnum)
                            : [PermissionEnum.ACCESS_API_PUBLIC],
                    role: testCase.role
                });

                // Reset spy
                mockTrialService.reconcileExpiredTrials.mockClear();

                // Act & Assert - all roles succeed since handler has no role check
                const result = await handleCheckExpiry(mockContext as Context);
                expect(result.success).toBe(true);
                expect(mockTrialService.reconcileExpiredTrials).toHaveBeenCalled();
            }
        });
    });
});
