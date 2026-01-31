/**
 * Unit Tests: Trial Expiry Cron Job Handler
 *
 * Tests the trial-expiry job handler that processes expired trials.
 *
 * Test Coverage:
 * - Processes expired trials successfully
 * - Handles no expired trials gracefully
 * - Returns correct CronJobResult structure
 * - Error handling during trial processing
 * - Dry run mode behavior
 * - Billing not configured scenario
 * - Batch processing behavior
 *
 * @module test/cron/trial-expiry
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trialExpiryJob } from '../../src/cron/jobs/trial-expiry';
import type { CronJobContext } from '../../src/cron/types';

// Mock billing middleware
vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

// Mock TrialService
vi.mock('../../src/services/trial.service', () => ({
    TrialService: vi.fn()
}));

// Import mocked modules after mocking
import { getQZPayBilling } from '../../src/middlewares/billing';
import { TrialService } from '../../src/services/trial.service';

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
        startedAt: new Date('2024-06-15T02:00:00Z'),
        dryRun: false,
        ...overrides
    };
}

describe('Trial Expiry Cron Job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Job Definition', () => {
        it('should have correct job metadata', () => {
            expect(trialExpiryJob.name).toBe('trial-expiry');
            expect(trialExpiryJob.description).toBe(
                'Check and expire trials that have passed their end date'
            );
            expect(trialExpiryJob.schedule).toBe('0 2 * * *');
            expect(trialExpiryJob.enabled).toBe(true);
            expect(trialExpiryJob.timeoutMs).toBe(300000);
        });
    });

    describe('Successful Processing', () => {
        it('should process expired trials successfully', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({
                        data: []
                    })
                }
            };
            const mockTrialService = {
                blockExpiredTrials: vi.fn().mockResolvedValue(5)
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            const result = await trialExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain('Successfully expired 5 trial subscriptions');
            expect(result.processed).toBe(5);
            expect(result.errors).toBe(0);
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
            expect(result.details?.blockedCount).toBe(5);
            expect(mockTrialService.blockExpiredTrials).toHaveBeenCalledTimes(1);
        });

        it('should handle no expired trials gracefully', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({
                        data: []
                    })
                }
            };
            const mockTrialService = {
                blockExpiredTrials: vi.fn().mockResolvedValue(0)
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            const result = await trialExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain('Successfully expired 0 trial subscriptions');
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
        });
    });

    describe('Dry Run Mode', () => {
        it('should count expired trials without processing in dry-run mode', async () => {
            // Arrange
            const ctx = createMockContext({ dryRun: true });
            const now = new Date('2024-06-15T02:00:00Z');
            const expiredTrialEnd = new Date('2024-06-14T00:00:00Z');
            const activeTrialEnd = new Date('2024-06-20T00:00:00Z');

            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({
                        data: [
                            {
                                id: 'sub-1',
                                status: 'trialing',
                                customerId: 'cust-1',
                                trialEnd: expiredTrialEnd
                            },
                            {
                                id: 'sub-2',
                                status: 'trialing',
                                customerId: 'cust-2',
                                trialEnd: expiredTrialEnd
                            },
                            {
                                id: 'sub-3',
                                status: 'trialing',
                                customerId: 'cust-3',
                                trialEnd: activeTrialEnd
                            },
                            {
                                id: 'sub-4',
                                status: 'active',
                                customerId: 'cust-4',
                                trialEnd: expiredTrialEnd
                            }
                        ]
                    })
                }
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);

            // Mock Date.now for consistent timing
            const originalNow = Date.now;
            Date.now = vi.fn(() => now.getTime());

            // Act
            const result = await trialExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain('Dry run - Would expire 2 trial subscriptions');
            expect(result.processed).toBe(2);
            expect(result.errors).toBe(0);
            expect(result.details?.dryRun).toBe(true);
            expect(result.details?.totalSubscriptions).toBe(4);

            // Restore Date.now
            Date.now = originalNow;
        });

        it('should handle no expired trials in dry-run mode', async () => {
            // Arrange
            const ctx = createMockContext({ dryRun: true });
            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({
                        data: []
                    })
                }
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);

            // Act
            const result = await trialExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain('Dry run - No subscriptions found');
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle billing service errors gracefully', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({
                        data: []
                    })
                }
            };
            const mockTrialService = {
                blockExpiredTrials: vi
                    .fn()
                    .mockRejectedValue(new Error('Database connection failed'))
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            const result = await trialExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to check expired trials');
            expect(result.message).toContain('Database connection failed');
            expect(result.errors).toBe(1);
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
            expect(result.details?.error).toBe('Database connection failed');
        });

        it('should handle non-Error exceptions', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({
                        data: []
                    })
                }
            };
            const mockTrialService = {
                blockExpiredTrials: vi.fn().mockRejectedValue('Unknown error')
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            const result = await trialExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to check expired trials');
            expect(result.errors).toBe(1);
        });
    });

    describe('Billing Not Configured', () => {
        it('should skip processing when billing is not configured', async () => {
            // Arrange
            const ctx = createMockContext();
            vi.mocked(getQZPayBilling).mockReturnValue(null);

            // Act
            const result = await trialExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toBe('Skipped - Billing not configured');
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(ctx.logger.warn).toHaveBeenCalledWith(
                'Billing not configured, skipping trial expiry check'
            );
        });
    });

    describe('Result Structure', () => {
        it('should return correctly structured CronJobResult', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({
                        data: []
                    })
                }
            };
            const mockTrialService = {
                blockExpiredTrials: vi.fn().mockResolvedValue(3)
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            const result = await trialExpiryJob.handler(ctx);

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
                    blockedCount: expect.any(Number)
                });
            }
        });
    });

    describe('Logging', () => {
        it('should log appropriate messages during execution', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({
                        data: []
                    })
                }
            };
            const mockTrialService = {
                blockExpiredTrials: vi.fn().mockResolvedValue(2)
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(() => mockTrialService as any);

            // Act
            await trialExpiryJob.handler(ctx);

            // Assert
            expect(ctx.logger.info).toHaveBeenCalledWith('Starting trial expiry check', {
                dryRun: false,
                startedAt: expect.any(String)
            });
            expect(ctx.logger.info).toHaveBeenCalledWith(
                'Running in production mode - expiring trials'
            );
            expect(ctx.logger.info).toHaveBeenCalledWith('Trial expiry check completed', {
                blockedCount: 2,
                durationMs: expect.any(Number)
            });
        });
    });
});
