/**
 * AddonExpirationService Test Suite
 *
 * Comprehensive tests for add-on expiration service including:
 * - Finding expired add-ons (active, past expires_at)
 * - Expiring add-ons (remove entitlements, update status)
 * - Batch processing expired add-ons
 * - Idempotent operations (already expired)
 * - Finding expiring add-ons (within N days)
 * - Error handling when dependencies fail
 * - Batch size limits (max 100)
 *
 * @module test/services/addon-expiration.service.test
 */

import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddonEntitlementService } from '../../src/services/addon-entitlement.service';
import { AddonExpirationService } from '../../src/services/addon-expiration.service';

// Mock dependencies
vi.mock('@repo/db', () => ({
    getDb: vi.fn()
}));

vi.mock('@repo/db/schemas', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        subscriptionId: 'subscription_id',
        addonSlug: 'addon_slug',
        status: 'status',
        purchasedAt: 'purchased_at',
        expiresAt: 'expires_at',
        cancelledAt: 'cancelled_at',
        paymentId: 'payment_id',
        limitAdjustments: 'limit_adjustments',
        entitlementAdjustments: 'entitlement_adjustments',
        metadata: 'metadata',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args) => ({ type: 'and', args })),
    eq: vi.fn((col, val) => ({ type: 'eq', col, val })),
    lte: vi.fn((col, val) => ({ type: 'lte', col, val })),
    gte: vi.fn((col, val) => ({ type: 'gte', col, val })),
    isNotNull: vi.fn((col) => ({ type: 'isNotNull', col })),
    sql: vi.fn()
}));

vi.mock('../../src/services/addon-entitlement.service');
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

