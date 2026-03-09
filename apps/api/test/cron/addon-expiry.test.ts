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

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        select: mockDbSelect
    })),
    billingNotificationLog: {
        id: 'id',
        type: 'type',
        customerId: 'customer_id',
        createdAt: 'created_at'
    },
    eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    gte: vi.fn((...args: unknown[]) => ({ op: 'gte', args }))
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

import { getQZPayBilling } from '../../src/middlewares/billing';
import { AddonExpirationService } from '../../src/services/addon-expiration.service';
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

        // Set up default DB chain for wasNotificationSent: returns empty (no prior notification)
        mockDbLimit.mockResolvedValue([]);
        mockDbWhere.mockReturnValue({ limit: mockDbLimit });
        mockDbFrom.mockReturnValue({ where: mockDbWhere });
        mockDbSelect.mockReturnValue({ from: mockDbFrom });
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
            expect(ctx.logger.debug).toHaveBeenCalled();
        });
    });

    describe('Result Structure', () => {
        it('should return correctly structured CronJobResult', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockService = {
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
});
