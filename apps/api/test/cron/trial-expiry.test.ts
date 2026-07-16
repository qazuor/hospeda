/**
 * Unit Tests: Trial Reconciliation Cron Job Handler
 *
 * Tests the `trial-reconcile` job handler that settles elapsed trials
 * against the payment provider (HOS-171: card-first trials, provider
 * verdict decides the outcome — convert, defer to dunning, or mirror a
 * cancellation/pause. Never a blind cancel-at-expiry).
 *
 * Test Coverage:
 * - Reconciles elapsed trials successfully
 * - Handles zero elapsed trials gracefully
 * - Returns correct CronJobResult structure
 * - Error handling during reconciliation
 * - Dry run mode behavior
 * - Billing not configured scenario
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

// Mock qzpay-logger (passed into createMercadoPagoAdapter)
vi.mock('../../src/lib/qzpay-logger.js', () => ({
    qzpayLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock @repo/billing's createMercadoPagoAdapter: the reconcile job builds its
// own MP adapter (mirroring subscription-poll.job.ts / webhook-retry.job.ts)
// so it can call the MercadoPago-typed subscriptions.retrieve(). The stub
// returned here is what TrialService.reconcileExpiredTrials receives as
// `paymentAdapter` — its shape doesn't matter for these job-level tests
// since TrialService itself is mocked, but it must exist so the real
// createMercadoPagoAdapter (which reads env vars and throws if missing) is
// never called.
const mockPaymentAdapter = {
    subscriptions: { retrieve: vi.fn() }
};
const mockCreateMercadoPagoAdapter = vi.fn((..._args: unknown[]) => mockPaymentAdapter);

vi.mock('@repo/billing', () => ({
    createMercadoPagoAdapter: (...args: unknown[]) => mockCreateMercadoPagoAdapter(...args)
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

describe('Trial Reconciliation Cron Job (HOS-171)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Job Definition', () => {
        it('should have correct job metadata', () => {
            expect(trialExpiryJob.name).toBe('trial-reconcile');
            expect(trialExpiryJob.description).toBe(
                'Reconcile elapsed trials against the payment provider (converts, never cancels)'
            );
            expect(trialExpiryJob.schedule).toBe('0 2 * * *');
            expect(trialExpiryJob.enabled).toBe(true);
            expect(trialExpiryJob.timeoutMs).toBe(300000);
        });
    });

    describe('Successful Processing', () => {
        it('should reconcile elapsed trials successfully', async () => {
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
                reconcileExpiredTrials: vi.fn().mockResolvedValue(5)
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(function () {
                return mockTrialService as any;
            });

            // Act
            const result = await trialExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain(
                'Successfully reconciled 5 elapsed trial subscriptions'
            );
            expect(result.processed).toBe(5);
            expect(result.errors).toBe(0);
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
            expect(result.details?.reconciledCount).toBe(5);
            expect(mockTrialService.reconcileExpiredTrials).toHaveBeenCalledTimes(1);
            // The reconciler must receive the MP adapter built from @repo/billing.
            expect(mockTrialService.reconcileExpiredTrials).toHaveBeenCalledWith({
                paymentAdapter: mockPaymentAdapter
            });
            expect(mockCreateMercadoPagoAdapter).toHaveBeenCalledTimes(1);
        });

        it('should handle zero elapsed trials gracefully', async () => {
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
                reconcileExpiredTrials: vi.fn().mockResolvedValue(0)
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(function () {
                return mockTrialService as any;
            });

            // Act
            const result = await trialExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain(
                'Successfully reconciled 0 elapsed trial subscriptions'
            );
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
        });

        // AC-6 (HOS-171): the cron must never cancel — TrialService owns that
        // decision, but the job-level contract asserts the constructor no
        // longer accepts (or requires) any cancellation-adjacent wiring, i.e.
        // TrialService is constructed with exactly the billing instance.
        it('constructs TrialService with only the billing instance (no notification sender)', async () => {
            // Arrange
            const ctx = createMockContext();
            const mockBilling = {
                subscriptions: {
                    list: vi.fn().mockResolvedValue({ data: [] })
                }
            };
            const mockTrialService = {
                reconcileExpiredTrials: vi.fn().mockResolvedValue(0)
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(function () {
                return mockTrialService as any;
            });

            // Act
            await trialExpiryJob.handler(ctx);

            // Assert — single constructor arg (the billing instance)
            expect(TrialService).toHaveBeenCalledOnce();
            expect(TrialService).toHaveBeenCalledWith(mockBilling);
        });
    });

    describe('Dry Run Mode', () => {
        it('should count elapsed trials without reconciling in dry-run mode', async () => {
            // Arrange
            const ctx = createMockContext({ dryRun: true });
            const now = new Date('2024-06-15T02:00:00Z');
            const expiredTrialEnd = new Date('2024-06-14T00:00:00Z');
            const activeTrialEnd = new Date('2024-06-20T00:00:00Z');

            // Use fake timers to control Date
            vi.useFakeTimers();
            vi.setSystemTime(now);

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

            // Act
            const result = await trialExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain(
                'Dry run - Would reconcile 2 elapsed trial subscriptions'
            );
            expect(result.processed).toBe(2);
            expect(result.errors).toBe(0);
            expect(result.details?.dryRun).toBe(true);
            expect(result.details?.totalSubscriptions).toBe(4);
            // Dry run never builds a live MP adapter — no provider calls happen.
            expect(mockCreateMercadoPagoAdapter).not.toHaveBeenCalled();

            // Restore real timers
            vi.useRealTimers();
        });

        it('should handle no subscriptions in dry-run mode', async () => {
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
        it('should handle reconciliation errors gracefully', async () => {
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
                reconcileExpiredTrials: vi
                    .fn()
                    .mockRejectedValue(new Error('Database connection failed'))
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(function () {
                return mockTrialService as any;
            });

            // Act
            const result = await trialExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to reconcile elapsed trials');
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
                reconcileExpiredTrials: vi.fn().mockRejectedValue('Unknown error')
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(function () {
                return mockTrialService as any;
            });

            // Act
            const result = await trialExpiryJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to reconcile elapsed trials');
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
                'Billing not configured, skipping trial reconciliation'
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
                reconcileExpiredTrials: vi.fn().mockResolvedValue(3)
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(function () {
                return mockTrialService as any;
            });

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
                    reconciledCount: expect.any(Number)
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
                reconcileExpiredTrials: vi.fn().mockResolvedValue(2)
            };

            vi.mocked(getQZPayBilling).mockReturnValue(mockBilling as any);
            vi.mocked(TrialService).mockImplementation(function () {
                return mockTrialService as any;
            });

            // Act
            await trialExpiryJob.handler(ctx);

            // Assert
            expect(ctx.logger.info).toHaveBeenCalledWith('Starting trial reconciliation', {
                dryRun: false,
                startedAt: expect.any(String)
            });
            expect(ctx.logger.info).toHaveBeenCalledWith(
                'Running in production mode - reconciling elapsed trials'
            );
            expect(ctx.logger.info).toHaveBeenCalledWith('Trial reconciliation completed', {
                reconciledCount: 2,
                durationMs: expect.any(Number)
            });
        });
    });
});
