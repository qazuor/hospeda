/**
 * Tests for the Conversation Token Reminder Cron Job
 *
 * Mocking strategy: mocks @repo/db, @repo/service-core, @repo/email, and
 * @repo/notifications so no real DB or email is needed. `resolveTokenContext`
 * runs for REAL (imported, not mocked) against a fake `db`/`AccommodationModel`
 * pair, mirroring the technique used for `resolveNotification` in
 * `conversation-notification.job.test.ts`.
 *
 * Test scenarios:
 * - Job configuration (name, schedule, enabled flag, no advisory lock)
 * - Dry run mode (skips email, returns wouldProcess counts, no sends/stamps)
 * - Empty due lists for both windows (processed = 0)
 * - findDueReminders error path (per window)
 * - Missing HOSPEDA_EMAIL_API_KEY → skips dispatch
 * - Unhandled exception → failure result
 * - HOS-129: `sendEmail` never runs while a write transaction is open, and no
 *   `pg_try_advisory_xact_lock` (or any other raw) statement is ever executed
 *   anywhere in this job — the advisory lock was REMOVED entirely (AC-1/AC-3)
 * - HOS-129: a successful send persists exactly one `markReminderSent` stamp
 *   for that token/reminderType (AC-2)
 * - HOS-129: a failed send does NOT persist a stamp and is counted as an error
 * - HOS-129: a `markReminderSent` failure (or throw) AFTER a successful send is
 *   counted as an error, logged, and does not propagate/rethrow (AC-4)
 * - HOS-129: both day15 and day25 windows are processed in a normal run (AC-5)
 *
 * Resolve-branch coverage (conversation deleted, no anonymousEmail,
 * accommodation missing) lives in
 * `apps/api/test/cron/conversation-token-reminder.resolve.test.ts`.
 *
 * @module test/cron/conversation-token-reminder
 */

import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (factories must NOT reference module-level variables)
// ---------------------------------------------------------------------------

const {
    mockWithTransaction,
    mockFindDueReminders,
    mockMarkReminderSent,
    mockSendEmail,
    mockAccommodationFindById,
    dbRowsState,
    txOpenState
} = vi.hoisted(() => {
    const dbRowsState = {
        conversationsById: new Map<string, Record<string, unknown>>(),
        accommodationsById: new Map<string, Record<string, unknown>>()
    };
    const txOpenState = { open: false };

    const mockAccommodationFindById = vi.fn(async (id: string) => {
        return dbRowsState.accommodationsById.get(id) ?? null;
    });

    return {
        mockWithTransaction: vi.fn(),
        mockFindDueReminders: vi.fn(),
        mockMarkReminderSent: vi.fn(),
        mockSendEmail: vi.fn(),
        mockAccommodationFindById,
        dbRowsState,
        txOpenState
    };
});

vi.mock('@repo/service-core', () => ({
    AccessTokenService: vi.fn().mockImplementation(function () {
        return {
            findDueReminders: mockFindDueReminders,
            markReminderSent: mockMarkReminderSent
        };
    })
}));

vi.mock('@repo/email', () => ({
    createEmailClient: vi.fn().mockReturnValue({}),
    sendEmail: mockSendEmail
}));

vi.mock('@repo/notifications', () => ({
    ConversationTokenExpiringDay15: vi.fn().mockReturnValue({ type: 'mock-day15-template' }),
    ConversationTokenExpiringDay25: vi.fn().mockReturnValue({ type: 'mock-day25-template' })
}));

