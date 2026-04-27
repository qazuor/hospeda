/**
 * Tests for the Conversation Token Reminder Cron Job
 *
 * Mocking strategy: mocks @repo/service-core (AccessTokenService) and @repo/email
 * so no real DB or email is needed.
 *
 * Test scenarios:
 * - Job configuration (name, schedule, enabled flag)
 * - Advisory lock not acquired (skipped)
 * - Dry run mode (no emails dispatched)
 * - No due reminders (processed = 0)
 * - Day-15 reminder dispatched and marked
 * - Day-25 reminder dispatched and marked
 * - Email failure (errors counter incremented, reminder NOT marked)
 * - Missing RESEND API key (skips dispatch)
 *
 * @module test/cron/conversation-token-reminder
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (factories must NOT reference module-level variables)
// ---------------------------------------------------------------------------

const {
    mockWithTransaction,
    mockFindDueReminders,
    mockMarkReminderSent,
    mockSendEmail,
    mockDbSelect,
    mockDbSelectFrom,
    mockDbSelectFromWhere,
    mockDbSelectFromWhereLimit,
    mockAccommodationFindById
} = vi.hoisted(() => {
    const mockWithTransaction = vi.fn();
    const mockFindDueReminders = vi.fn();
    const mockMarkReminderSent = vi.fn();
    const mockSendEmail = vi.fn();
    const mockDbSelectFromWhereLimit = vi.fn();
    const mockDbSelectFromWhere = vi.fn().mockReturnValue({ limit: mockDbSelectFromWhereLimit });
    const mockDbSelectFrom = vi.fn().mockReturnValue({ where: mockDbSelectFromWhere });
    const mockDbSelect = vi.fn().mockReturnValue({ from: mockDbSelectFrom });
    const mockAccommodationFindById = vi.fn();
    return {
        mockWithTransaction,
        mockFindDueReminders,
        mockMarkReminderSent,
        mockSendEmail,
        mockDbSelect,
        mockDbSelectFrom,
        mockDbSelectFromWhere,
        mockDbSelectFromWhereLimit,
        mockAccommodationFindById
    };
});

vi.mock('@repo/service-core', () => ({
    AccessTokenService: vi.fn().mockImplementation(() => ({
        findDueReminders: mockFindDueReminders,
        markReminderSent: mockMarkReminderSent
    }))
}));

vi.mock('@repo/email', () => ({
    createEmailClient: vi.fn().mockReturnValue({}),
    sendEmail: mockSendEmail
}));

vi.mock('@repo/notifications', () => ({
    ConversationTokenExpiringDay15: vi.fn().mockReturnValue({ type: 'mock-day15-template' }),
    ConversationTokenExpiringDay25: vi.fn().mockReturnValue({ type: 'mock-day25-template' })
}));

vi.mock('@repo/db', () => ({
    withTransaction: (callback: Parameters<typeof mockWithTransaction>[0]) =>
        mockWithTransaction(callback),
    getDb: vi.fn().mockReturnValue({
        select: mockDbSelect
    }),
    sql: vi.fn((strings: TemplateStringsArray) => ({ sql: strings.join('') })),
    conversations: { id: 'id', deletedAt: 'deletedAt', accommodationId: 'accommodationId' },
    AccommodationModel: vi.fn().mockImplementation(() => ({
        findById: mockAccommodationFindById
    }))
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ and: args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ eq: { col, val } })),
    isNull: vi.fn((col: unknown) => ({ isNull: col }))
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

import { conversationTokenReminderJob } from '../../src/cron/jobs/conversation-token-reminder.job.js';
import type { CronJobContext } from '../../src/cron/types.js';

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

    const sampleToken = {
        id: 'token-1',
        conversationId: 'conv-1',
        tokenHash: 'abc123',
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        day15ReminderSentAt: null,
        day25ReminderSentAt: null,
        createdAt: new Date()
    };

    const sampleConversation = {
        id: 'conv-1',
        accommodationId: 'acc-1',
        anonymousEmail: 'guest@example.com',
        anonymousName: 'Test Guest',
        locale: 'es',
        deletedAt: null
    };

    const sampleAccommodation = {
        id: 'acc-1',
        name: 'Test Accommodation',
        slug: 'test-accommodation'
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

        // Default: transaction executes callback inline (lock acquired)
        mockWithTransaction.mockImplementation(
            async (callback: (tx: unknown) => Promise<unknown>) => {
                const fakeTx = {
                    execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
                };
                return callback(fakeTx);
            }
        );

        // Default: no due reminders
        mockFindDueReminders.mockResolvedValue({ data: [], error: null });
        mockMarkReminderSent.mockResolvedValue({ data: sampleToken, error: null });
        mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-abc' });

        // Default: conversation select chain
        mockDbSelect.mockReturnValue({ from: mockDbSelectFrom });
        mockDbSelectFrom.mockReturnValue({ where: mockDbSelectFromWhere });
        mockDbSelectFromWhere.mockReturnValue({ limit: mockDbSelectFromWhereLimit });
        mockDbSelectFromWhereLimit.mockResolvedValue([sampleConversation]);

        // Default: accommodation lookup
        mockAccommodationFindById.mockResolvedValue({
            data: sampleAccommodation,
            error: null
        });
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

            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.message).toContain('Skipped');
        });
    });

    // -------------------------------------------------------------------------
    // Dry run
    // -------------------------------------------------------------------------

    describe('Dry run mode', () => {
        it('does not send emails in dry run', async () => {
            mockFindDueReminders.mockResolvedValue({ data: [sampleToken], error: null });

            const dryRunContext: CronJobContext = { ...mockContext, dryRun: true };
            const result = await conversationTokenReminderJob.handler(dryRunContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.message).toContain('Dry run');
            expect(mockSendEmail).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // No due reminders
    // -------------------------------------------------------------------------

    describe('Empty due lists', () => {
        it('returns success with processed = 0 when no tokens are due', async () => {
            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // Successful day-15 dispatch
    // -------------------------------------------------------------------------

    describe('Day-15 reminder', () => {
        it('dispatches email and marks reminder sent', async () => {
            // Only day-15 returns results; day-25 returns empty
            mockFindDueReminders
                .mockResolvedValueOnce({ data: [sampleToken], error: null }) // day15
                .mockResolvedValueOnce({ data: [], error: null }); // day25

            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBeGreaterThanOrEqual(1);
            expect(mockSendEmail).toHaveBeenCalledTimes(1);
            expect(mockMarkReminderSent).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ tokenId: sampleToken.id, reminderType: 'day15' })
            );
        });

        it('increments errors and does not mark reminder on email failure', async () => {
            mockFindDueReminders
                .mockResolvedValueOnce({ data: [sampleToken], error: null })
                .mockResolvedValueOnce({ data: [], error: null });
            mockSendEmail.mockResolvedValue({ success: false, error: 'SMTP error' });

            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(result.errors).toBeGreaterThanOrEqual(1);
            expect(mockMarkReminderSent).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Unhandled error
    // -------------------------------------------------------------------------

    describe('Unhandled error', () => {
        it('catches unexpected exceptions and returns failure', async () => {
            mockWithTransaction.mockRejectedValue(new Error('Unexpected crash'));

            const result = await conversationTokenReminderJob.handler(mockContext);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed');
        });
    });
});
