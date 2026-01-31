/**
 * Unit tests for Admin Usage API endpoint
 *
 * Tests the admin endpoint for retrieving customer usage data.
 * Tests authentication, authorization, error handling, and response structure.
 *
 * Endpoint: GET /api/v1/admin/billing/usage/:customerId
 */

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminCustomerUsageSummaryRoute } from '../../src/routes/billing/admin/usage';
import type { UsageTrackingService } from '../../src/services/usage-tracking.service';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    }
}));

// Mock billing middleware
const mockQZPayBilling = {
    subscriptions: {
        getByCustomerId: vi.fn()
    },
    plans: {
        get: vi.fn()
    }
};

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(() => mockQZPayBilling)
}));

// Mock usage tracking service
vi.mock('../../src/services/usage-tracking.service', () => ({
    UsageTrackingService: vi.fn().mockImplementation(() => ({
        getUsageSummary: vi.fn()
    }))
}));

describe('Admin Usage API - GET /:customerId', () => {
    let mockContext: Partial<Context>;
    let mockUsageService: Partial<UsageTrackingService>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create mock context
        mockContext = {
            get: vi.fn((key: string) => {
                if (key === 'billingEnabled') return true;
                return undefined;
            })
        };

        // Create mock usage service
        mockUsageService = {
            getUsageSummary: vi.fn()
        };
    });

    describe('Success Cases', () => {
        it('should return usage summary for valid customer', async () => {
            // Arrange
            const customerId = 'customer-123';
            const expectedData = {
                customerId,
                limits: [
                    {
                        limitKey: 'max_accommodations',
                        displayName: 'Alojamientos',
                        currentUsage: 5,
                        maxAllowed: 10,
                        usagePercentage: 50,
                        threshold: 'ok',
                        planBaseLimit: 10,
                        addonBonusLimit: 0
                    }
                ],
                overallThreshold: 'ok',
                upgradeUrl: '/billing/plans'
            };

            mockUsageService.getUsageSummary = vi.fn().mockResolvedValue({
                success: true,
                data: expectedData
            });

            // Mock UsageTrackingService constructor
            const { UsageTrackingService } = await import(
                '../../src/services/usage-tracking.service'
            );
            (UsageTrackingService as any).mockImplementation(() => mockUsageService);

            // Act
            const result = await getAdminCustomerUsageSummaryRoute.handler(
                mockContext as Context,
                { customerId },
                {},
                {}
            );

            // Assert
            expect(result).toEqual(expectedData);
            expect(mockUsageService.getUsageSummary).toHaveBeenCalledWith(customerId);
            expect(mockUsageService.getUsageSummary).toHaveBeenCalledTimes(1);
        });

        it('should return usage summary with warning threshold', async () => {
            // Arrange
            const customerId = 'customer-456';
            const expectedData = {
                customerId,
                limits: [
                    {
                        limitKey: 'max_accommodations',
                        displayName: 'Alojamientos',
                        currentUsage: 8,
                        maxAllowed: 10,
                        usagePercentage: 80,
                        threshold: 'warning',
                        planBaseLimit: 10,
                        addonBonusLimit: 0
                    }
                ],
                overallThreshold: 'warning',
                upgradeUrl: '/billing/plans'
            };

            mockUsageService.getUsageSummary = vi.fn().mockResolvedValue({
                success: true,
                data: expectedData
            });

            const { UsageTrackingService } = await import(
                '../../src/services/usage-tracking.service'
            );
            (UsageTrackingService as any).mockImplementation(() => mockUsageService);

            // Act
            const result = await getAdminCustomerUsageSummaryRoute.handler(
                mockContext as Context,
                { customerId },
                {},
                {}
            );

            // Assert
            expect(result).toEqual(expectedData);
            expect(result.overallThreshold).toBe('warning');
        });

        it('should return usage summary with multiple limits', async () => {
            // Arrange
            const customerId = 'customer-789';
            const expectedData = {
                customerId,
                limits: [
                    {
                        limitKey: 'max_accommodations',
                        displayName: 'Alojamientos',
                        currentUsage: 5,
                        maxAllowed: 10,
                        usagePercentage: 50,
                        threshold: 'ok',
                        planBaseLimit: 10,
                        addonBonusLimit: 0
                    },
                    {
                        limitKey: 'max_photos_per_accommodation',
                        displayName: 'Fotos por alojamiento',
                        currentUsage: 8,
                        maxAllowed: 10,
                        usagePercentage: 80,
                        threshold: 'warning',
                        planBaseLimit: 10,
                        addonBonusLimit: 0
                    }
                ],
                overallThreshold: 'warning',
                upgradeUrl: '/billing/plans'
            };

            mockUsageService.getUsageSummary = vi.fn().mockResolvedValue({
                success: true,
                data: expectedData
            });

            const { UsageTrackingService } = await import(
                '../../src/services/usage-tracking.service'
            );
            (UsageTrackingService as any).mockImplementation(() => mockUsageService);

            // Act
            const result = await getAdminCustomerUsageSummaryRoute.handler(
                mockContext as Context,
                { customerId },
                {},
                {}
            );

            // Assert
            expect(result.limits).toHaveLength(2);
            expect(result.overallThreshold).toBe('warning');
        });
    });

    describe('Error Cases', () => {
        it('should throw 503 when billing is not enabled', async () => {
            // Arrange
            mockContext.get = vi.fn((key: string) => {
                if (key === 'billingEnabled') return false;
                return undefined;
            });

            // Act & Assert
            await expect(
                getAdminCustomerUsageSummaryRoute.handler(
                    mockContext as Context,
                    { customerId: 'customer-123' },
                    {},
                    {}
                )
            ).rejects.toThrow(HTTPException);

            await expect(
                getAdminCustomerUsageSummaryRoute.handler(
                    mockContext as Context,
                    { customerId: 'customer-123' },
                    {},
                    {}
                )
            ).rejects.toThrow('Billing service is not configured');
        });

        it('should throw 503 when billing service is unavailable', async () => {
            // Arrange
            const { getQZPayBilling } = await import('../../src/middlewares/billing');
            (getQZPayBilling as any).mockReturnValue(null);

            // Act & Assert
            await expect(
                getAdminCustomerUsageSummaryRoute.handler(
                    mockContext as Context,
                    { customerId: 'customer-123' },
                    {},
                    {}
                )
            ).rejects.toThrow(HTTPException);

            await expect(
                getAdminCustomerUsageSummaryRoute.handler(
                    mockContext as Context,
                    { customerId: 'customer-123' },
                    {},
                    {}
                )
            ).rejects.toThrow('Billing service is unavailable');

            // Restore mock
            (getQZPayBilling as any).mockReturnValue(mockQZPayBilling);
        });

        it('should throw 500 when service returns error', async () => {
            // Arrange
            const customerId = 'customer-error';
            mockUsageService.getUsageSummary = vi.fn().mockResolvedValue({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Customer has no subscription'
                }
            });

            const { UsageTrackingService } = await import(
                '../../src/services/usage-tracking.service'
            );
            (UsageTrackingService as any).mockImplementation(() => mockUsageService);

            // Act & Assert
            await expect(
                getAdminCustomerUsageSummaryRoute.handler(
                    mockContext as Context,
                    { customerId },
                    {},
                    {}
                )
            ).rejects.toThrow(HTTPException);

            await expect(
                getAdminCustomerUsageSummaryRoute.handler(
                    mockContext as Context,
                    { customerId },
                    {},
                    {}
                )
            ).rejects.toThrow('Customer has no subscription');
        });

        it('should throw 500 when service returns success but no data', async () => {
            // Arrange
            const customerId = 'customer-nodata';
            mockUsageService.getUsageSummary = vi.fn().mockResolvedValue({
                success: true,
                data: null
            });

            const { UsageTrackingService } = await import(
                '../../src/services/usage-tracking.service'
            );
            (UsageTrackingService as any).mockImplementation(() => mockUsageService);

            // Act & Assert
            await expect(
                getAdminCustomerUsageSummaryRoute.handler(
                    mockContext as Context,
                    { customerId },
                    {},
                    {}
                )
            ).rejects.toThrow(HTTPException);
        });

        it('should handle invalid customer ID format', async () => {
            // Arrange
            const customerId = 'invalid-id';
            mockUsageService.getUsageSummary = vi.fn().mockResolvedValue({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid customer ID format'
                }
            });

            const { UsageTrackingService } = await import(
                '../../src/services/usage-tracking.service'
            );
            (UsageTrackingService as any).mockImplementation(() => mockUsageService);

            // Act & Assert
            await expect(
                getAdminCustomerUsageSummaryRoute.handler(
                    mockContext as Context,
                    { customerId },
                    {},
                    {}
                )
            ).rejects.toThrow(HTTPException);
        });
    });

    describe('Response Structure', () => {
        it('should return correctly structured usage summary', async () => {
            // Arrange
            const customerId = 'customer-structure';
            const expectedData = {
                customerId,
                limits: [
                    {
                        limitKey: 'max_accommodations',
                        displayName: 'Alojamientos',
                        currentUsage: 3,
                        maxAllowed: 10,
                        usagePercentage: 30,
                        threshold: 'ok',
                        planBaseLimit: 5,
                        addonBonusLimit: 5
                    }
                ],
                overallThreshold: 'ok',
                upgradeUrl: '/billing/plans'
            };

            mockUsageService.getUsageSummary = vi.fn().mockResolvedValue({
                success: true,
                data: expectedData
            });

            const { UsageTrackingService } = await import(
                '../../src/services/usage-tracking.service'
            );
            (UsageTrackingService as any).mockImplementation(() => mockUsageService);

            // Act
            const result = await getAdminCustomerUsageSummaryRoute.handler(
                mockContext as Context,
                { customerId },
                {},
                {}
            );

            // Assert - Check structure
            expect(result).toHaveProperty('customerId');
            expect(result).toHaveProperty('limits');
            expect(result).toHaveProperty('overallThreshold');
            expect(result).toHaveProperty('upgradeUrl');

            // Assert - Check limit structure
            expect(Array.isArray(result.limits)).toBe(true);
            const limit = result.limits[0];
            expect(limit).toHaveProperty('limitKey');
            expect(limit).toHaveProperty('displayName');
            expect(limit).toHaveProperty('currentUsage');
            expect(limit).toHaveProperty('maxAllowed');
            expect(limit).toHaveProperty('usagePercentage');
            expect(limit).toHaveProperty('threshold');
            expect(limit).toHaveProperty('planBaseLimit');
            expect(limit).toHaveProperty('addonBonusLimit');

            // Assert - Check types
            expect(typeof result.customerId).toBe('string');
            expect(typeof limit.currentUsage).toBe('number');
            expect(typeof limit.maxAllowed).toBe('number');
            expect(typeof limit.usagePercentage).toBe('number');
        });

        it('should validate threshold values are correct enum', async () => {
            // Arrange
            const customerId = 'customer-threshold';
            const thresholds = ['ok', 'warning', 'critical', 'exceeded'] as const;

            for (const threshold of thresholds) {
                const expectedData = {
                    customerId,
                    limits: [
                        {
                            limitKey: 'max_accommodations',
                            displayName: 'Alojamientos',
                            currentUsage: 5,
                            maxAllowed: 10,
                            usagePercentage: 50,
                            threshold,
                            planBaseLimit: 10,
                            addonBonusLimit: 0
                        }
                    ],
                    overallThreshold: threshold,
                    upgradeUrl: '/billing/plans'
                };

                mockUsageService.getUsageSummary = vi.fn().mockResolvedValue({
                    success: true,
                    data: expectedData
                });

                const { UsageTrackingService } = await import(
                    '../../src/services/usage-tracking.service'
                );
                (UsageTrackingService as any).mockImplementation(() => mockUsageService);

                // Act
                const result = await getAdminCustomerUsageSummaryRoute.handler(
                    mockContext as Context,
                    { customerId },
                    {},
                    {}
                );

                // Assert
                expect(result.overallThreshold).toBe(threshold);
                expect(result.limits[0].threshold).toBe(threshold);
            }
        });
    });

    describe('Service Integration', () => {
        it('should create UsageTrackingService with billing instance', async () => {
            // Arrange
            const customerId = 'customer-service';
            mockUsageService.getUsageSummary = vi.fn().mockResolvedValue({
                success: true,
                data: {
                    customerId,
                    limits: [],
                    overallThreshold: 'ok',
                    upgradeUrl: '/billing/plans'
                }
            });

            const { UsageTrackingService } = await import(
                '../../src/services/usage-tracking.service'
            );
            const UsageTrackingServiceSpy = vi.fn(() => mockUsageService);
            (UsageTrackingService as any).mockImplementation(UsageTrackingServiceSpy);

            // Act
            await getAdminCustomerUsageSummaryRoute.handler(
                mockContext as Context,
                { customerId },
                {},
                {}
            );

            // Assert
            expect(UsageTrackingServiceSpy).toHaveBeenCalledWith(mockQZPayBilling);
            expect(UsageTrackingServiceSpy).toHaveBeenCalledTimes(1);
        });

        it('should call getUsageSummary with correct customer ID', async () => {
            // Arrange
            const customerId = 'customer-call-check';
            mockUsageService.getUsageSummary = vi.fn().mockResolvedValue({
                success: true,
                data: {
                    customerId,
                    limits: [],
                    overallThreshold: 'ok',
                    upgradeUrl: '/billing/plans'
                }
            });

            const { UsageTrackingService } = await import(
                '../../src/services/usage-tracking.service'
            );
            (UsageTrackingService as any).mockImplementation(() => mockUsageService);

            // Act
            await getAdminCustomerUsageSummaryRoute.handler(
                mockContext as Context,
                { customerId },
                {},
                {}
            );

            // Assert
            expect(mockUsageService.getUsageSummary).toHaveBeenCalledWith(customerId);
            expect(mockUsageService.getUsageSummary).toHaveBeenCalledTimes(1);
        });
    });
});