vi.mock('@repo/db', () => {
    const conversationsTableRef = { id: 'id', deletedAt: 'deletedAt' };

    /** Extracts the id compared via `eq(...)`, possibly wrapped in `and(...)`. */
    const extractEqVal = (whereClause: unknown): string | undefined => {
        const clause = whereClause as { and?: unknown[]; eq?: { val?: string } };
        if (clause?.and) {
            const eqEntry = clause.and.find(
                (entry): entry is { eq: { val?: string } } =>
                    typeof entry === 'object' && entry !== null && 'eq' in entry
            );
            return eqEntry?.eq?.val;
        }
        return clause?.eq?.val;
    };

    return {
        withTransaction: mockWithTransaction,
        getDb: vi.fn().mockImplementation(() => ({
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn((whereClause: unknown) => ({
                        limit: vi.fn().mockImplementation(async () => {
                            const conversationId = extractEqVal(whereClause);
                            const row = conversationId
                                ? dbRowsState.conversationsById.get(conversationId)
                                : undefined;
                            return row ? [row] : [];
                        })
                    }))
                }))
            }))
        })),
        conversations: conversationsTableRef,
        AccommodationModel: vi.fn().mockImplementation(function () {
            return { findById: mockAccommodationFindById };
        })
    };
});

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ and: args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ eq: { col, val } })),
    isNull: vi.fn((col: unknown) => ({ isNull: col }))
}));

