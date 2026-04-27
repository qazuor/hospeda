/**
 * Tests for the Conversation Token Cleanup Cron Job
 *
 * Mocking strategy: mocks @repo/db (withTransaction + getDb) so no real DB
 * is needed.
 *
 * Test scenarios:
 * - Job configuration (name, schedule, enabled flag)
 * - Advisory lock not acquired (skipped)
 * - Dry run mode (counts but does not update)
 * - Bulk revoke (processed = count of updated rows)
 * - Zero expired tokens (processed = 0)
 * - Unhandled error returns failure
 *
 * @module test/cron/conversation-token-cleanup
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (factories must NOT reference module-level variables)
// ---------------------------------------------------------------------------

const { mockWithTransaction, mockUpdate, mockSelect } = vi.hoisted(() => {
    const mockWithTransaction = vi.fn();
    const mockUpdateSetWhereReturning = vi.fn();
    const mockUpdateSetWhere = vi.fn().mockReturnValue({ returning: mockUpdateSetWhereReturning });
    const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateSetWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });
    const mockSelectFromWhere = vi.fn();
    const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectFromWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });
    return { mockWithTransaction, mockUpdate, mockSelect };
});

vi.mock('@repo/db', () => ({
    withTransaction: mockWithTransaction,
    getDb: vi.fn().mockReturnValue({
        update: mockUpdate,
        select: mockSelect
    }),
    sql: vi.fn((strings: TemplateStringsArray) => ({ sql: strings.join('') })),
    conversationAccessTokens: {
        id: 'id',
        expiresAt: 'expiresAt',
        revokedAt: 'revokedAt'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ and: args })),
    lte: vi.fn((col: unknown, val: unknown) => ({ lte: { col, val } })),
    isNull: vi.fn((col: unknown) => ({ isNull: col }))
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

import { conversationTokenCleanupJob } from '../../src/cron/jobs/conversation-token-cleanup.job.js';
import type { CronJobContext } from '../../src/cron/types.js';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('Conversation Token Cleanup Cron Job', () => {
    let mockLogger: {
        info: Mock;
        warn: Mock;
        error: Mock;
        debug: Mock;
    };
    let mockContext: CronJobContext;

    // Helpers to reset mock chains between tests
    const resetUpdateChain = (rows: Array<{ id: string }> = []) => {
        const mockReturning = vi.fn().mockResolvedValue(rows);
        const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
        const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
        mockUpdate.mockReturnValue({ set: mockSet });
    };

    const resetSelectChain = (rows: Array<{ id: string }> = []) => {
        const mockWhere = vi.fn().mockResolvedValue(rows);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockSelect.mockReturnValue({ from: mockFrom });
    };

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        };

        mockContext = {
            logger: mockLogger,
            startedAt: new Date('2025-01-01T03:00:00Z'),
            dryRun: false
        };

        // Default: transaction executes callback inline (lock acquired)
        mockWithTransaction.mockImplementation(
            async (callback: (tx: unknown) => Promise<unknown>) => {
                const fakeTx = {
                    execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
                };
                return callback(fakeTx);
            }
        );

        // Default: update returns 2 revoked tokens
        resetUpdateChain([{ id: 'token-1' }, { id: 'token-2' }]);

        // Default: select returns empty (dry-run count)
        resetSelectChain([]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Job configuration
    // -------------------------------------------------------------------------

    describe('Job Configuration', () => {
        it('has the correct job name', () => {
            expect(conversationTokenCleanupJob.name).toBe('conversation-token-cleanup');
        });

        it('runs daily at 03:00 UTC', () => {
            expect(conversationTokenCleanupJob.schedule).toBe('0 3 * * *');
        });

        it('is enabled', () => {
            expect(conversationTokenCleanupJob.enabled).toBe(true);
        });

        it('has a handler function', () => {
            expect(typeof conversationTokenCleanupJob.handler).toBe('function');
        });

        it('has a 1-minute timeout', () => {
            expect(conversationTokenCleanupJob.timeoutMs).toBe(60000);
        });
    });

    // -------------------------------------------------------------------------
    // Advisory lock
    // -------------------------------------------------------------------------

    describe('Advisory lock', () => {
        it('skips execution when advisory lock is not acquired', async () => {
            mockWithTransaction.mockImplementation(
                async (callback: (tx: unknown) => Promise<unknown>) => {
                    const fakeTx = {
                        execute: vi.fn().mockResolvedValue({ rows: [{ acquired: false }] })
                    };
                    return callback(fakeTx);
                }
            );

            const result = await conversationTokenCleanupJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.message).toContain('Skipped');
        });
    });

    // -------------------------------------------------------------------------
    // Dry run
    // -------------------------------------------------------------------------

    describe('Dry run mode', () => {
        it('counts expired tokens without revoking them', async () => {
            resetSelectChain([{ id: 'token-1' }, { id: 'token-2' }, { id: 'token-3' }]);

            const dryRunContext: CronJobContext = { ...mockContext, dryRun: true };
            const result = await conversationTokenCleanupJob.handler(dryRunContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0); // dry run: no actual update
            expect(result.message).toContain('Dry run');
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('includes wouldRevoke count in details', async () => {
            resetSelectChain([{ id: 'token-1' }, { id: 'token-2' }]);

            const dryRunContext: CronJobContext = { ...mockContext, dryRun: true };
            const result = await conversationTokenCleanupJob.handler(dryRunContext);

            expect(result.details?.wouldRevoke).toBe(2);
        });
    });

    // -------------------------------------------------------------------------
    // Successful revocation
    // -------------------------------------------------------------------------

    describe('Bulk revocation', () => {
        it('revokes all expired tokens and returns correct processed count', async () => {
            resetUpdateChain([{ id: 'token-1' }, { id: 'token-2' }]);

            const result = await conversationTokenCleanupJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(2);
            expect(result.errors).toBe(0);
            expect(result.message).toContain('2');
        });

        it('returns processed = 0 when no tokens are expired', async () => {
            resetUpdateChain([]);

            const result = await conversationTokenCleanupJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
        });

        it('includes duration in result', async () => {
            const result = await conversationTokenCleanupJob.handler(mockContext);

            expect(result.durationMs).toBeGreaterThanOrEqual(0);
        });

        it('includes revokedCount in details', async () => {
            resetUpdateChain([{ id: 't1' }, { id: 't2' }]);

            const result = await conversationTokenCleanupJob.handler(mockContext);

            expect(result.details?.revokedCount).toBe(2);
        });
    });

    // -------------------------------------------------------------------------
    // Unhandled error
    // -------------------------------------------------------------------------

    describe('Unhandled error', () => {
        it('catches unexpected exceptions and returns failure', async () => {
            mockWithTransaction.mockRejectedValue(new Error('DB connection lost'));

            const result = await conversationTokenCleanupJob.handler(mockContext);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed');
            expect(result.errors).toBeGreaterThan(0);
        });

        it('logs the error details', async () => {
            const testError = new Error('Catastrophic failure');
            mockWithTransaction.mockRejectedValue(testError);

            await conversationTokenCleanupJob.handler(mockContext);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('unhandled error'),
                expect.objectContaining({ error: 'Catastrophic failure' })
            );
        });
    });
});
