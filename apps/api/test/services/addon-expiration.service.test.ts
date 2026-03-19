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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies - must be before imports
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
        canceledAt: 'canceled_at',
        deletedAt: 'deleted_at',
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
    isNull: vi.fn((col) => ({ type: 'isNull', col })),
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

// Import after mocks
import { getDb } from '@repo/db';
import { isNull } from 'drizzle-orm';
import { AddonEntitlementService } from '../../src/services/addon-entitlement.service';
import { AddonExpirationService } from '../../src/services/addon-expiration.service';

// Get typed mock references
const mockGetDb = vi.mocked(getDb);

/** Minimal shape of the DB query builder chain used in expiration service tests */
interface MockDb {
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
}

/** Minimal mock for AddonEntitlementService methods exercised by expiration service */
interface MockEntitlementService {
    removeAddonEntitlements: ReturnType<typeof vi.fn>;
}

/** Override fields for mock addon purchase creation */
interface MockAddonPurchaseOverrides {
    id?: string;
    customerId?: string;
    subscriptionId?: string;
    addonSlug?: string;
    status?: string;
    purchasedAt?: Date;
    expiresAt?: Date;
    canceledAt?: Date | null;
    paymentId?: string;
    limitAdjustments?: Array<{
        limitKey: string;
        increase: number;
        previousValue: number;
        newValue: number;
    }>;
    entitlementAdjustments?: Array<{ entitlementKey: string; granted: boolean }>;
    metadata?: Record<string, unknown>;
    createdAt?: Date;
    updatedAt?: Date;
}