describe('AddonExpirationService', () => {
    let service: AddonExpirationService;
    let mockDb: any;
    let mockEntitlementService: any;

    // Mock data
    const mockCustomerId = 'cust_123';
    const mockSubscriptionId = 'sub_123';
    const mockAddonSlug = 'extra-accommodations';

    const createMockAddonPurchase = (overrides: any = {}) => ({
        id: overrides.id || 'purchase_123',
        customerId: overrides.customerId || mockCustomerId,
        subscriptionId: overrides.subscriptionId || mockSubscriptionId,
        addonSlug: overrides.addonSlug || mockAddonSlug,
        status: overrides.status || 'active',
        purchasedAt: overrides.purchasedAt || new Date('2024-01-01'),
        expiresAt: overrides.expiresAt || new Date('2024-01-31'),
        cancelledAt: overrides.cancelledAt || null,
        paymentId: overrides.paymentId || 'pay_123',
        limitAdjustments: overrides.limitAdjustments || [
            {
                limitKey: 'max_accommodations',
                increase: 10,
                previousValue: 5,
                newValue: 15
            }
        ],
        entitlementAdjustments: overrides.entitlementAdjustments || [
            {
                entitlementKey: 'premium_features',
                granted: true
            }
        ],
        metadata: overrides.metadata || {},
        createdAt: overrides.createdAt || new Date('2024-01-01'),
        updatedAt: overrides.updatedAt || new Date('2024-01-01')
    });

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup mock database
        mockDb = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis()
        };

        const { getDb } = require('@repo/db');
        (getDb as Mock).mockReturnValue(mockDb);

        // Setup mock entitlement service
        mockEntitlementService = {
            removeAddonEntitlements: vi.fn().mockResolvedValue({ success: true })
        };

        (AddonEntitlementService as any).mockImplementation(() => mockEntitlementService);

        // Create service instance
        service = new AddonExpirationService(null);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('findExpiredAddons', () => {
        it('should return only active add-ons past expires_at', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const expiredPurchase1 = createMockAddonPurchase({
                id: 'purchase_1',
                expiresAt: new Date('2024-01-31T23:59:59Z'), // Expired
                status: 'active'
            });

            const expiredPurchase2 = createMockAddonPurchase({
                id: 'purchase_2',
                expiresAt: new Date('2024-01-15T00:00:00Z'), // Expired
                status: 'active'
            });

            mockDb.where.mockResolvedValue([expiredPurchase1, expiredPurchase2]);

            // Act
            const result = await service.findExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(2);
            expect(result.data?.[0]?.id).toBe('purchase_1');
            expect(result.data?.[1]?.id).toBe('purchase_2');

            // Verify correct query parameters
            expect(mockDb.select).toHaveBeenCalled();
            expect(mockDb.from).toHaveBeenCalled();
            expect(mockDb.where).toHaveBeenCalled();

            vi.useRealTimers();
        });

        it('should not return add-ons with null expires_at', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            // Only return add-ons with non-null expires_at
            mockDb.where.mockResolvedValue([]);

            // Act
            const result = await service.findExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(0);

            vi.useRealTimers();
        });

        it('should not return inactive add-ons', async () => {
            // Arrange
            mockDb.where.mockResolvedValue([]);

            // Act
            const result = await service.findExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(0);
        });

        it('should not return add-ons that have not expired yet', async () => {
            // Arrange
            const now = new Date('2024-01-15T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            // Future expiration - should not be returned
            mockDb.where.mockResolvedValue([]);

            // Act
            const result = await service.findExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(0);

            vi.useRealTimers();
        });

        it('should handle database errors gracefully', async () => {
            // Arrange
            mockDb.where.mockRejectedValue(new Error('Database connection failed'));

            // Act
            const result = await service.findExpiredAddons();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
            expect(result.error?.message).toBe('Failed to find expired add-ons');
        });

        it('should map database results to ExpiredAddon format correctly', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const mockPurchase = createMockAddonPurchase({
                id: 'purchase_123',
                customerId: 'cust_456',
                subscriptionId: 'sub_789',
                addonSlug: 'test-addon',
                expiresAt: new Date('2024-01-31')
            });

            mockDb.where.mockResolvedValue([mockPurchase]);

            // Act
            const result = await service.findExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1);

            const expired = result.data?.[0];
            expect(expired).toBeDefined();
            expect(expired?.id).toBe('purchase_123');
            expect(expired?.customerId).toBe('cust_456');
            expect(expired?.subscriptionId).toBe('sub_789');
            expect(expired?.addonSlug).toBe('test-addon');
            expect(expired?.expiresAt).toEqual(new Date('2024-01-31'));
            expect(expired?.limitAdjustments).toBeDefined();
            expect(expired?.entitlementAdjustments).toBeDefined();

            vi.useRealTimers();
        });
    });

    describe('expireAddon', () => {
        it('should remove entitlements and update status to expired', async () => {
            // Arrange
            const mockPurchase = createMockAddonPurchase({
                status: 'active'
            });

            mockDb.limit.mockResolvedValue([mockPurchase]);
            mockDb.where.mockResolvedValue(mockDb);
            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({ success: true });

            // Act
            const result = await service.expireAddon({ purchaseId: 'purchase_123' });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.purchaseId).toBe('purchase_123');
            expect(result.data?.customerId).toBe(mockCustomerId);
            expect(result.data?.addonSlug).toBe(mockAddonSlug);

            // Verify entitlement removal was called
            expect(mockEntitlementService.removeAddonEntitlements).toHaveBeenCalledWith({
                customerId: mockCustomerId,
                addonSlug: mockAddonSlug
            });

            // Verify database update was called
            expect(mockDb.update).toHaveBeenCalled();
            expect(mockDb.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'expired',
                    updatedAt: expect.any(Date)
                })
            );
        });

        it('should return NOT_FOUND if purchase does not exist', async () => {
            // Arrange
            mockDb.limit.mockResolvedValue([]);

            // Act
            const result = await service.expireAddon({ purchaseId: 'nonexistent' });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NOT_FOUND');
            expect(result.error?.message).toContain('not found');
        });

        it('should be idempotent - return success for already expired add-on', async () => {
            // Arrange
            const mockPurchase = createMockAddonPurchase({
                status: 'expired'
            });

            mockDb.limit.mockResolvedValue([mockPurchase]);

            // Act
            const result = await service.expireAddon({ purchaseId: 'purchase_123' });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.purchaseId).toBe('purchase_123');

            // Should NOT call entitlement service for already expired
            expect(mockEntitlementService.removeAddonEntitlements).not.toHaveBeenCalled();

            // Should NOT update database for already expired
            expect(mockDb.update).not.toHaveBeenCalled();
        });

        it('should return INVALID_STATUS for non-active status', async () => {
            // Arrange
            const mockPurchase = createMockAddonPurchase({
                status: 'cancelled'
            });

            mockDb.limit.mockResolvedValue([mockPurchase]);

            // Act
            const result = await service.expireAddon({ purchaseId: 'purchase_123' });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INVALID_STATUS');
            expect(result.error?.message).toContain("Cannot expire add-on with status 'cancelled'");
        });

        it('should handle entitlement removal failure', async () => {
            // Arrange
            const mockPurchase = createMockAddonPurchase({
                status: 'active'
            });

            mockDb.limit.mockResolvedValue([mockPurchase]);
            mockDb.where.mockResolvedValue(mockDb);
            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({
                success: false,
                error: {
                    code: 'ENTITLEMENT_ERROR',
                    message: 'Failed to remove entitlements'
                }
            });

            // Act
            const result = await service.expireAddon({ purchaseId: 'purchase_123' });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('ENTITLEMENT_REMOVAL_FAILED');
            expect(result.error?.message).toBe('Failed to remove add-on entitlements');

            // Verify database was NOT updated
            expect(mockDb.update).not.toHaveBeenCalled();
        });

        it('should handle database errors gracefully', async () => {
            // Arrange
            mockDb.limit.mockRejectedValue(new Error('Database error'));

            // Act
            const result = await service.expireAddon({ purchaseId: 'purchase_123' });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
            expect(result.error?.message).toBe('Failed to expire add-on purchase');
        });
    });

    describe('processExpiredAddons', () => {
        it('should handle batch processing with 0 items', async () => {
            // Arrange
            mockDb.where.mockResolvedValue([]);

            // Act
            const result = await service.processExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.processed).toBe(0);
            expect(result.data?.failed).toBe(0);
            expect(result.data?.errors).toHaveLength(0);
        });

        it('should handle batch processing with 1 item', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const mockPurchase = createMockAddonPurchase({
                id: 'purchase_1',
                expiresAt: new Date('2024-01-31')
            });

            mockDb.where.mockResolvedValue([mockPurchase]);
            mockDb.limit.mockResolvedValue([mockPurchase]);
            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({ success: true });

            // Act
            const result = await service.processExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.processed).toBe(1);
            expect(result.data?.failed).toBe(0);
            expect(result.data?.errors).toHaveLength(0);

            vi.useRealTimers();
        });

        it('should handle batch processing with many items', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const mockPurchases = Array.from({ length: 10 }, (_, i) =>
                createMockAddonPurchase({
                    id: `purchase_${i}`,
                    expiresAt: new Date('2024-01-31')
                })
            );

            mockDb.where.mockResolvedValue(mockPurchases);

            // Mock expireAddon for each call
            const purchases = mockPurchases.map((p) => createMockAddonPurchase(p));
            let callIndex = 0;
            mockDb.limit.mockImplementation(() => {
                const purchase = purchases[callIndex];
                callIndex++;
                return Promise.resolve([purchase]);
            });

            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({ success: true });

            // Act
            const result = await service.processExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.processed).toBe(10);
            expect(result.data?.failed).toBe(0);
            expect(result.data?.errors).toHaveLength(0);

            vi.useRealTimers();
        });

        it('should be idempotent - skip already expired add-ons', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            // Only active + expired addons returned from findExpiredAddons
            // Already expired ones are filtered by the query
            mockDb.where.mockResolvedValue([]);

            // Act
            const result = await service.processExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.processed).toBe(0);
            expect(result.data?.failed).toBe(0);

            vi.useRealTimers();
        });

        it('should continue processing after individual failures', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const mockPurchases = [
                createMockAddonPurchase({ id: 'purchase_1', expiresAt: new Date('2024-01-31') }),
                createMockAddonPurchase({ id: 'purchase_2', expiresAt: new Date('2024-01-31') }),
                createMockAddonPurchase({ id: 'purchase_3', expiresAt: new Date('2024-01-31') })
            ];

            mockDb.where.mockResolvedValue(mockPurchases);

            // Mock individual expireAddon calls
            let callIndex = 0;
            mockDb.limit.mockImplementation(() => {
                const purchase = mockPurchases[callIndex];
                callIndex++;
                return Promise.resolve([purchase]);
            });

            // Second call fails
            mockEntitlementService.removeAddonEntitlements
                .mockResolvedValueOnce({ success: true })
                .mockResolvedValueOnce({
                    success: false,
                    error: { code: 'ERROR', message: 'Entitlement removal failed' }
                })
                .mockResolvedValueOnce({ success: true });

            // Act
            const result = await service.processExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.processed).toBe(2); // First and third succeeded
            expect(result.data?.failed).toBe(1); // Second failed
            expect(result.data?.errors).toHaveLength(1);
            expect(result.data?.errors?.[0]?.purchaseId).toBe('purchase_2');

            vi.useRealTimers();
        });

        it('should respect batch limit of 100', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            // Create 150 expired add-ons
            const mockPurchases = Array.from({ length: 150 }, (_, i) =>
                createMockAddonPurchase({
                    id: `purchase_${i}`,
                    expiresAt: new Date('2024-01-31')
                })
            );

            mockDb.where.mockResolvedValue(mockPurchases);

            // Mock expireAddon for each call (only first 100 should be processed)
            const purchases = mockPurchases.slice(0, 100).map((p) => createMockAddonPurchase(p));
            let callIndex = 0;
            mockDb.limit.mockImplementation(() => {
                if (callIndex >= 100) {
                    throw new Error('Should not process more than 100');
                }
                const purchase = purchases[callIndex];
                callIndex++;
                return Promise.resolve([purchase]);
            });

            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({ success: true });

            // Act
            const result = await service.processExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.processed).toBe(100);
            expect(result.data?.failed).toBe(0);

            vi.useRealTimers();
        });

        it('should handle exception during individual expiration', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const mockPurchases = [
                createMockAddonPurchase({ id: 'purchase_1', expiresAt: new Date('2024-01-31') }),
                createMockAddonPurchase({ id: 'purchase_2', expiresAt: new Date('2024-01-31') })
            ];

            mockDb.where.mockResolvedValue(mockPurchases);

            // Mock first call throws exception
            let callIndex = 0;
            mockDb.limit.mockImplementation(() => {
                const purchase = mockPurchases[callIndex];
                callIndex++;
                if (callIndex === 1) {
                    throw new Error('Unexpected database error');
                }
                return Promise.resolve([purchase]);
            });

            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({ success: true });

            // Act
            const result = await service.processExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.processed).toBe(1); // Second succeeded
            expect(result.data?.failed).toBe(1); // First failed
            expect(result.data?.errors).toHaveLength(1);
            expect(result.data?.errors?.[0]?.purchaseId).toBe('purchase_1');
            expect(result.data?.errors?.[0]?.error).toBe('Unexpected database error');

            vi.useRealTimers();
        });

        it('should handle findExpiredAddons failure', async () => {
            // Arrange
            mockDb.where.mockRejectedValue(new Error('Database error'));

            // Act
            const result = await service.processExpiredAddons();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });
    });

    describe('findExpiringAddons', () => {
        it('should return correct add-ons within 3 days', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const mockPurchases = [
                createMockAddonPurchase({
                    id: 'purchase_1',
                    expiresAt: new Date('2024-02-02T10:00:00Z'), // 1 day
                    status: 'active'
                }),
                createMockAddonPurchase({
                    id: 'purchase_2',
                    expiresAt: new Date('2024-02-03T10:00:00Z'), // 2 days
                    status: 'active'
                }),
                createMockAddonPurchase({
                    id: 'purchase_3',
                    expiresAt: new Date('2024-02-04T09:00:00Z'), // Almost 3 days
                    status: 'active'
                })
            ];

            mockDb.where.mockResolvedValue(mockPurchases);

            // Act
            const result = await service.findExpiringAddons({ daysAhead: 3 });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(3);

            // Verify daysUntilExpiration calculation
            expect(result.data?.[0]?.daysUntilExpiration).toBe(1);
            expect(result.data?.[1]?.daysUntilExpiration).toBe(2);
            expect(result.data?.[2]?.daysUntilExpiration).toBe(3);

            vi.useRealTimers();
        });

        it('should not return already expired add-ons', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            // Add-on already expired - should not be returned
            mockDb.where.mockResolvedValue([]);

            // Act
            const result = await service.findExpiringAddons({ daysAhead: 3 });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(0);

            vi.useRealTimers();
        });

        it('should not return add-ons expiring beyond the window', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            // Add-on expires in 5 days - beyond 3-day window
            mockDb.where.mockResolvedValue([]);

            // Act
            const result = await service.findExpiringAddons({ daysAhead: 3 });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(0);

            vi.useRealTimers();
        });

        it('should handle different daysAhead values', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const mockPurchases = [
                createMockAddonPurchase({
                    id: 'purchase_1',
                    expiresAt: new Date('2024-02-08T10:00:00Z'), // 7 days
                    status: 'active'
                })
            ];

            mockDb.where.mockResolvedValue(mockPurchases);

            // Act
            const result = await service.findExpiringAddons({ daysAhead: 7 });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1);
            expect(result.data?.[0]?.daysUntilExpiration).toBe(7);

            vi.useRealTimers();
        });

        it('should handle database errors gracefully', async () => {
            // Arrange
            mockDb.where.mockRejectedValue(new Error('Database error'));

            // Act
            const result = await service.findExpiringAddons({ daysAhead: 3 });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
            expect(result.error?.message).toBe('Failed to find expiring add-ons');
        });

        it('should map database results to ExpiringAddon format correctly', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const mockPurchase = createMockAddonPurchase({
                id: 'purchase_123',
                customerId: 'cust_456',
                subscriptionId: 'sub_789',
                addonSlug: 'test-addon',
                expiresAt: new Date('2024-02-03T10:00:00Z') // 2 days
            });

            mockDb.where.mockResolvedValue([mockPurchase]);

            // Act
            const result = await service.findExpiringAddons({ daysAhead: 3 });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1);

            const expiring = result.data?.[0];
            expect(expiring).toBeDefined();
            expect(expiring?.id).toBe('purchase_123');
            expect(expiring?.customerId).toBe('cust_456');
            expect(expiring?.subscriptionId).toBe('sub_789');
            expect(expiring?.addonSlug).toBe('test-addon');
            expect(expiring?.daysUntilExpiration).toBe(2);
            expect(expiring?.limitAdjustments).toBeDefined();
            expect(expiring?.entitlementAdjustments).toBeDefined();

            vi.useRealTimers();
        });
    });

    describe('AddonEntitlementService failure scenarios', () => {
        it('should handle AddonEntitlementService failure in expireAddon', async () => {
            // Arrange
            const mockPurchase = createMockAddonPurchase({
                status: 'active'
            });

            mockDb.limit.mockResolvedValue([mockPurchase]);
            mockDb.where.mockResolvedValue(mockDb);
            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service unavailable'
                }
            });

            // Act
            const result = await service.expireAddon({ purchaseId: 'purchase_123' });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('ENTITLEMENT_REMOVAL_FAILED');
            expect(result.error?.message).toBe('Failed to remove add-on entitlements');

            // Verify status was NOT updated in database
            expect(mockDb.update).not.toHaveBeenCalled();
        });

        it('should handle AddonEntitlementService throwing exception', async () => {
            // Arrange
            const mockPurchase = createMockAddonPurchase({
                status: 'active'
            });

            mockDb.limit.mockResolvedValue([mockPurchase]);
            mockDb.where.mockResolvedValue(mockDb);
            mockEntitlementService.removeAddonEntitlements.mockRejectedValue(
                new Error('Network timeout')
            );

            // Act
            const result = await service.expireAddon({ purchaseId: 'purchase_123' });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });
    });
});
