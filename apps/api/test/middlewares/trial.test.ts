/**
 * Unit Tests: Trial Middleware
 *
 * Tests the trial middleware that blocks access to protected routes
 * when user's trial has expired.
 *
 * Test Coverage:
 * - Expired trial blocks access to protected routes (402)
 * - Billing routes allowed when trial expired
 * - Export routes allowed when trial expired
 * - Health and docs routes allowed when trial expired
 * - User without billing customer passes normally
 * - User with active trial passes normally
 * - Billing disabled bypasses trial check
 * - Trial expiring soon logs warning but allows access
 * - Non-HTTPException errors allow request through (fail-open)
 * - HTTPException errors are re-thrown
 * - Route path matching works correctly
 *
 * @module test/middlewares/trial
 */

import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trialMiddleware } from '../../src/middlewares/trial';

// Mock billing middleware
vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

// Mock TrialService
vi.mock('../../src/services/trial.service', () => ({
    TrialService: vi.fn()
}));

// Mock logger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    }
}));

// Import mocked modules
import { getQZPayBilling } from '../../src/middlewares/billing';
import { TrialService } from '../../src/services/trial.service';
import { apiLogger } from '../../src/utils/logger';

/**
 * Helper to create mock Hono context
 */
function createMockContext(
    overrides: {
        billingEnabled?: boolean;
        billingCustomerId?: string | null;
        path?: string;
    } = {}
) {
    return {
        get: vi.fn((key: string) => {
            if (key === 'billingEnabled') {
                return 'billingEnabled' in overrides ? overrides.billingEnabled : true;
            }
            if (key === 'billingCustomerId') {
                return 'billingCustomerId' in overrides ? overrides.billingCustomerId : 'cust-123';
            }
            return undefined;
        }),
        req: { path: overrides.path ?? '/api/v1/accommodations' }
    } as any;
}

/**
 * Helper to create mock next function
 */
function createMockNext() {
    return vi.fn().mockResolvedValue(undefined);
}

