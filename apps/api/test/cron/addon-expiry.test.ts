/**
 * Unit Tests: Add-on Expiry Cron Job Handler
 *
 * Tests the addon-expiry job handler that processes expired add-ons and sends warnings.
 *
 * Test Coverage:
 * - Processes expired add-ons successfully
 * - Sends expiration warnings (3 days, 1 day)
 * - Prevents duplicate notifications (idempotency)
 * - Handles no expired add-ons gracefully
 * - Returns correct CronJobResult structure
 * - Error handling during processing
 * - Dry run mode behavior
 *
 * Mocking strategy: mocks the AddonExpirationService (service layer) for
 * business logic. The only remaining @repo/db mock is for the private
 * wasNotificationSent() helper which has inline DB access (no service).
 *
 * @module test/cron/addon-expiry
 */

import { NotificationType } from '@repo/notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addonExpiryJob } from '../../src/cron/jobs/addon-expiry.job';
import type { CronJobContext } from '../../src/cron/types';

// ---------------------------------------------------------------------------
// Mock: wasNotificationSent's DB dependency (no service layer exists for this)
// ---------------------------------------------------------------------------
const mockDbLimit = vi.fn();
const mockDbWhere = vi.fn();
const mockDbFrom = vi.fn();
const mockDbSelect = vi.fn();

// ---------------------------------------------------------------------------
// Mock: DB chains used by the revocation retry phase
// ---------------------------------------------------------------------------
const mockDbInnerJoin = vi.fn();
const mockDbUpdateWhere = vi.fn();
const mockDbUpdateSet = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        select: mockDbSelect,
        update: mockDbUpdate,
        // Required for the PostgreSQL advisory lock check at the start of the handler
        execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
    })),
    billingNotificationLog: {
        id: 'id',
        type: 'type',
        customerId: 'customer_id',
        createdAt: 'created_at',
        metadata: 'metadata'
    },
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        addonSlug: 'addon_slug',
        subscriptionId: 'subscription_id',
        status: 'status',
        metadata: 'metadata',
        deletedAt: 'deleted_at',
        canceledAt: 'canceled_at',
        updatedAt: 'updated_at'
    },
    billingSubscriptions: {
        id: 'id',
        customerId: 'customer_id',
        status: 'status',
        deletedAt: 'deleted_at',
        updatedAt: 'updated_at'
    },
    eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    gte: vi.fn((...args: unknown[]) => ({ op: 'gte', args })),
    isNull: vi.fn((...args: unknown[]) => ({ op: 'isNull', args })),
    sql: vi.fn((...args: unknown[]) => ({ op: 'sql', args }))
}));

// ---------------------------------------------------------------------------
// Mock: Service layer (AddonExpirationService)
// ---------------------------------------------------------------------------
vi.mock('../../src/services/addon-expiration.service', () => ({
    AddonExpirationService: vi.fn()
}));

// Mock notification helper (service-level dependency)
vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn()
}));

// Mock billing middleware (provides billing context)
vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

// Mock customer lookup (service-level dependency)
vi.mock('../../src/utils/customer-lookup', () => ({
    lookupCustomerDetails: vi.fn()
}));

// Mock apiLogger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock @sentry/node to capture Sentry.captureException calls
vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
    init: vi.fn(),
    withScope: vi.fn()
}));

// Mock revokeAddonForSubscriptionCancellation (addon lifecycle service)
vi.mock('../../src/services/addon-lifecycle.service', () => ({
    revokeAddonForSubscriptionCancellation: vi.fn()
}));

// Mock getAddonBySlug (billing config resolver)
vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn()
}));

// Mock clearEntitlementCache (entitlement middleware)
vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn(),
    entitlementMiddleware: vi.fn()
}));

import { getAddonBySlug } from '@repo/billing';
import { getDb } from '@repo/db';
import * as Sentry from '@sentry/node';
import { getQZPayBilling } from '../../src/middlewares/billing';
import { clearEntitlementCache } from '../../src/middlewares/entitlement';
import { AddonExpirationService } from '../../src/services/addon-expiration.service';
import { revokeAddonForSubscriptionCancellation } from '../../src/services/addon-lifecycle.service';
import { lookupCustomerDetails } from '../../src/utils/customer-lookup';
import { sendNotification } from '../../src/utils/notification-helper';

/**
 * Helper to create mock CronJobContext
 */
function createMockContext(overrides?: Partial<CronJobContext>): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        },
        startedAt: new Date('2024-06-15T05:00:00Z'),
        dryRun: false,
        ...overrides
    };
}

