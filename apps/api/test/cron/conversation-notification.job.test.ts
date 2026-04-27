/**
 * Tests for the Conversation Notification Cron Job
 *
 * Mocking strategy: mocks @repo/db and @repo/service-core so no real DB
 * or email is needed.
 *
 * Test scenarios:
 * - Job configuration (name, schedule, advisory lock, enabled flag)
 * - Dry run mode (skips email, returns wouldProcess count)
 * - Advisory lock not acquired (skipped result)
 * - Empty due list (processed = 0)
 * - findDue service error → failure result
 * - Missing RESEND API key → skips dispatch
 * - Unhandled exception → failure result
 *
 * @module test/cron/conversation-notification
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockWithTransaction, mockFindDue, mockAdvanceSchedule, mockSendEmail } = vi.hoisted(() => {
    const mockWithTransaction = vi.fn();
    const mockFindDue = vi.fn();
    const mockAdvanceSchedule = vi.fn();
    const mockSendEmail = vi.fn();
    return { mockWithTransaction, mockFindDue, mockAdvanceSchedule, mockSendEmail };
});

vi.mock('@repo/service-core', () => ({
    NotificationScheduleService: vi.fn().mockImplementation(() => ({
        findDue: mockFindDue,
        advanceSchedule: mockAdvanceSchedule
    }))
}));

vi.mock('@repo/email', () => ({
    createEmailClient: vi.fn().mockReturnValue({}),
    sendEmail: mockSendEmail
}));

vi.mock('@repo/notifications', () => ({
    ConversationNewMessage: vi.fn().mockReturnValue({ type: 'mock-email-template' }),
    ConversationNewMessageAnon: vi.fn().mockReturnValue({ type: 'mock-email-anon-template' })
}));

vi.mock('@repo/db', () => ({
    withTransaction: mockWithTransaction,
    getDb: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([])
                })
            })
        })
    }),
    sql: vi.fn((strings: TemplateStringsArray) => ({ sql: strings.join('') })),
    conversations: { id: 'id', deletedAt: 'deletedAt' },
    messages: { conversationId: 'conversationId', createdAt: 'createdAt', body: 'body' },
    AccommodationModel: vi.fn().mockImplementation(() => ({
        findById: vi.fn().mockResolvedValue(null)
    })),
    UserModel: vi.fn().mockImplementation(() => ({
        findById: vi.fn().mockResolvedValue(null)
    }))
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ and: args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ eq: { col, val } })),
    isNull: vi.fn((col: unknown) => ({ isNull: col })),
    desc: vi.fn((col: unknown) => ({ desc: col }))
}));

vi.mock('../../src/utils/env.js', () => ({
    env: {
        HOSPEDA_RESEND_API_KEY: 'test-resend-key',
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

vi.mock('../../src/utils/redis.js', () => ({
    getRedisClient: vi.fn().mockResolvedValue(null)
}));

import { conversationNotificationJob } from '../../src/cron/jobs/conversation-notification.job.js';
import type { CronJobContext } from '../../src/cron/types.js';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('Conversation Notification Cron Job', () => {
    let mockLogger: {
        info: Mock;
        warn: Mock;
        error: Mock;
        debug: Mock;
    };
    let mockContext: CronJobContext;

    const acquiredTransaction = async (callback: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
        };
        return callback(fakeTx);
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
            startedAt: new Date('2025-01-01T10:00:00Z'),
            dryRun: false
        };

        mockWithTransaction.mockImplementation(acquiredTransaction);
        mockFindDue.mockResolvedValue({ data: [], error: null });
        mockAdvanceSchedule.mockResolvedValue({
            data: { id: 'sched-1', streakCount: 2 },
            error: null
        });
        mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-123' });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Job configuration
    // -------------------------------------------------------------------------

    describe('Job Configuration', () => {
        it('has the correct job name', () => {
            expect(conversationNotificationJob.name).toBe('conversation-notification');
        });

        it('runs every 5 minutes', () => {
            expect(conversationNotificationJob.schedule).toBe('*/5 * * * *');
        });

        it('is enabled', () => {
            expect(conversationNotificationJob.enabled).toBe(true);
        });

        it('has a handler function', () => {
            expect(typeof conversationNotificationJob.handler).toBe('function');
        });

        it('has a 2-minute timeout', () => {
            expect(conversationNotificationJob.timeoutMs).toBe(120000);
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

            const result = await conversationNotificationJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.message).toContain('Skipped');
        });
    });

    // -------------------------------------------------------------------------
    // Dry run
    // -------------------------------------------------------------------------

    describe('Dry run mode', () => {
        it('reports due count without dispatching emails', async () => {
            mockFindDue.mockResolvedValue({
                data: [
                    {
                        id: 'sched-1',
                        conversationId: 'conv-1',
                        recipientSide: 'OWNER',
                        streakCount: 1,
                        pendingNotificationAt: new Date()
                    }
                ],
                error: null
            });

            const dryRunContext: CronJobContext = { ...mockContext, dryRun: true };
            const result = await conversationNotificationJob.handler(dryRunContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.message).toContain('Dry run');
            expect(mockSendEmail).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // No due schedules
    // -------------------------------------------------------------------------

    describe('Empty due list', () => {
        it('returns success with processed = 0 when no schedules are due', async () => {
            const result = await conversationNotificationJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // findDue error
    // -------------------------------------------------------------------------

    describe('findDue service error', () => {
        it('returns failure when service layer errors on findDue', async () => {
            mockFindDue.mockResolvedValue({
                data: null,
                error: { code: 'INTERNAL_ERROR', message: 'DB connection lost' }
            });

            const result = await conversationNotificationJob.handler(mockContext);

            expect(result.success).toBe(false);
            expect(result.errors).toBeGreaterThan(0);
        });
    });

    // -------------------------------------------------------------------------
    // Unhandled error
    // -------------------------------------------------------------------------

    describe('Unhandled error', () => {
        it('catches unexpected exceptions and returns failure', async () => {
            mockWithTransaction.mockRejectedValue(new Error('Unexpected DB failure'));

            const result = await conversationNotificationJob.handler(mockContext);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed');
            expect(result.errors).toBeGreaterThan(0);
        });
    });
});