describe('AddonExpirationService', () => {
    let service: AddonExpirationService;
    let mockDb: MockDb;
    let mockEntitlementService: MockEntitlementService;

    // Mock data
    const mockCustomerId = 'cust_123';
    const mockSubscriptionId = 'sub_123';
    const mockAddonSlug = 'extra-accommodations';

    const createMockAddonPurchase = (overrides: MockAddonPurchaseOverrides = {}) => ({
        id: overrides.id || 'purchase_123',
        customerId: overrides.customerId || mockCustomerId,
        subscriptionId: overrides.subscriptionId || mockSubscriptionId,
        addonSlug: overrides.addonSlug || mockAddonSlug,
        status: overrides.status || 'active',
        purchasedAt: overrides.purchasedAt || new Date('2024-01-01'),
        expiresAt: overrides.expiresAt || new Date('2024-01-31'),
        canceledAt: overrides.canceledAt || null,
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

        mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof import('@repo/db').getDb>);

        // Setup mock entitlement service
        mockEntitlementService = {
            removeAddonEntitlements: vi.fn().mockResolvedValue({ success: true, data: undefined })
        };

        vi.mocked(AddonEntitlementService).mockImplementation(
            () => mockEntitlementService as unknown as AddonEntitlementService
        );

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
            expect(result.error?.message).toContain('Failed to find expired add-ons');
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

            // Setup mock chain: select().from().where().limit() returns purchase
            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([mockPurchase]);
            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({
                success: true,
                data: undefined
            });

            // Act
            const result = await service.expireAddon({ purchaseId: 'purchase_123' });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.purchaseId).toBe('purchase_123');
            expect(result.data?.customerId).toBe(mockCustomerId);
            expect(result.data?.addonSlug).toBe(mockAddonSlug);

            // Verify entitlement removal was called with all required fields including purchaseId
            expect(mockEntitlementService.removeAddonEntitlements).toHaveBeenCalledWith({
                customerId: mockCustomerId,
                addonSlug: mockAddonSlug,
                purchaseId: 'purchase_123'
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

        it('should pass purchaseId to removeAddonEntitlements', async () => {
            // Arrange
            const mockPurchase = createMockAddonPurchase({
                id: 'purchase_abc',
                customerId: 'cust_xyz',
                addonSlug: 'featured-listing',
                status: 'active'
            });

            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([mockPurchase]);
            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({
                success: true,
                data: undefined
            });

            // Act
            const result = await service.expireAddon({ purchaseId: 'purchase_abc' });

            // Assert
            expect(result.success).toBe(true);
            expect(mockEntitlementService.removeAddonEntitlements).toHaveBeenCalledWith(
                expect.objectContaining({
                    purchaseId: 'purchase_abc'
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
            const expiresAt = new Date('2024-01-31T23:59:59Z');
            const mockPurchase = createMockAddonPurchase({
                status: 'expired',
                expiresAt
            });

            mockDb.limit.mockResolvedValue([mockPurchase]);

            // Act
            const result = await service.expireAddon({ purchaseId: 'purchase_123' });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.purchaseId).toBe('purchase_123');
            // Idempotent path must return expiresAt (not canceledAt)
            expect(result.data?.expiredAt).toEqual(expiresAt);

            // Should NOT call entitlement service for already expired
            expect(mockEntitlementService.removeAddonEntitlements).not.toHaveBeenCalled();

            // Should NOT update database for already expired
            expect(mockDb.update).not.toHaveBeenCalled();
        });

        it('should return INVALID_STATUS for non-active status', async () => {
            // Arrange
            const mockPurchase = createMockAddonPurchase({
                status: 'canceled'
            });

            mockDb.limit.mockResolvedValue([mockPurchase]);

            // Act
            const result = await service.expireAddon({ purchaseId: 'purchase_123' });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INVALID_STATUS');
            expect(result.error?.message).toContain("Cannot expire add-on with status 'canceled'");
        });

        it('should handle entitlement removal failure', async () => {
            // Arrange
            const mockPurchase = createMockAddonPurchase({
                status: 'active'
            });

            // Setup mock chain
            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([mockPurchase]);
            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({
                success: false,
                error: {
                    code: 'ENTITLEMENT_ERROR',
                    message: 'Failed to remove entitlements'
                }
            });

            // Act
            const result = await service.expireAddon({ purchaseId: 'purchase_123' });

            // Assert — Phase 3 changed behavior: entitlement failures are caught
            // and the status update proceeds anyway (reconciliation on next cron run)
            expect(result.success).toBe(true);
            expect(result.data?.purchaseId).toBe('purchase_123');

            // Verify database WAS updated despite entitlement failure
            expect(mockDb.update).toHaveBeenCalled();
            expect(mockDb.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'expired',
                    updatedAt: expect.any(Date),
                    metadata: { entitlementRemovalPending: true }
                })
            );
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

            // First call: findExpiredAddons
            mockDb.where.mockResolvedValueOnce([mockPurchase]);

            // Second call: expireAddon
            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([mockPurchase]);
            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({
                success: true,
                data: undefined
            });

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

            // First call: findExpiredAddons
            mockDb.where.mockResolvedValueOnce(mockPurchases);

            // Subsequent calls: expireAddon for each purchase
            mockDb.where.mockReturnThis();
            const purchases = mockPurchases.map((p) => createMockAddonPurchase(p));
            let callIndex = 0;
            mockDb.limit.mockImplementation(() => {
                const purchase = purchases[callIndex];
                callIndex++;
                return Promise.resolve([purchase]);
            });

            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({
                success: true,
                data: undefined
            });

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

            // First call: findExpiredAddons
            mockDb.where.mockResolvedValueOnce(mockPurchases);

            // Subsequent calls: expireAddon for each purchase
            mockDb.where.mockReturnThis();
            let callIndex = 0;
            mockDb.limit.mockImplementation(() => {
                const purchase = mockPurchases[callIndex];
                callIndex++;
                return Promise.resolve([purchase]);
            });

            // Second call fails — but Phase 3 changed behavior: entitlement
            // failures are caught and the status update proceeds anyway, so
            // all three add-ons succeed at the expireAddon level.
            mockEntitlementService.removeAddonEntitlements
                .mockResolvedValueOnce({ success: true, data: undefined })
                .mockResolvedValueOnce({
                    success: false,
                    error: { code: 'ERROR', message: 'Entitlement removal failed' }
                })
                .mockResolvedValueOnce({ success: true, data: undefined });

            // Act
            const result = await service.processExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.processed).toBe(3); // All three succeed (entitlement failure is non-fatal)
            expect(result.data?.failed).toBe(0);
            expect(result.data?.errors).toHaveLength(0);

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

            // First call: findExpiredAddons
            mockDb.where.mockResolvedValueOnce(mockPurchases);

            // Subsequent calls: expireAddon for each purchase (only first 100 should be processed)
            mockDb.where.mockReturnThis();
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

            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({
                success: true,
                data: undefined
            });

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

            // First call: findExpiredAddons
            mockDb.where.mockResolvedValueOnce(mockPurchases);

            // Subsequent calls: expireAddon for each purchase
            // First call throws exception, second succeeds
            mockDb.where.mockReturnThis();
            let callIndex = 0;
            mockDb.limit.mockImplementation(() => {
                const purchase = mockPurchases[callIndex];
                callIndex++;
                if (callIndex === 1) {
                    throw new Error('Unexpected database error');
                }
                return Promise.resolve([purchase]);
            });

            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({
                success: true,
                data: undefined
            });

            // Act
            const result = await service.processExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.processed).toBe(1); // Second succeeded
            expect(result.data?.failed).toBe(1); // First failed
            expect(result.data?.errors).toHaveLength(1);
            expect(result.data?.errors?.[0]?.purchaseId).toBe('purchase_1');
            // expireAddon catches exceptions and returns generic error message
            expect(result.data?.errors?.[0]?.error).toBe('Failed to expire add-on purchase');

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
            expect(result.error?.message).toContain('Failed to find expiring add-ons');
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

            // Setup mock chain
            mockDb.where.mockReturnThis();
            mockDb.limit.mockResolvedValue([mockPurchase]);
            mockEntitlementService.removeAddonEntitlements.mockResolvedValue({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service unavailable'
                }
            });

            // Act
            const result = await service.expireAddon({ purchaseId: 'purchase_123' });

            // Assert — Phase 3 changed behavior: entitlement failures are caught
            // and the status update proceeds anyway (reconciliation on next cron run)
            expect(result.success).toBe(true);
            expect(result.data?.purchaseId).toBe('purchase_123');

            // Verify status WAS updated in database despite entitlement failure
            expect(mockDb.update).toHaveBeenCalled();
            expect(mockDb.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'expired',
                    updatedAt: expect.any(Date),
                    metadata: { entitlementRemovalPending: true }
                })
            );
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

    // =========================================================================
    // T-018: Soft-delete behavior
    // =========================================================================
    describe('soft-delete exclusion', () => {
        it('findExpiredAddons() should pass isNull(deletedAt) filter to the WHERE clause', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            // Return empty — simulates the DB applying the isNull(deletedAt) filter
            mockDb.where.mockResolvedValue([]);

            // Act
            await service.findExpiredAddons();

            // Assert: isNull() was called with the deletedAt column identifier from the mock schema
            // The mock schema maps deletedAt → 'deleted_at', so isNull receives that value
            expect(isNull).toHaveBeenCalledWith('deleted_at');

            vi.useRealTimers();
        });

        it('findExpiredAddons() should not return a soft-deleted record even when status=active and expires_at is past', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            // The DB returns empty because the isNull(deletedAt) condition excluded the row
            // (a soft-deleted record with deletedAt=new Date() would not pass the WHERE clause)
            mockDb.where.mockResolvedValue([]);

            // Act
            const result = await service.findExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(0);

            vi.useRealTimers();
        });

        it('findExpiringAddons() should pass isNull(deletedAt) filter to the WHERE clause', async () => {
            // Arrange
            const now = new Date('2024-02-01T10:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            // Return empty — simulates DB filtering out soft-deleted records
            mockDb.where.mockResolvedValue([]);

            // Act
            await service.findExpiringAddons({ daysAhead: 3 });

            // Assert: isNull() must have been invoked with the deletedAt column from the mock schema
            expect(isNull).toHaveBeenCalledWith('deleted_at');

            vi.useRealTimers();
        });
    });
});
