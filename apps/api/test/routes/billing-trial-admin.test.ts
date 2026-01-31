/**
 * Unit tests for Trial Check Expiry Admin Authentication
 *
 * Tests the admin-only authentication check for the trial expiry endpoint.
 * Verifies that only ADMIN and SUPER_ADMIN roles can access the endpoint.
 *
 * Endpoint: POST /api/v1/billing/trial/check-expiry
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

// Mock Clerk auth
vi.mock('@hono/clerk-auth', () => ({
    clerkMiddleware: vi.fn(() => async (_c: any, next: any) => next()),
    getAuth: vi.fn(() => ({ userId: null, sessionId: null }))
}));

// Mock all other middlewares
vi.mock('../../src/middlewares/auth', () => ({
    clerkAuth: vi.fn(() => async (_c: any, next: any) => next()),
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
    blockExpiredTrials: vi.fn()
};

vi.mock('../../src/services/trial.service', () => ({
    TrialService: vi.fn(() => mockTrialService)
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
        mockTrialService.blockExpiredTrials.mockResolvedValue(5);
    });

    describe('Authorization - Access Control', () => {
        it('should deny access for non-admin user (regular USER role)', async () => {
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'user-1',
                permissions: [PermissionEnum.ACCESS_API_PUBLIC],
                role: RoleEnum.USER
            });

            // Act & Assert
            await expect(handleCheckExpiry(mockContext as Context, {}, {}, {})).rejects.toThrow(
                HTTPException
            );

            await expect(handleCheckExpiry(mockContext as Context, {}, {}, {})).rejects.toThrow(
                'Admin access required'
            );

            // Verify service was never called
            expect(mockTrialService.blockExpiredTrials).not.toHaveBeenCalled();
        });

        it('should deny access for guest user', async () => {
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: '00000000-0000-4000-8000-000000000000',
                permissions: [PermissionEnum.ACCESS_API_PUBLIC],
                role: RoleEnum.GUEST
            });

            // Act & Assert
            await expect(handleCheckExpiry(mockContext as Context, {}, {}, {})).rejects.toThrow(
                HTTPException
            );

            await expect(handleCheckExpiry(mockContext as Context, {}, {}, {})).rejects.toThrow(
                'Admin access required'
            );
        });

        it('should deny access for client manager role', async () => {
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

            // Act & Assert
            await expect(handleCheckExpiry(mockContext as Context, {}, {}, {})).rejects.toThrow(
                'Admin access required'
            );
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
            const result = await handleCheckExpiry(mockContext as Context, {}, {}, {});

            // Assert
            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('blockedCount', 5);
            expect(result).toHaveProperty('message');
            expect(result.message).toContain('5 expired trial');

            // Verify service was called
            expect(mockTrialService.blockExpiredTrials).toHaveBeenCalledTimes(1);
        });

        it('should allow access for super admin user', async () => {
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'superadmin-1',
                permissions: Object.values(PermissionEnum),
                role: RoleEnum.SUPER_ADMIN
            });

            mockTrialService.blockExpiredTrials.mockResolvedValue(3);

            // Act
            const result = await handleCheckExpiry(mockContext as Context, {}, {}, {});

            // Assert
            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('blockedCount', 3);
            expect(mockTrialService.blockExpiredTrials).toHaveBeenCalledTimes(1);
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
            await expect(handleCheckExpiry(mockContext as Context, {}, {}, {})).rejects.toThrow(
                HTTPException
            );

            await expect(handleCheckExpiry(mockContext as Context, {}, {}, {})).rejects.toThrow(
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

            mockTrialService.blockExpiredTrials.mockRejectedValue(
                new Error('Database connection failed')
            );

            // Act & Assert
            await expect(handleCheckExpiry(mockContext as Context, {}, {}, {})).rejects.toThrow(
                HTTPException
            );

            await expect(handleCheckExpiry(mockContext as Context, {}, {}, {})).rejects.toThrow(
                'Database connection failed'
            );
        });

        it('should handle non-Error exceptions', async () => {
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'admin-1',
                permissions: Object.values(PermissionEnum),
                role: RoleEnum.ADMIN
            });

            mockTrialService.blockExpiredTrials.mockRejectedValue('Unknown error');

            // Act & Assert
            await expect(handleCheckExpiry(mockContext as Context, {}, {}, {})).rejects.toThrow(
                HTTPException
            );

            await expect(handleCheckExpiry(mockContext as Context, {}, {}, {})).rejects.toThrow(
                'Unknown error'
            );
        });
    });

    describe('Response Structure', () => {
        it('should return correct response structure with zero blocked trials', async () => {
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'admin-1',
                permissions: Object.values(PermissionEnum),
                role: RoleEnum.ADMIN
            });

            mockTrialService.blockExpiredTrials.mockResolvedValue(0);

            // Act
            const result = await handleCheckExpiry(mockContext as Context, {}, {}, {});

            // Assert
            expect(result).toEqual({
                blockedCount: 0,
                message: 'Successfully blocked 0 expired trial(s)',
                success: true
            });
        });

        it('should return correct response structure with multiple blocked trials', async () => {
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'admin-1',
                permissions: Object.values(PermissionEnum),
                role: RoleEnum.ADMIN
            });

            mockTrialService.blockExpiredTrials.mockResolvedValue(42);

            // Act
            const result = await handleCheckExpiry(mockContext as Context, {}, {}, {});

            // Assert
            expect(result.success).toBe(true);
            expect(result.blockedCount).toBe(42);
            expect(result.message).toBe('Successfully blocked 42 expired trial(s)');
        });
    });

    describe('Authorization Check Execution Order', () => {
        it('should check billing configuration before admin authorization', async () => {
            // Arrange - billing disabled
            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return false;
                return undefined;
            });

            // User is not even admin
            mockGetActorFromContext.mockReturnValue({
                id: 'user-1',
                permissions: [],
                role: RoleEnum.USER
            });

            // Act & Assert
            // Should fail with billing not configured, not admin access required
            await expect(handleCheckExpiry(mockContext as Context, {}, {}, {})).rejects.toThrow(
                'Billing service is not configured'
            );
        });

        it('should check admin authorization before calling service', async () => {
            // Arrange
            mockGetActorFromContext.mockReturnValue({
                id: 'user-1',
                permissions: [],
                role: RoleEnum.USER
            });

            const serviceSpy = vi.spyOn(mockTrialService, 'blockExpiredTrials');

            // Act & Assert
            await expect(handleCheckExpiry(mockContext as Context, {}, {}, {})).rejects.toThrow(
                'Admin access required'
            );

            // Service should never be called
            expect(serviceSpy).not.toHaveBeenCalled();
        });
    });

    describe('Role Hierarchy Verification', () => {
        it('should only allow ADMIN and SUPER_ADMIN roles', async () => {
            const testCases = [
                { role: RoleEnum.GUEST, shouldAllow: false },
                { role: RoleEnum.USER, shouldAllow: false },
                { role: RoleEnum.CLIENT_MANAGER, shouldAllow: false },
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
                mockTrialService.blockExpiredTrials.mockClear();

                // Act & Assert
                if (testCase.shouldAllow) {
                    const result = await handleCheckExpiry(mockContext as Context, {}, {}, {});
                    expect(result.success).toBe(true);
                    expect(mockTrialService.blockExpiredTrials).toHaveBeenCalled();
                } else {
                    await expect(
                        handleCheckExpiry(mockContext as Context, {}, {}, {})
                    ).rejects.toThrow('Admin access required');
                    expect(mockTrialService.blockExpiredTrials).not.toHaveBeenCalled();
                }
            }
        });
    });
});