describe('Add-on Expiry Cron Job', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Restore getDb to the shared mock object so tests that do NOT call
        // vi.mocked(getDb).mockReturnValue(...) still get a usable DB instance.
        // Tests that previously overrode getDb would have had their override
        // cleared by clearAllMocks(), leaving getDb returning undefined.
        vi.mocked(getDb).mockReturnValue({
            select: mockDbSelect,
            update: mockDbUpdate,
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
        } as never);

        // Set up default DB chain for wasNotificationSent: returns empty (no prior notification)
        mockDbLimit.mockResolvedValue([]);
        mockDbWhere.mockReturnValue({ limit: mockDbLimit });
        // mockDbFrom supports both the simple chain (.where) and the JOIN chain (.innerJoin).
        // Phase 4 (revocation retry) uses .innerJoin().where().limit(100) — the where inside
        // innerJoin must return { limit } so that .limit(100) does not throw.
        // By default the innerJoin chain returns no orphaned purchases (empty array).
        mockDbInnerJoin.mockReturnValue({
            where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) })
        });
        mockDbFrom.mockReturnValue({ where: mockDbWhere, innerJoin: mockDbInnerJoin });
        mockDbSelect.mockReturnValue({ from: mockDbFrom });

        // Set up default DB chain for the revocation retry phase UPDATE
        mockDbUpdateWhere.mockResolvedValue([]);
        mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateWhere });
        mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet });

        // Default: billing is initialized (tests that need null override this explicitly).
        // subscriptions.get returns null by default so Phase 5 skips reconciliation silently.
        vi.mocked(getQZPayBilling).mockReturnValue({
            api: 'default-mock-billing',
            subscriptions: {
                get: vi.fn().mockResolvedValue(null),
                cancel: vi.fn().mockResolvedValue(undefined)
            }
        } as never);
    });

    describe('Job Definition', () => {
        it('should have correct job metadata', () => {
            expect(addonExpiryJob.name).toBe('addon-expiry');
            expect(addonExpiryJob.description).toBe(
                'Process expired add-ons and send expiration warnings'
            );
            expect(addonExpiryJob.schedule).toBe('0 5 * * *');
            expect(addonExpiryJob.enabled).toBe(true);
            expect(addonExpiryJob.timeoutMs).toBe(120000);
        });
    });

    describe('Expired Add-ons Processing', () => {
        it('should process expired add-ons successfully', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: {
                        processed: 5,
                        failed: 0,
                        errors: []
                    }
                }),
                findExpiringAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain('Processed 5 expired add-ons');
            expect(result.processed).toBe(5);
            expect(result.errors).toBe(0);
            expect(result.details?.expiredAddons).toBe(5);
            expect(mockService.processExpiredAddons).toHaveBeenCalledTimes(1);
        });

        it('should handle no expired add-ons gracefully', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: {
                        processed: 0,
                        failed: 0,
                        errors: []
                    }
                }),
                findExpiringAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
        });

        it('should handle partial failures during processing', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: {
                        processed: 3,
                        failed: 2,
                        errors: [
                            { purchaseId: 'purchase-1', error: 'Database error' },
                            { purchaseId: 'purchase-2', error: 'Not found' }
                        ]
                    }
                }),
                findExpiringAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(3);
            expect(result.errors).toBeGreaterThan(0);
        });
    });

    describe('Expiration Warnings', () => {
        it('should send warnings for add-ons expiring in 3 days', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockAddons = [
                {
                    id: 'addon-1',
                    customerId: 'cust-1',
                    addonSlug: 'extra-listings',
                    expiresAt: new Date('2024-06-18T00:00:00Z'),
                    daysUntilExpiration: 3
                },
                {
                    id: 'addon-2',
                    customerId: 'cust-2',
                    addonSlug: 'featured',
                    expiresAt: new Date('2024-06-18T00:00:00Z'),
                    daysUntilExpiration: 3
                }
            ];

            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: { processed: 0, failed: 0, errors: [] }
                }),
                findExpiringAddons: vi
                    .fn()
                    .mockResolvedValueOnce({
                        success: true,
                        data: mockAddons
                    })
                    .mockResolvedValueOnce({
                        success: true,
                        data: []
                    })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);

            vi.mocked(getQZPayBilling).mockReturnValue({ api: 'mock-billing' } as never);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'customer@example.com',
                name: 'Customer Name',
                userId: 'user-123'
            });

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.warningsSent).toBe(2);
            expect(sendNotification).toHaveBeenCalledTimes(2);
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.ADDON_EXPIRATION_WARNING,
                    customerId: 'cust-1',
                    addonName: 'extra-listings',
                    daysRemaining: 3
                })
            );
        });

        it('should send warnings for add-ons expiring in 1 day', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockAddons = [
                {
                    id: 'addon-1',
                    customerId: 'cust-1',
                    addonSlug: 'priority-support',
                    expiresAt: new Date('2024-06-16T00:00:00Z'),
                    daysUntilExpiration: 1
                }
            ];

            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: { processed: 0, failed: 0, errors: [] }
                }),
                findExpiringAddons: vi
                    .fn()
                    .mockResolvedValueOnce({
                        success: true,
                        data: []
                    })
                    .mockResolvedValueOnce({
                        success: true,
                        data: mockAddons
                    })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);

            vi.mocked(getQZPayBilling).mockReturnValue({ api: 'mock-billing' } as never);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'customer@example.com',
                name: 'Customer Name',
                userId: 'user-123'
            });

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.warningsSent).toBe(1);
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.ADDON_EXPIRATION_WARNING,
                    customerId: 'cust-1',
                    addonName: 'priority-support',
                    daysRemaining: 1
                })
            );
        });

        it('should not send duplicate warnings (idempotency via DB)', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockAddons = [
                {
                    id: 'addon-1',
                    customerId: 'cust-1',
                    addonSlug: 'featured',
                    expiresAt: new Date('2024-06-18T00:00:00Z'),
                    daysUntilExpiration: 3
                }
            ];

            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: { processed: 0, failed: 0, errors: [] }
                }),
                findExpiringAddons: vi
                    .fn()
                    .mockResolvedValueOnce({
                        success: true,
                        data: mockAddons
                    })
                    .mockResolvedValueOnce({
                        success: true,
                        data: mockAddons // Same add-on appears in both queries
                    })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);

            vi.mocked(getQZPayBilling).mockReturnValue({ api: 'mock-billing' } as never);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'customer@example.com',
                name: 'Customer Name',
                userId: 'user-123'
            });

            // First call to wasNotificationSent returns [] (not sent yet),
            // second call returns a row (already sent today via billing_notification_log)
            mockDbLimit
                .mockResolvedValueOnce([]) // 3-day check: not sent yet, allow
                .mockResolvedValueOnce([{ id: 'log-1' }]); // 1-day check: already sent, skip

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.warningsSent).toBe(1); // Should only send once
            expect(sendNotification).toHaveBeenCalledTimes(1);
        });
    });

    describe('Multiple addons expiring on the same day', () => {
        it('should process and notify for two different addons expiring on the same day for the same customer', async () => {
            // Arrange — two addons with the same expiration date, same customer
            const ctx = createMockContext();
            const expiresAt = new Date('2024-06-18T00:00:00Z');

            const _mockExpiredAddons = [
                {
                    id: 'addon-same-day-1',
                    customerId: 'cust-same',
                    addonSlug: 'visibility-boost-7d',
                    expiresAt,
                    daysUntilExpiration: 0
                },
                {
                    id: 'addon-same-day-2',
                    customerId: 'cust-same',
                    addonSlug: 'visibility-boost-30d',
                    expiresAt,
                    daysUntilExpiration: 0
                }
            ];

            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: {
                        processed: 2,
                        failed: 0,
                        errors: []
                    }
                }),
                findExpiringAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(getQZPayBilling).mockReturnValue({ api: 'mock-billing' } as never);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'same@example.com',
                name: 'Same Customer',
                userId: 'user-same'
            });

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert — both addons are processed (2 processed total)
            expect(result.success).toBe(true);
            expect(result.processed).toBe(2);
            expect(result.errors).toBe(0);
            expect(result.details?.expiredAddons).toBe(2);

            // processExpiredAddons is called once (batch, not per addon)
            expect(mockService.processExpiredAddons).toHaveBeenCalledTimes(1);
        });

        it('should send warning notifications for two different addons expiring on the same day', async () => {
            // Arrange — two different addons for the same customer, both expiring in 3 days
            const ctx = createMockContext();

            const mockWarnAddons = [
                {
                    id: 'warn-1',
                    customerId: 'cust-multi',
                    addonSlug: 'extra-photos-20',
                    expiresAt: new Date('2024-06-18T00:00:00Z'),
                    daysUntilExpiration: 3
                },
                {
                    id: 'warn-2',
                    customerId: 'cust-multi',
                    addonSlug: 'extra-accommodations-5',
                    expiresAt: new Date('2024-06-18T00:00:00Z'),
                    daysUntilExpiration: 3
                }
            ];

            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: { processed: 0, failed: 0, errors: [] }
                }),
                findExpiringAddons: vi
                    .fn()
                    .mockResolvedValueOnce({
                        success: true,
                        data: mockWarnAddons // 3-day warnings
                    })
                    .mockResolvedValueOnce({
                        success: true,
                        data: [] // no 1-day warnings
                    })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(getQZPayBilling).mockReturnValue({ api: 'mock-billing' } as never);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'multi@example.com',
                name: 'Multi Customer',
                userId: 'user-multi'
            });

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert — two notifications sent, one per addon
            expect(result.success).toBe(true);
            expect(result.details?.warningsSent).toBe(2);
            expect(sendNotification).toHaveBeenCalledTimes(2);

            // Both notifications target the same customer
            const calls = vi.mocked(sendNotification).mock.calls;
            expect(calls[0]![0]).toMatchObject({
                customerId: 'cust-multi',
                addonName: 'extra-photos-20',
                daysRemaining: 3
            });
            expect(calls[1]![0]).toMatchObject({
                customerId: 'cust-multi',
                addonName: 'extra-accommodations-5',
                daysRemaining: 3
            });
        });
    });

    describe('Dry Run Mode', () => {
        it('should count expired add-ons without processing in dry-run mode', async () => {
            // Arrange
            const ctx = createMockContext({ dryRun: true });
            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: [{}, {}, {}] // 3 expired add-ons
                }),
                findExpiringAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: [{}, {}] // 2 expiring (3d) + 1 expiring (1d)
                })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBeGreaterThan(0);
            expect(result.details?.dryRun).toBe(true);
            expect(mockService.findExpiredAddons).toHaveBeenCalledTimes(1);
        });

        it('should count warnings without sending in dry-run mode', async () => {
            // Arrange
            const ctx = createMockContext({ dryRun: true });
            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                findExpiringAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: [{ id: '1' }, { id: '2' }]
                })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(sendNotification).not.toHaveBeenCalled();
            expect(result.details?.dryRun).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle service errors gracefully', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi
                    .fn()
                    .mockRejectedValue(new Error('Database connection failed')),
                findExpiringAddons: vi.fn()
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to process add-on expiry');
            expect(result.message).toContain('Database connection failed');
            expect(result.errors).toBeGreaterThan(0);
            expect(result.details?.error).toBe('Database connection failed');
        });

        it('should continue processing warnings even if expired processing fails', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: false,
                    error: { code: 'ERROR', message: 'Failed' }
                }),
                findExpiringAddons: vi
                    .fn()
                    .mockResolvedValueOnce({
                        success: true,
                        data: [
                            {
                                id: 'addon-1',
                                customerId: 'cust-1',
                                addonSlug: 'featured',
                                expiresAt: new Date('2024-06-18T00:00:00Z'),
                                daysUntilExpiration: 3
                            }
                        ]
                    })
                    .mockResolvedValueOnce({
                        success: true,
                        data: []
                    })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);

            vi.mocked(getQZPayBilling).mockReturnValue({ api: 'mock-billing' } as never);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'customer@example.com',
                name: 'Customer Name',
                userId: 'user-123'
            });

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.errors).toBeGreaterThan(0);
            expect(sendNotification).toHaveBeenCalled(); // Should still send warnings
        });

        it('should handle notification failures gracefully', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: { processed: 0, failed: 0, errors: [] }
                }),
                findExpiringAddons: vi
                    .fn()
                    .mockResolvedValueOnce({
                        success: true,
                        data: [
                            {
                                id: 'addon-1',
                                customerId: 'cust-1',
                                addonSlug: 'featured',
                                expiresAt: new Date('2024-06-18T00:00:00Z'),
                                daysUntilExpiration: 3
                            }
                        ]
                    })
                    .mockResolvedValueOnce({
                        success: true,
                        data: []
                    })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);
            vi.mocked(sendNotification).mockRejectedValue(new Error('Email service unavailable'));

            vi.mocked(getQZPayBilling).mockReturnValue({ api: 'mock-billing' } as never);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'customer@example.com',
                name: 'Customer Name',
                userId: 'user-123'
            });

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Wait for async notification catch handler to execute
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Assert
            expect(result.success).toBe(true); // Job should not fail due to notification errors
            // Notification failures are logged at warn level (visible in production)
            expect(ctx.logger.warn).toHaveBeenCalled();
        });
    });

    describe('Billing Instance Initialization', () => {
        it('should pass billing instance to AddonExpirationService constructor', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockBillingInstance = { api: 'mock-billing-instance', type: 'qzpay' };
            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: { processed: 0, failed: 0, errors: [] }
                }),
                findExpiringAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                })
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBillingInstance as never);
            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            // Act
            await addonExpiryJob.handler(ctx);

            // Assert - AddonExpirationService must be constructed with the billing instance
            expect(AddonExpirationService).toHaveBeenCalledWith(mockBillingInstance);
        });

        it('should log error and return early when getQZPayBilling returns null', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = {
                processExpiredAddons: vi.fn(),
                findExpiringAddons: vi.fn()
            };

            vi.mocked(getQZPayBilling).mockReturnValue(null as never);
            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert - job must fail and return early without calling processExpiredAddons
            expect(result.success).toBe(false);
            expect(result.message).toContain('billing');
            expect(result.processed).toBe(0);
            expect(result.errors).toBeGreaterThan(0);
            expect(mockService.processExpiredAddons).not.toHaveBeenCalled();
            expect(mockService.findExpiringAddons).not.toHaveBeenCalled();
        });
    });

    describe('Result Structure', () => {
        it('should return correctly structured CronJobResult', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: { processed: 2, failed: 0, errors: [] }
                }),
                findExpiringAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result).toMatchObject({
                success: expect.any(Boolean),
                message: expect.any(String),
                processed: expect.any(Number),
                errors: expect.any(Number),
                durationMs: expect.any(Number)
            });

            if (result.details) {
                expect(result.details).toMatchObject({
                    expiredAddons: expect.any(Number),
                    warningsSent: expect.any(Number),
                    dryRun: expect.any(Boolean)
                });
            }
        });
    });

    // -------------------------------------------------------------------------
    // Revocation Retry Phase
    // -------------------------------------------------------------------------

    describe('Revocation Retry Phase', () => {
        /**
         * Creates a minimal mock service that succeeds for the expiry phases
         * (expired processing + 3-day/1-day warnings) so the retry phase tests
         * can focus exclusively on the new behaviour.
         */
        function buildBaseService() {
            return {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: { processed: 0, failed: 0, errors: [] }
                }),
                findExpiringAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                })
            };
        }

        /**
         * Builds a mock `getDb()` return value that handles:
         * - `.select().from().where().limit()` used by `wasNotificationSent`
         * - `.select().from().innerJoin().where()` used by the retry phase query
         * - `.update().set().where()` used by the retry phase updates
         *
         * @param orphanedPurchases - rows returned by the JOIN query
         * @param updateResult - value resolved by update().set().where()
         */
        function buildMockDb(
            orphanedPurchases: Array<{
                id: string;
                customerId: string;
                addonSlug: string;
                metadata: Record<string, unknown> | null;
            }>,
            updateResult: unknown[] = []
        ) {
            // SELECT used by wasNotificationSent (simple chain, no innerJoin)
            const notifWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
            const _notifFrom = vi.fn().mockReturnValue({ where: notifWhere });

            // SELECT used by the retry phase (JOIN chain).
            // Phase 4 calls .innerJoin().where().limit(100) so where must return { limit }.
            const retryWhere = vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(orphanedPurchases)
            });
            const retryInnerJoin = vi.fn().mockReturnValue({ where: retryWhere });
            const retryFrom = vi
                .fn()
                .mockReturnValue({ innerJoin: retryInnerJoin, where: notifWhere });

            // UPDATE chain
            const updateWhere = vi.fn().mockResolvedValue(updateResult);
            const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
            const update = vi.fn().mockReturnValue({ set: updateSet });

            // select() must differentiate between the two usage patterns.
            // wasNotificationSent passes `{ id: billingNotificationLog.id }` as fields.
            // The retry phase passes a multi-field object including addonSlug.
            // We distinguish by checking if the first call argument contains 'addonSlug'.
            const select = vi.fn().mockImplementation((fields: Record<string, unknown>) => {
                const isRetryQuery = fields && 'addonSlug' in fields;
                return {
                    from: isRetryQuery ? retryFrom : vi.fn().mockReturnValue({ where: notifWhere })
                };
            });

            return {
                db: {
                    select,
                    update,
                    // Required for the PostgreSQL advisory lock at handler start/finally
                    execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
                },
                spies: {
                    retryWhere,
                    retryInnerJoin,
                    retryFrom,
                    update,
                    updateSet,
                    updateWhere,
                    select
                }
            };
        }

        it('should revoke an orphaned active addon and set status to canceled', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = buildBaseService();
            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            const purchase = {
                id: 'purchase-orphan-1',
                customerId: 'cust-orphan',
                addonSlug: 'visibility-boost-7d',
                metadata: null
            };

            const { db } = buildMockDb([purchase]);
            const { getDb } = await import('@repo/db');
            vi.mocked(getDb).mockReturnValue(db as never);

            vi.mocked(getAddonBySlug).mockReturnValue({ slug: 'visibility-boost-7d' } as never);
            vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValue({
                purchaseId: purchase.id,
                addonSlug: purchase.addonSlug,
                addonType: 'entitlement',
                outcome: 'success'
            });

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.revocationRetried).toBe(1);
            expect(result.details?.revocationErrors).toBe(0);
            expect(revokeAddonForSubscriptionCancellation).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: purchase.customerId,
                    purchase: { id: purchase.id, addonSlug: purchase.addonSlug }
                })
            );
            expect(clearEntitlementCache).toHaveBeenCalledWith(purchase.customerId);
        });

        it('should skip addon when revocationRetryCount has reached the limit of 3', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = buildBaseService();
            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            const purchase = {
                id: 'purchase-exhausted',
                customerId: 'cust-exhausted',
                addonSlug: 'extra-listings',
                metadata: { revocationRetryCount: 3 }
            };

            const { db } = buildMockDb([purchase]);
            const { getDb } = await import('@repo/db');
            vi.mocked(getDb).mockReturnValue(db as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(revokeAddonForSubscriptionCancellation).not.toHaveBeenCalled();
            // debug log must be written for the skipped purchase
            expect(ctx.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('retry limit'),
                expect.objectContaining({ purchaseId: purchase.id })
            );
        });

        it('should increment revocationRetryCount on failed revocation outcome', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = buildBaseService();
            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            const purchase = {
                id: 'purchase-fail-1',
                customerId: 'cust-fail',
                addonSlug: 'unknown-addon',
                metadata: { revocationRetryCount: 0 }
            };

            const updateWhereSpy = vi.fn().mockResolvedValue([]);
            const updateSetSpy = vi.fn().mockReturnValue({ where: updateWhereSpy });
            const updateSpy = vi.fn().mockReturnValue({ set: updateSetSpy });

            const notifWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
            // Phase 4 calls .innerJoin().where().limit(100) — where must return { limit }
            const retryWhere = vi
                .fn()
                .mockReturnValue({ limit: vi.fn().mockResolvedValue([purchase]) });
            const retryInnerJoin = vi.fn().mockReturnValue({ where: retryWhere });
            const retryFrom = vi.fn().mockReturnValue({ innerJoin: retryInnerJoin });

            const selectSpy = vi.fn().mockImplementation((fields: Record<string, unknown>) => {
                const isRetryQuery = fields && 'addonSlug' in fields;
                return {
                    from: isRetryQuery ? retryFrom : vi.fn().mockReturnValue({ where: notifWhere })
                };
            });

            const { getDb } = await import('@repo/db');
            vi.mocked(getDb).mockReturnValue({
                select: selectSpy,
                update: updateSpy,
                execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
            } as never);

            vi.mocked(getAddonBySlug).mockReturnValue(undefined);
            vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValue({
                purchaseId: purchase.id,
                addonSlug: purchase.addonSlug,
                addonType: 'unknown',
                outcome: 'failed',
                error: 'Addon definition not found'
            });

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.revocationErrors).toBe(1);
            expect(updateSpy).toHaveBeenCalled();
            // Verify metadata was updated with incremented count
            expect(updateSetSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({ revocationRetryCount: 1 })
                })
            );
            // lastRevocationAttempt must also be set
            expect(updateSetSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        lastRevocationAttempt: expect.any(String)
                    })
                })
            );
        });

        it('should call Sentry.captureException when retry count reaches 3', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = buildBaseService();
            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            const purchase = {
                id: 'purchase-sentry',
                customerId: 'cust-sentry',
                addonSlug: 'featured-listing',
                metadata: { revocationRetryCount: 2 }
            };

            const updateWhereSpy = vi.fn().mockResolvedValue([]);
            const updateSetSpy = vi.fn().mockReturnValue({ where: updateWhereSpy });
            const updateSpy = vi.fn().mockReturnValue({ set: updateSetSpy });

            const notifWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
            // Phase 4 calls .innerJoin().where().limit(100) — where must return { limit }
            const retryWhere = vi
                .fn()
                .mockReturnValue({ limit: vi.fn().mockResolvedValue([purchase]) });
            const retryInnerJoin = vi.fn().mockReturnValue({ where: retryWhere });
            const retryFrom = vi.fn().mockReturnValue({ innerJoin: retryInnerJoin });

            const selectSpy = vi.fn().mockImplementation((fields: Record<string, unknown>) => {
                const isRetryQuery = fields && 'addonSlug' in fields;
                return {
                    from: isRetryQuery ? retryFrom : vi.fn().mockReturnValue({ where: notifWhere })
                };
            });

            const { getDb } = await import('@repo/db');
            vi.mocked(getDb).mockReturnValue({
                select: selectSpy,
                update: updateSpy,
                execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
            } as never);

            vi.mocked(getAddonBySlug).mockReturnValue(undefined);
            vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValue({
                purchaseId: purchase.id,
                addonSlug: purchase.addonSlug,
                addonType: 'unknown',
                outcome: 'failed',
                error: 'Addon definition not found'
            });

            // Act
            await addonExpiryJob.handler(ctx);

            // Assert: retryCount was 2, after failure it becomes 3 >= 3, so Sentry must be called
            expect(Sentry.captureException).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    tags: expect.objectContaining({ action: 'cron_retry_exhausted' }),
                    extra: expect.objectContaining({
                        customerId: purchase.customerId,
                        purchaseId: purchase.id,
                        addonSlug: purchase.addonSlug
                    })
                })
            );
        });

        it('should process orphaned addons from multiple customers and call clearEntitlementCache for each', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = buildBaseService();
            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            const purchases = [
                {
                    id: 'purchase-multi-1',
                    customerId: 'cust-alpha',
                    addonSlug: 'visibility-boost-7d',
                    metadata: null
                },
                {
                    id: 'purchase-multi-2',
                    customerId: 'cust-beta',
                    addonSlug: 'extra-listings',
                    metadata: null
                }
            ];

            const updateWhereSpy = vi.fn().mockResolvedValue([]);
            const updateSetSpy = vi.fn().mockReturnValue({ where: updateWhereSpy });
            const updateSpy = vi.fn().mockReturnValue({ set: updateSetSpy });

            const notifWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
            // Phase 4 calls .innerJoin().where().limit(100) — where must return { limit }
            const retryWhere = vi
                .fn()
                .mockReturnValue({ limit: vi.fn().mockResolvedValue(purchases) });
            const retryInnerJoin = vi.fn().mockReturnValue({ where: retryWhere });
            const retryFrom = vi.fn().mockReturnValue({ innerJoin: retryInnerJoin });

            const selectSpy = vi.fn().mockImplementation((fields: Record<string, unknown>) => {
                const isRetryQuery = fields && 'addonSlug' in fields;
                return {
                    from: isRetryQuery ? retryFrom : vi.fn().mockReturnValue({ where: notifWhere })
                };
            });

            const { getDb } = await import('@repo/db');
            vi.mocked(getDb).mockReturnValue({
                select: selectSpy,
                update: updateSpy,
                execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
            } as never);

            vi.mocked(getAddonBySlug).mockReturnValue({ slug: 'test' } as never);
            vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValue({
                purchaseId: 'any',
                addonSlug: 'any',
                addonType: 'entitlement',
                outcome: 'success'
            });

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.revocationRetried).toBe(2);
            expect(clearEntitlementCache).toHaveBeenCalledTimes(2);
            expect(clearEntitlementCache).toHaveBeenCalledWith('cust-alpha');
            expect(clearEntitlementCache).toHaveBeenCalledWith('cust-beta');
        });

        it('should do nothing when there are no orphaned active addons', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = buildBaseService();
            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            const { db } = buildMockDb([]); // empty result
            const { getDb } = await import('@repo/db');
            vi.mocked(getDb).mockReturnValue(db as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.revocationRetried).toBe(0);
            expect(result.details?.revocationErrors).toBe(0);
            expect(revokeAddonForSubscriptionCancellation).not.toHaveBeenCalled();
            expect(clearEntitlementCache).not.toHaveBeenCalled();
        });

        it('should still run the expiry and warning phases when retry phase is active', async () => {
            // Arrange: set up a scenario with both expired addons AND an orphaned purchase
            const ctx = createMockContext();
            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: { processed: 2, failed: 0, errors: [] }
                }),
                findExpiringAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                })
            };
            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            const orphanPurchase = {
                id: 'purchase-coexist',
                customerId: 'cust-coexist',
                addonSlug: 'visibility-boost-7d',
                metadata: null
            };

            const updateWhereSpy = vi.fn().mockResolvedValue([]);
            const updateSetSpy = vi.fn().mockReturnValue({ where: updateWhereSpy });
            const updateSpy = vi.fn().mockReturnValue({ set: updateSetSpy });

            const notifWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
            // Phase 4 calls .innerJoin().where().limit(100) — where must return { limit }
            const retryWhere = vi
                .fn()
                .mockReturnValue({ limit: vi.fn().mockResolvedValue([orphanPurchase]) });
            const retryInnerJoin = vi.fn().mockReturnValue({ where: retryWhere });
            const retryFrom = vi.fn().mockReturnValue({ innerJoin: retryInnerJoin });

            const selectSpy = vi.fn().mockImplementation((fields: Record<string, unknown>) => {
                const isRetryQuery = fields && 'addonSlug' in fields;
                return {
                    from: isRetryQuery ? retryFrom : vi.fn().mockReturnValue({ where: notifWhere })
                };
            });

            const { getDb } = await import('@repo/db');
            vi.mocked(getDb).mockReturnValue({
                select: selectSpy,
                update: updateSpy,
                execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
            } as never);

            vi.mocked(getAddonBySlug).mockReturnValue({ slug: 'visibility-boost-7d' } as never);
            vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValue({
                purchaseId: orphanPurchase.id,
                addonSlug: orphanPurchase.addonSlug,
                addonType: 'entitlement',
                outcome: 'success'
            });

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert: existing phases ran AND retry phase ran
            expect(result.success).toBe(true);
            expect(result.details?.expiredAddons).toBe(2);
            expect(result.details?.revocationRetried).toBe(1);
            expect(mockService.processExpiredAddons).toHaveBeenCalledTimes(1);
            expect(mockService.findExpiringAddons).toHaveBeenCalledTimes(2); // 3-day + 1-day
        });

        it('should only log count and not revoke in dry run mode', async () => {
            // Arrange
            const ctx = createMockContext({ dryRun: true });
            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({ success: true, data: [] }),
                findExpiringAddons: vi.fn().mockResolvedValue({ success: true, data: [] })
            };
            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);

            const purchase = {
                id: 'purchase-dryrun',
                customerId: 'cust-dryrun',
                addonSlug: 'visibility-boost-7d',
                metadata: null
            };

            const updateSpy = vi.fn();

            const notifWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
            // Phase 4 calls .innerJoin().where().limit(100) — where must return { limit }
            const retryWhere = vi
                .fn()
                .mockReturnValue({ limit: vi.fn().mockResolvedValue([purchase]) });
            const retryInnerJoin = vi.fn().mockReturnValue({ where: retryWhere });
            const retryFrom = vi.fn().mockReturnValue({ innerJoin: retryInnerJoin });

            const selectSpy = vi.fn().mockImplementation((fields: Record<string, unknown>) => {
                const isRetryQuery = fields && 'addonSlug' in fields;
                return {
                    from: isRetryQuery ? retryFrom : vi.fn().mockReturnValue({ where: notifWhere })
                };
            });

            const { getDb } = await import('@repo/db');
            vi.mocked(getDb).mockReturnValue({
                select: selectSpy,
                update: updateSpy,
                execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
            } as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert: dry run should only log count, not call revoke or update
            expect(result.success).toBe(true);
            expect(result.details?.dryRun).toBe(true);
            expect(revokeAddonForSubscriptionCancellation).not.toHaveBeenCalled();
            expect(updateSpy).not.toHaveBeenCalled();
            expect(clearEntitlementCache).not.toHaveBeenCalled();
            // The dry run path logs an info with the purchaseId
            expect(ctx.logger.info).toHaveBeenCalledWith(
                expect.stringContaining('Dry run mode - would revoke orphaned add-on'),
                expect.objectContaining({ purchaseId: purchase.id })
            );
        });
    });

    // -------------------------------------------------------------------------
    // ADDON_EXPIRED Notification
    // -------------------------------------------------------------------------

    describe('ADDON_EXPIRED Notification', () => {
        it('should send ADDON_EXPIRED notification for each successfully expired add-on', async () => {
            // Arrange
            const ctx = createMockContext();
            const expiredAddon = {
                id: 'purchase-expired-1',
                customerId: 'cust-expired',
                addonSlug: 'extra-listings',
                expiresAt: new Date('2024-06-15T00:00:00Z'),
                subscriptionId: null,
                purchasedAt: new Date('2024-01-01T00:00:00Z'),
                limitAdjustments: [],
                entitlementAdjustments: []
            };

            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: [expiredAddon]
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: { processed: 1, failed: 0, errors: [] }
                }),
                findExpiringAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            vi.mocked(getQZPayBilling).mockReturnValue({ api: 'mock-billing' } as never);
            vi.mocked(getAddonBySlug).mockReturnValue({
                slug: 'extra-listings',
                name: 'Extra Listings'
            } as never);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'expired@example.com',
                name: 'Expired Customer',
                userId: 'user-expired'
            });

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.ADDON_EXPIRED,
                    recipientEmail: 'expired@example.com',
                    recipientName: 'Expired Customer',
                    userId: 'user-expired',
                    customerId: 'cust-expired',
                    addonName: 'Extra Listings',
                    expirationDate: expiredAddon.expiresAt.toISOString()
                })
            );
        });

        it('should not send ADDON_EXPIRED notification when already sent today (idempotency)', async () => {
            // Arrange
            const ctx = createMockContext();
            const expiredAddon = {
                id: 'purchase-expired-idem',
                customerId: 'cust-idem',
                addonSlug: 'featured',
                expiresAt: new Date('2024-06-15T00:00:00Z'),
                subscriptionId: null,
                purchasedAt: new Date('2024-01-01T00:00:00Z'),
                limitAdjustments: [],
                entitlementAdjustments: []
            };

            const mockService = {
                findExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: [expiredAddon]
                }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: { processed: 1, failed: 0, errors: [] }
                }),
                findExpiringAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: []
                })
            };

            vi.mocked(AddonExpirationService).mockImplementation(() => mockService as never);
            vi.mocked(sendNotification).mockResolvedValue(undefined);
            // Include subscriptions so Phase 5 does not throw when it calls billing.subscriptions.get()
            vi.mocked(getQZPayBilling).mockReturnValue({
                api: 'mock-billing',
                subscriptions: {
                    get: vi.fn().mockResolvedValue(null),
                    cancel: vi.fn().mockResolvedValue(undefined)
                }
            } as never);
            vi.mocked(getAddonBySlug).mockReturnValue({
                slug: 'featured',
                name: 'Featured'
            } as never);
            vi.mocked(lookupCustomerDetails).mockResolvedValue({
                email: 'idem@example.com',
                name: 'Idem Customer',
                userId: 'user-idem'
            });

            // Use a custom getDb mock that returns a "already sent" row for wasNotificationSent
            // queries (no addonSlug in fields) but empty results for Phase 4 (innerJoin) and
            // Phase 5/6 (.where().limit() without innerJoin, no addonSlug).
            const alreadySentWhere = vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 'log-already-sent' }])
            });
            const notifFrom = vi.fn().mockReturnValue({ where: alreadySentWhere });

            // Phase 4 (revocation retry): addonSlug in fields, uses innerJoin.where().limit() — empty
            const retryInnerJoin = vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) })
            });
            // Phase 5/6: addonSlug in fields (Phase 6) or not (Phase 5), .where().limit() — empty
            const emptyWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
            const retryFrom = vi.fn().mockReturnValue({
                where: emptyWhere,
                innerJoin: retryInnerJoin
            });

            const selectMock = vi.fn().mockImplementation((fields: Record<string, unknown>) => {
                const isRetryQuery = fields && 'addonSlug' in fields;
                return { from: isRetryQuery ? retryFrom : notifFrom };
            });

            const { getDb } = await import('@repo/db');
            vi.mocked(getDb).mockReturnValue({
                select: selectMock,
                update: vi.fn(),
                execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
            } as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert — notification must NOT be sent because idempotency check returns "already sent"
            expect(result.success).toBe(true);
            expect(sendNotification).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.ADDON_EXPIRED
                })
            );
        });
    });

    describe('Phase 5: DB-QZPay Split State Reconciliation (GAP-043-42)', () => {
        /**
         * Helper: creates a minimal default mock service that passes all phases 1-4
         * so Phase 5 can be tested in isolation.
         */
        function createDefaultMockService() {
            return {
                findExpiredAddons: vi.fn().mockResolvedValue({ success: true, data: [] }),
                processExpiredAddons: vi.fn().mockResolvedValue({
                    success: true,
                    data: { processed: 0, failed: 0, errors: [] }
                }),
                findExpiringAddons: vi.fn().mockResolvedValue({ success: true, data: [] })
            };
        }

        /**
         * Creates a getDb mock whose SELECT chain returns the given subscription rows
         * for the recently-cancelled query (Phase 5) while keeping Phase 1-4 chains working.
         */
        function _mockGetDbWithSplitStateSubs(
            subs: Array<{ id: string; customerId: string; updatedAt: Date }>
        ) {
            const limitMock = vi.fn().mockResolvedValue(subs);
            const whereForPhase5 = vi.fn().mockReturnValue({ limit: limitMock });

            // Phase 4 uses innerJoin().where().limit(100) — where must return { limit }
            const innerJoin = vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) })
            });
            // wasNotificationSent uses .where().limit() — return empty (no prior notification)
            const whereForNotif = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });

            mockDbFrom.mockImplementation((table: unknown) => {
                // Phase 5 queries billingSubscriptions table (no innerJoin, has limit)
                if (table === 'status') {
                    return { where: whereForPhase5, innerJoin };
                }
                return { where: whereForNotif, innerJoin };
            });

            return { limitMock, whereForPhase5 };
        }

        it('should reconcile split-state subscription when QZPay is active', async () => {
            // Arrange
            const ctx = createMockContext();
            vi.mocked(AddonExpirationService).mockImplementation(
                () => createDefaultMockService() as never
            );

            const splitSub = {
                id: 'sub-split-1',
                customerId: 'cust-split-1',
                updatedAt: new Date()
            };

            // Phase 5: recently-cancelled query returns our split-state sub
            const limitMock = vi.fn().mockResolvedValue([splitSub]);
            const whereLimitChain = vi.fn().mockReturnValue({ limit: limitMock });
            // Phase 4 calls .innerJoin().where().limit(100) — the inner where must return { limit }
            const innerJoinEmpty = vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) })
            });

            mockDbFrom.mockReturnValue({ where: whereLimitChain, innerJoin: innerJoinEmpty });

            // Billing mock: QZPay returns active status, cancel succeeds
            const cancelMock = vi.fn().mockResolvedValue(undefined);
            const getMock = vi.fn().mockResolvedValue({ status: 'active' });
            vi.mocked(getQZPayBilling).mockReturnValue({
                subscriptions: { get: getMock, cancel: cancelMock }
            } as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.splitStateReconciled).toBe(1);
            expect(result.details?.splitStateErrors).toBe(0);
            expect(cancelMock).toHaveBeenCalledWith(
                'sub-split-1',
                expect.objectContaining({
                    cancelAtPeriodEnd: false
                })
            );
        });

        it('should skip reconciliation when QZPay status is already cancelled', async () => {
            // Arrange
            const ctx = createMockContext();
            vi.mocked(AddonExpirationService).mockImplementation(
                () => createDefaultMockService() as never
            );

            const splitSub = {
                id: 'sub-already-cancelled',
                customerId: 'cust-already-cancelled',
                updatedAt: new Date()
            };

            const limitMock = vi.fn().mockResolvedValue([splitSub]);
            const whereLimitChain = vi.fn().mockReturnValue({ limit: limitMock });
            // Phase 4 calls .innerJoin().where().limit(100) — the inner where must return { limit }
            const innerJoinEmpty = vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) })
            });
            mockDbFrom.mockReturnValue({ where: whereLimitChain, innerJoin: innerJoinEmpty });

            const cancelMock = vi.fn();
            const getMock = vi.fn().mockResolvedValue({ status: 'canceled' });
            vi.mocked(getQZPayBilling).mockReturnValue({
                subscriptions: { get: getMock, cancel: cancelMock }
            } as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(cancelMock).not.toHaveBeenCalled();
            expect(result.details?.splitStateReconciled).toBe(0);
        });

        it('should handle QZPay errors gracefully without failing the job', async () => {
            // Arrange
            const ctx = createMockContext();
            vi.mocked(AddonExpirationService).mockImplementation(
                () => createDefaultMockService() as never
            );

            const splitSub = {
                id: 'sub-error',
                customerId: 'cust-error',
                updatedAt: new Date()
            };

            const limitMock = vi.fn().mockResolvedValue([splitSub]);
            const whereLimitChain = vi.fn().mockReturnValue({ limit: limitMock });
            // Phase 4 calls .innerJoin().where().limit(100) — the inner where must return { limit }
            const innerJoinEmpty = vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) })
            });
            mockDbFrom.mockReturnValue({ where: whereLimitChain, innerJoin: innerJoinEmpty });

            const getMock = vi.fn().mockRejectedValue(new Error('QZPay unavailable'));
            vi.mocked(getQZPayBilling).mockReturnValue({
                subscriptions: { get: getMock }
            } as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert: job still succeeds, error is counted
            expect(result.success).toBe(true);
            expect(result.details?.splitStateErrors).toBe(1);
        });

        it('should not call cancel in dry-run mode', async () => {
            // Arrange
            const ctx = createMockContext({ dryRun: true });
            vi.mocked(AddonExpirationService).mockImplementation(
                () => createDefaultMockService() as never
            );

            const splitSub = {
                id: 'sub-dry-run',
                customerId: 'cust-dry-run',
                updatedAt: new Date()
            };

            const limitMock = vi.fn().mockResolvedValue([splitSub]);
            const whereLimitChain = vi.fn().mockReturnValue({ limit: limitMock });
            // Phase 4 calls .innerJoin().where().limit(100) — the inner where must return { limit }
            const innerJoinEmpty = vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) })
            });
            mockDbFrom.mockReturnValue({ where: whereLimitChain, innerJoin: innerJoinEmpty });

            const cancelMock = vi.fn();
            const getMock = vi.fn().mockResolvedValue({ status: 'active' });
            vi.mocked(getQZPayBilling).mockReturnValue({
                subscriptions: { get: getMock, cancel: cancelMock }
            } as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(cancelMock).not.toHaveBeenCalled();
            expect(result.details?.dryRun).toBe(true);
        });

        it('should skip subscription with null QZPay response', async () => {
            // Arrange
            const ctx = createMockContext();
            vi.mocked(AddonExpirationService).mockImplementation(
                () => createDefaultMockService() as never
            );

            const splitSub = {
                id: 'sub-null',
                customerId: 'cust-null',
                updatedAt: new Date()
            };

            const limitMock = vi.fn().mockResolvedValue([splitSub]);
            const whereLimitChain = vi.fn().mockReturnValue({ limit: limitMock });
            // Phase 4 calls .innerJoin().where().limit(100) — the inner where must return { limit }
            const innerJoinEmpty = vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) })
            });
            mockDbFrom.mockReturnValue({ where: whereLimitChain, innerJoin: innerJoinEmpty });

            const cancelMock = vi.fn();
            // QZPay returns null (subscription deleted/not found)
            const getMock = vi.fn().mockResolvedValue(null);
            vi.mocked(getQZPayBilling).mockReturnValue({
                subscriptions: { get: getMock, cancel: cancelMock }
            } as never);

            // Act
            const result = await addonExpiryJob.handler(ctx);

            // Assert
            expect(cancelMock).not.toHaveBeenCalled();
            expect(result.details?.splitStateReconciled).toBe(0);
        });
    });
});