describe('Trial Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Billing Disabled', () => {
        it('should pass through when billing is disabled', async () => {
            // Arrange
            const ctx = createMockContext({ billingEnabled: false });
            const next = createMockNext();
            const middleware = trialMiddleware();

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(TrialService).not.toHaveBeenCalled();
        });

        it('should not check trial status when billing disabled', async () => {
            // Arrange
            const ctx = createMockContext({
                billingEnabled: false,
                billingCustomerId: 'cust-123'
            });
            const next = createMockNext();
            const middleware = trialMiddleware();

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(getQZPayBilling).not.toHaveBeenCalled();
            expect(TrialService).not.toHaveBeenCalled();
        });
    });

    describe('No Billing Customer', () => {
        it('should pass through when no billing customer ID', async () => {
            // Arrange
            const ctx = createMockContext({
                billingEnabled: true,
                billingCustomerId: null
            });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockTrialService = {
                getTrialStatus: vi.fn()
            };

            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(mockTrialService.getTrialStatus).not.toHaveBeenCalled();
            expect(getQZPayBilling).not.toHaveBeenCalled();
        });

        it('should pass through when billing customer ID is undefined', async () => {
            // Arrange
            const ctx = createMockContext({
                billingEnabled: true,
                billingCustomerId: undefined as any
            });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockTrialService = {
                getTrialStatus: vi.fn()
            };

            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(mockTrialService.getTrialStatus).not.toHaveBeenCalled();
            expect(getQZPayBilling).not.toHaveBeenCalled();
        });
    });

    describe('Allowed Routes When Trial Expired', () => {
        it('should allow access to /api/v1/protected/billing routes', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/protected/billing' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(TrialService).not.toHaveBeenCalled();
        });

        it('should allow access to /api/v1/protected/billing/trial routes', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/protected/billing/trial' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(TrialService).not.toHaveBeenCalled();
        });

        it('should allow access to /api/v1/protected/billing/subscriptions routes', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/protected/billing/subscriptions' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(TrialService).not.toHaveBeenCalled();
        });

        it('should allow access to /api/v1/protected/billing/plans routes', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/protected/billing/plans' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('should allow access to /api/v1/protected/billing/checkout routes', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/protected/billing/checkout' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('should allow access to /api/v1/export routes', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/export' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(TrialService).not.toHaveBeenCalled();
        });

        it('should allow access to /health endpoint', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/health' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(TrialService).not.toHaveBeenCalled();
        });

        it('should allow access to /docs endpoint', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/docs' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('should allow access to /reference endpoint', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/reference' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('should allow access to /ui endpoint', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/ui' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('should match routes with path starting with allowed prefix', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/protected/billing/invoices/123' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(TrialService).not.toHaveBeenCalled();
        });
    });

    describe('Expired Trial', () => {
        it('should block access with 402 when trial is expired', async () => {
            // Arrange
            const ctx = createMockContext({
                billingCustomerId: 'cust-123',
                path: '/api/v1/accommodations'
            });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockResolvedValue({
                    isExpired: true,
                    isOnTrial: false,
                    expiresAt: new Date('2024-06-10T00:00:00Z'),
                    daysRemaining: 0,
                    planSlug: null
                })
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act & Assert
            await expect(middleware(ctx, next)).rejects.toThrow(HTTPException);

            try {
                await middleware(ctx, next);
            } catch (error) {
                if (error instanceof HTTPException) {
                    expect(error.status).toBe(402);
                    expect(error.message).toContain('trial has expired');
                    expect((error as any).cause.code).toBe('TRIAL_EXPIRED');
                    expect((error as any).cause.upgradeUrl).toBe('/billing/plans');
                }
            }

            expect(next).not.toHaveBeenCalled();
            expect(apiLogger.warn).toHaveBeenCalledWith(
                {
                    customerId: 'cust-123',
                    path: '/api/v1/accommodations',
                    expiresAt: expect.any(Date)
                },
                'Blocked access due to expired trial'
            );
        });

        it('should include trial status in error cause', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/posts' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const trialStatus = {
                isExpired: true,
                isOnTrial: false,
                expiresAt: new Date('2024-06-10T00:00:00Z'),
                daysRemaining: 0,
                planSlug: null
            };

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockResolvedValue(trialStatus)
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act & Assert
            try {
                await middleware(ctx, next);
            } catch (error) {
                if (error instanceof HTTPException) {
                    expect((error as any).cause.trialStatus).toEqual(trialStatus);
                }
            }
        });
    });

    describe('Active Trial', () => {
        it('should allow access when trial is active', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/accommodations' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockResolvedValue({
                    isExpired: false,
                    isOnTrial: true,
                    expiresAt: new Date('2024-06-20T00:00:00Z'),
                    daysRemaining: 10,
                    planSlug: 'owner-basico'
                })
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(mockTrialService.getTrialStatus).toHaveBeenCalledWith({
                customerId: 'cust-123'
            });
        });

        it('should allow access when user has paid subscription', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/events' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockResolvedValue({
                    isExpired: false,
                    isOnTrial: false,
                    expiresAt: null,
                    daysRemaining: null,
                    planSlug: 'owner-premium'
                })
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe('Trial Expiring Soon Warning', () => {
        it('should log warning when trial expires in 3 days', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/accommodations' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockResolvedValue({
                    isExpired: false,
                    isOnTrial: true,
                    expiresAt: new Date('2024-06-18T00:00:00Z'),
                    daysRemaining: 3,
                    planSlug: 'owner-basico'
                })
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(apiLogger.warn).toHaveBeenCalledWith(
                {
                    customerId: 'cust-123',
                    daysRemaining: 3,
                    expiresAt: expect.any(Date)
                },
                'Trial expiring soon'
            );
        });

        it('should log warning when trial expires in 1 day', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/posts' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockResolvedValue({
                    isExpired: false,
                    isOnTrial: true,
                    expiresAt: new Date('2024-06-16T00:00:00Z'),
                    daysRemaining: 1,
                    planSlug: 'complex-basico'
                })
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(apiLogger.warn).toHaveBeenCalledWith(
                {
                    customerId: 'cust-123',
                    daysRemaining: 1,
                    expiresAt: expect.any(Date)
                },
                'Trial expiring soon'
            );
        });

        it('should not log warning when trial expires in 4+ days', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/destinations' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockResolvedValue({
                    isExpired: false,
                    isOnTrial: true,
                    expiresAt: new Date('2024-06-19T00:00:00Z'),
                    daysRemaining: 4,
                    planSlug: 'owner-basico'
                })
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(apiLogger.warn).not.toHaveBeenCalled();
        });

        it('should not log warning when not on trial', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/events' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockResolvedValue({
                    isExpired: false,
                    isOnTrial: false,
                    expiresAt: null,
                    daysRemaining: null,
                    planSlug: 'owner-premium'
                })
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(apiLogger.warn).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should rethrow HTTPException errors', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/accommodations' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const httpException = new HTTPException(402, {
                message: 'Trial expired',
                cause: { code: 'TRIAL_EXPIRED' }
            });

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockRejectedValue(httpException)
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act & Assert
            await expect(middleware(ctx, next)).rejects.toThrow(HTTPException);

            expect(next).not.toHaveBeenCalled();
        });

        it('should allow request through on non-HTTPException errors', async () => {
            // Arrange
            const ctx = createMockContext({
                billingCustomerId: 'cust-123',
                path: '/api/v1/posts'
            });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockRejectedValue(new Error('Database connection failed'))
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(apiLogger.warn).toHaveBeenCalledWith(
                {
                    customerId: 'cust-123',
                    path: '/api/v1/posts',
                    error: 'Database connection failed'
                },
                'Error checking trial status - allowing request'
            );
        });

        it('should allow request through on network errors', async () => {
            // Arrange
            const ctx = createMockContext({
                billingCustomerId: 'cust-456',
                path: '/api/v1/destinations'
            });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockRejectedValue(new Error('Network timeout'))
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(apiLogger.warn).toHaveBeenCalledWith(
                {
                    customerId: 'cust-456',
                    path: '/api/v1/destinations',
                    error: 'Network timeout'
                },
                'Error checking trial status - allowing request'
            );
        });

        it('should handle non-Error objects in catch block', async () => {
            // Arrange
            const ctx = createMockContext({
                billingCustomerId: 'cust-789',
                path: '/api/v1/events'
            });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockRejectedValue('String error')
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(apiLogger.warn).toHaveBeenCalledWith(
                {
                    customerId: 'cust-789',
                    path: '/api/v1/events',
                    error: 'String error'
                },
                'Error checking trial status - allowing request'
            );
        });
    });

    describe('Service Initialization', () => {
        it('should initialize TrialService with billing instance', async () => {
            // Arrange
            const ctx = createMockContext({ path: '/api/v1/accommodations' });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockBilling = { api: 'mock' };
            const mockTrialService = {
                getTrialStatus: vi.fn().mockResolvedValue({
                    isExpired: false,
                    isOnTrial: true,
                    expiresAt: new Date('2024-06-25T00:00:00Z'),
                    daysRemaining: 10,
                    planSlug: 'owner-basico'
                })
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await middleware(ctx, next);

            // Assert
            expect(getQZPayBilling).toHaveBeenCalledTimes(1);
            expect(TrialService).toHaveBeenCalledWith(mockBilling);
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('should call getTrialStatus with correct customerId', async () => {
            // Arrange
            const ctx = createMockContext({
                billingCustomerId: 'cust-specific-id',
                path: '/api/v1/posts'
            });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockResolvedValue({
                    isExpired: false,
                    isOnTrial: true,
                    expiresAt: new Date('2024-06-20T00:00:00Z'),
                    daysRemaining: 5,
                    planSlug: 'complex-basico'
                })
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await middleware(ctx, next);

            // Assert
            expect(mockTrialService.getTrialStatus).toHaveBeenCalledWith({
                customerId: 'cust-specific-id'
            });
            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe('Integration Scenarios', () => {
        it('should handle complete flow for expired trial on protected route', async () => {
            // Arrange
            const ctx = createMockContext({
                billingEnabled: true,
                billingCustomerId: 'cust-expired',
                path: '/api/v1/accommodations/create'
            });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockResolvedValue({
                    isExpired: true,
                    isOnTrial: false,
                    expiresAt: new Date('2024-06-01T00:00:00Z'),
                    daysRemaining: 0,
                    planSlug: null
                })
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act & Assert
            await expect(middleware(ctx, next)).rejects.toThrow(HTTPException);
            expect(next).not.toHaveBeenCalled();
            expect(apiLogger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: 'cust-expired'
                }),
                'Blocked access due to expired trial'
            );
        });

        it('should handle complete flow for active user on protected route', async () => {
            // Arrange
            const ctx = createMockContext({
                billingEnabled: true,
                billingCustomerId: 'cust-active',
                path: '/api/v1/events/list'
            });
            const next = createMockNext();
            const middleware = trialMiddleware();

            const mockBilling = {};
            const mockTrialService = {
                getTrialStatus: vi.fn().mockResolvedValue({
                    isExpired: false,
                    isOnTrial: false,
                    expiresAt: null,
                    daysRemaining: null,
                    planSlug: 'owner-premium'
                })
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(apiLogger.warn).not.toHaveBeenCalled();
        });

        it('should handle user on trial accessing billing routes', async () => {
            // Arrange
            const ctx = createMockContext({
                billingEnabled: true,
                billingCustomerId: 'cust-trial',
                path: '/api/v1/protected/billing/plans'
            });
            const next = createMockNext();
            const middleware = trialMiddleware();

            // Act
            await middleware(ctx, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(1);
            expect(TrialService).not.toHaveBeenCalled(); // Should skip trial check
        });
    });
});