vi.mock('../../src/utils/env.js', () => ({
    env: {
        HOSPEDA_EMAIL_API_KEY: 'test-resend-key',
        HOSPEDA_SITE_URL: 'https://hospeda.test'
    }
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

import { conversationTokenReminderJob } from '../../src/cron/jobs/conversation-token-reminder.job.js';
import type { CronJobContext } from '../../src/cron/types.js';
import { env } from '../../src/utils/env.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Seeds a fully-resolvable token: conversation + accommodation. Returns the
 * "due token" row object to hand to `mockFindDueReminders`.
 */
function seedResolvableToken(params: {
    tokenId: string;
    conversationId: string;
    accommodationId: string;
    recipientEmail: string;
    daysUntilExpiry?: number;
}) {
    const {
        tokenId,
        conversationId,
        accommodationId,
        recipientEmail,
        daysUntilExpiry = 15
    } = params;

    dbRowsState.conversationsById.set(conversationId, {
        id: conversationId,
        accommodationId,
        anonymousEmail: recipientEmail,
        anonymousName: 'Test Guest',
        locale: 'es',
        deletedAt: null
    });
    dbRowsState.accommodationsById.set(accommodationId, {
        id: accommodationId,
        name: 'Test Accommodation',
        slug: 'test-accommodation'
    });

    return {
        id: tokenId,
        conversationId,
        tokenHash: `hash-${tokenId}`,
        expiresAt: new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000),
        revokedAt: null,
        day15ReminderSentAt: null,
        day25ReminderSentAt: null,
        createdAt: new Date()
    };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('Conversation Token Reminder Cron Job', () => {
    let mockLogger: {
        info: Mock;
        warn: Mock;
        error: Mock;
        debug: Mock;
    };
    let mockContext: CronJobContext;

    /**
     * Default `withTransaction` mock: tracks whether a write transaction is
     * open (via `txOpenState`) for the AC-1 boundary assertion, and provides
     * a `fakeTx.execute` spy so any test can assert it was NEVER called with
     * a `pg_try_advisory_xact_lock` statement — there is no advisory lock in
     * this job anymore (HOS-129), so `execute` should simply never be
     * invoked by production code. Invoked once PER token (inside the
     * per-window dispatch loop), not once for the whole batch.
     */
    const acquiredTransaction = async (callback: (tx: unknown) => Promise<unknown>) => {
        txOpenState.open = true;
        try {
            const fakeTx = { execute: vi.fn().mockResolvedValue({ rows: [] }) };
            return await callback(fakeTx);
        } finally {
            txOpenState.open = false;
        }
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
            startedAt: new Date('2025-01-01T09:00:00Z'),
            dryRun: false
        };

        dbRowsState.conversationsById.clear();
        dbRowsState.accommodationsById.clear();
        txOpenState.open = false;

        mockWithTransaction.mockImplementation(acquiredTransaction);
        mockFindDueReminders.mockResolvedValue({ data: [], error: null });
        mockMarkReminderSent.mockResolvedValue({ data: {}, error: null });
        mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-abc' });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Job configuration
    // -------------------------------------------------------------------------

    describe('Job Configuration', () => {
        it('has the correct job name', () => {
            expect(conversationTokenReminderJob.name).toBe('conversation-token-reminder');
        });

        it('runs daily at 09:00 UTC', () => {
            expect(conversationTokenReminderJob.schedule).toBe('0 9 * * *');
        });

        it('is enabled', () => {
            expect(conversationTokenReminderJob.enabled).toBe(true);
        });

        it('has a handler function', () => {
            expect(typeof conversationTokenReminderJob.handler).toBe('function');
        });

        it('has a 2-minute timeout', () => {
            expect(conversationTokenReminderJob.timeoutMs).toBe(120000);
        });
    });

    // -------------------------------------------------------------------------
    // Dry run
    // -------------------------------------------------------------------------

    describe('Dry run mode', () => {
        it('does not send emails or persist stamps in dry run', async () => {
            const token = seedResolvableToken({
                tokenId: 'token-dry',
                conversationId: 'conv-dry',
                accommodationId: 'acc-dry',
                recipientEmail: 'guest@example.com'
            });
            mockFindDueReminders.mockResolvedValueOnce({ data: [token], error: null });
            mockFindDueReminders.mockResolvedValueOnce({ data: [], error: null });

            const dryRunContext: CronJobContext = { ...mockContext, dryRun: true };
            const result = await conversationTokenReminderJob.handler(dryRunContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.message).toContain('Dry run');
            expect(mockSendEmail).not.toHaveBeenCalled();
            expect(mockMarkReminderSent).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // No due reminders
    // -------------------------------------------------------------------------

    describe('Empty due lists', () => {
        it('returns success with processed = 0 when no tokens are due in either window', async () => {
            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // Batch limit (HOS-133)
    // -------------------------------------------------------------------------

    describe('Batch limit', () => {
        it('passes the batch cap to findDueReminders for both windows so it is enforced as a SQL LIMIT, not a JS slice', async () => {
            await conversationTokenReminderJob.handler(mockContext);

            // The cap must reach the service (and thence the model's ORDER BY
            // expires_at ASC LIMIT n) for both windows so overflow tokens drain
            // deterministically instead of being non-deterministically starved.
            expect(mockFindDueReminders).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ reminderType: 'day15', limit: 200 })
            );
            expect(mockFindDueReminders).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ reminderType: 'day25', limit: 200 })
            );
        });
    });

    // -------------------------------------------------------------------------
    // findDueReminders error
    // -------------------------------------------------------------------------

    describe('findDueReminders service error', () => {
        it('logs the error and continues with an empty batch for that window', async () => {
            mockFindDueReminders.mockResolvedValueOnce({
                data: null,
                error: { code: 'INTERNAL_ERROR', message: 'DB connection lost' }
            });
            mockFindDueReminders.mockResolvedValueOnce({ data: [], error: null });

            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to query day-15 due reminder tokens',
                expect.objectContaining({ error: 'DB connection lost' })
            );
        });
    });

    // -------------------------------------------------------------------------
    // Missing email API key
    // -------------------------------------------------------------------------

    describe('Missing HOSPEDA_EMAIL_API_KEY', () => {
        it('skips dispatch entirely when email is not configured', async () => {
            const originalKey = env.HOSPEDA_EMAIL_API_KEY;
            (env as { HOSPEDA_EMAIL_API_KEY: string }).HOSPEDA_EMAIL_API_KEY = '';

            try {
                const token = seedResolvableToken({
                    tokenId: 'token-nokey',
                    conversationId: 'conv-nokey',
                    accommodationId: 'acc-nokey',
                    recipientEmail: 'guest@example.com'
                });
                mockFindDueReminders.mockResolvedValueOnce({ data: [token], error: null });
                mockFindDueReminders.mockResolvedValueOnce({ data: [], error: null });

                const result = await conversationTokenReminderJob.handler(mockContext);

                expect(result.success).toBe(true);
                expect(result.message).toContain('Skipped');
                expect(mockSendEmail).not.toHaveBeenCalled();
            } finally {
                (env as { HOSPEDA_EMAIL_API_KEY: string }).HOSPEDA_EMAIL_API_KEY =
                    originalKey ?? '';
            }
        });
    });

    // -------------------------------------------------------------------------
    // Unhandled error
    // -------------------------------------------------------------------------

    describe('Unhandled error', () => {
        it('catches unexpected exceptions and returns failure', async () => {
            mockFindDueReminders.mockRejectedValue(new Error('Unexpected crash'));

            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed');
            expect(result.errors).toBeGreaterThan(0);
        });
    });

    // -------------------------------------------------------------------------
    // HOS-129: dispatch/transaction boundary
    // -------------------------------------------------------------------------

    describe('Boundary: email dispatch runs with no transaction open; stamp persists per-token right after (AC-1/AC-3)', () => {
        it('sends the email before any transaction is open, persists the stamp only after that send returns, and never executes an advisory-lock statement', async () => {
            const token = seedResolvableToken({
                tokenId: 'token-boundary',
                conversationId: 'conv-boundary',
                accommodationId: 'acc-boundary',
                recipientEmail: 'guest-boundary@example.com'
            });
            mockFindDueReminders.mockResolvedValueOnce({ data: [token], error: null });
            mockFindDueReminders.mockResolvedValueOnce({ data: [], error: null });

            const txOpenDuringSend: boolean[] = [];
            const callOrder: string[] = [];
            mockSendEmail.mockImplementation(async () => {
                txOpenDuringSend.push(txOpenState.open);
                callOrder.push('send');
                return { success: true, messageId: 'msg-boundary' };
            });

            const executedStatements: unknown[] = [];
            mockWithTransaction.mockImplementation(
                async (callback: (tx: unknown) => Promise<unknown>) => {
                    txOpenState.open = true;
                    callOrder.push('mark-tx-open');
                    try {
                        const fakeTx = {
                            execute: vi.fn().mockImplementation(async (query: unknown) => {
                                executedStatements.push(query);
                                return { rows: [] };
                            })
                        };
                        return await callback(fakeTx);
                    } finally {
                        txOpenState.open = false;
                        callOrder.push('mark-tx-close');
                    }
                }
            );

            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(result.processed).toBe(1);
            // No write transaction was open while sendEmail ran.
            expect(txOpenDuringSend).toEqual([false]);
            // The per-token mark transaction opens only AFTER this token's
            // send has already completed.
            expect(callOrder).toEqual(['send', 'mark-tx-open', 'mark-tx-close']);
            // No `pg_try_advisory_xact_lock` (or any other raw) statement is
            // ever executed — the advisory lock was removed from this job
            // entirely.
            expect(executedStatements).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // HOS-129: per-item stamp persistence (AC-2)
    // -------------------------------------------------------------------------

    describe('Per-token reminder-sent stamp (AC-2)', () => {
        it('marks exactly one reminder sent for a successful day-15 send', async () => {
            const token = seedResolvableToken({
                tokenId: 'token-day15',
                conversationId: 'conv-day15',
                accommodationId: 'acc-day15',
                recipientEmail: 'guest-day15@example.com'
            });
            mockFindDueReminders.mockResolvedValueOnce({ data: [token], error: null });
            mockFindDueReminders.mockResolvedValueOnce({ data: [], error: null });

            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(mockSendEmail).toHaveBeenCalledTimes(1);
            expect(mockMarkReminderSent).toHaveBeenCalledTimes(1);
            expect(mockMarkReminderSent).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ tokenId: token.id, reminderType: 'day15' }),
                expect.objectContaining({ tx: expect.anything() })
            );
        });

        it('marks exactly one reminder sent for a successful day-25 send', async () => {
            const token = seedResolvableToken({
                tokenId: 'token-day25',
                conversationId: 'conv-day25',
                accommodationId: 'acc-day25',
                recipientEmail: 'guest-day25@example.com',
                daysUntilExpiry: 5
            });
            mockFindDueReminders.mockResolvedValueOnce({ data: [], error: null });
            mockFindDueReminders.mockResolvedValueOnce({ data: [token], error: null });

            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(mockSendEmail).toHaveBeenCalledTimes(1);
            expect(mockMarkReminderSent).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ tokenId: token.id, reminderType: 'day25' }),
                expect.anything()
            );
        });

        it('does not persist a stamp when the send fails', async () => {
            const token = seedResolvableToken({
                tokenId: 'token-sendfail',
                conversationId: 'conv-sendfail',
                accommodationId: 'acc-sendfail',
                recipientEmail: 'guest-sendfail@example.com'
            });
            mockFindDueReminders.mockResolvedValueOnce({ data: [token], error: null });
            mockFindDueReminders.mockResolvedValueOnce({ data: [], error: null });
            mockSendEmail.mockResolvedValue({ success: false, error: 'Brevo 500' });

            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(mockMarkReminderSent).not.toHaveBeenCalled();
            expect(result.processed).toBe(0);
            expect(result.errors).toBeGreaterThan(0);
        });
    });

    // -------------------------------------------------------------------------
    // HOS-129 (review): stamp persistence failure after successful send (AC-4)
    // -------------------------------------------------------------------------

    describe('Stamp persistence failure after successful send (AC-4)', () => {
        it('counts a service-layer error result as an error and logs it, without rethrowing', async () => {
            const token = seedResolvableToken({
                tokenId: 'token-markfail',
                conversationId: 'conv-markfail',
                accommodationId: 'acc-markfail',
                recipientEmail: 'guest-markfail@example.com'
            });
            mockFindDueReminders.mockResolvedValueOnce({ data: [token], error: null });
            mockFindDueReminders.mockResolvedValueOnce({ data: [], error: null });
            mockMarkReminderSent.mockResolvedValue({
                data: null,
                error: { code: 'INTERNAL_ERROR', message: 'DB write failed' }
            });

            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(mockSendEmail).toHaveBeenCalledTimes(1);
            expect(result.success).toBe(true);
            expect(result.processed).toBe(1);
            expect(result.errors).toBeGreaterThan(0);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Failed to mark reminder as sent',
                expect.objectContaining({ tokenId: 'token-markfail' })
            );
        });

        it('counts a thrown persistence exception as an error and logs it, without rethrowing', async () => {
            const token = seedResolvableToken({
                tokenId: 'token-markthrow',
                conversationId: 'conv-markthrow',
                accommodationId: 'acc-markthrow',
                recipientEmail: 'guest-markthrow@example.com'
            });
            mockFindDueReminders.mockResolvedValueOnce({ data: [token], error: null });
            mockFindDueReminders.mockResolvedValueOnce({ data: [], error: null });
            mockWithTransaction.mockRejectedValue(new Error('DB connection lost mid-persist'));

            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(mockSendEmail).toHaveBeenCalledTimes(1);
            expect(result.success).toBe(true);
            expect(result.processed).toBe(1);
            expect(result.errors).toBeGreaterThan(0);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Failed to persist reminder-sent stamp after send',
                expect.objectContaining({ tokenId: 'token-markthrow' })
            );
        });
    });

    // -------------------------------------------------------------------------
    // HOS-129: both windows processed (AC-5)
    // -------------------------------------------------------------------------

    describe('Both reminder windows processed in one run (AC-5)', () => {
        it('dispatches day-15 and day-25 tokens in the same run', async () => {
            const day15Token = seedResolvableToken({
                tokenId: 'token-both-15',
                conversationId: 'conv-both-15',
                accommodationId: 'acc-both-15',
                recipientEmail: 'guest-both-15@example.com'
            });
            const day25Token = seedResolvableToken({
                tokenId: 'token-both-25',
                conversationId: 'conv-both-25',
                accommodationId: 'acc-both-25',
                recipientEmail: 'guest-both-25@example.com',
                daysUntilExpiry: 5
            });
            mockFindDueReminders.mockResolvedValueOnce({ data: [day15Token], error: null });
            mockFindDueReminders.mockResolvedValueOnce({ data: [day25Token], error: null });

            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(2);
            expect(mockSendEmail).toHaveBeenCalledTimes(2);
            expect(mockMarkReminderSent).toHaveBeenCalledTimes(2);
            expect(mockMarkReminderSent).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ tokenId: 'token-both-15', reminderType: 'day15' }),
                expect.anything()
            );
            expect(mockMarkReminderSent).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ tokenId: 'token-both-25', reminderType: 'day25' }),
                expect.anything()
            );
        });
    });
});
