/**
 * Tests for the Conversation Notification Cron Job
 *
 * Mocking strategy: mocks @repo/db, @repo/service-core, @repo/email, and the
 * Redis client so no real DB, email, or Redis is needed.
 *
 * Test scenarios:
 * - Job configuration (name, schedule, advisory lock, enabled flag)
 * - Dry run mode (skips email, returns wouldProcess count)
 * - Advisory lock not acquired (skipped result)
 * - Empty due list (processed = 0)
 * - findDue service error → failure result
 * - Missing RESEND API key → skips dispatch
 * - Unhandled exception → failure result
 * - HOS-112: email dispatch never runs while the phase-3 (persist) transaction
 *   is open, and the advisory lock is acquired only AFTER all sends (AC-1/AC-5)
 * - HOS-112: atomic Redis claim skips a schedule already claimed by another
 *   run/tick (AC-2)
 * - HOS-112: a failed send releases the Redis claim and does not advance the
 *   streak (AC-3)
 * - HOS-112: only successfully-sent schedules advance their streak (AC-4)
 * - HOS-112: two overlapping runs over the same due set dispatch/advance each
 *   schedule at most once, via the shared Redis claim (AC-6)
 *
 * AC-9 (send timeout) is covered in `packages/email/test/send.test.ts` — the
 * timeout lives entirely inside `sendEmail`, with no cron-specific behavior
 * to assert here. AC-10 (double-advance guard) is covered in
 * `packages/service-core/test/services/conversation/notification-schedule.service.test.ts`.
 *
 * @module test/cron/conversation-notification
 */

import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
    mockWithTransaction,
    mockFindDue,
    mockAdvanceSchedule,
    mockSendEmail,
    mockAccommodationFindById,
    mockUserFindById,
    dbRowsState,
    fakeRedisState,
    txOpenState,
    callOrder
} = vi.hoisted(() => {
    const dbRowsState = {
        conversationsById: new Map<string, Record<string, unknown>>(),
        messagesByConversationId: new Map<string, Record<string, unknown>[]>(),
        accommodationsById: new Map<string, Record<string, unknown>>(),
        usersById: new Map<string, Record<string, unknown>>()
    };
    const fakeRedisState: { client: unknown } = { client: null };
    const txOpenState = { open: false };
    const callOrder: string[] = [];

    const mockAccommodationFindById = vi.fn(async (id: string) => {
        return dbRowsState.accommodationsById.get(id) ?? null;
    });
    const mockUserFindById = vi.fn(async (id: string) => {
        return dbRowsState.usersById.get(id) ?? null;
    });

    return {
        mockWithTransaction: vi.fn(),
        mockFindDue: vi.fn(),
        mockAdvanceSchedule: vi.fn(),
        mockSendEmail: vi.fn(),
        mockAccommodationFindById,
        mockUserFindById,
        dbRowsState,
        fakeRedisState,
        txOpenState,
        callOrder
    };
});

vi.mock('@repo/service-core', () => ({
    NotificationScheduleService: vi.fn().mockImplementation(function () {
        return {
            findDue: mockFindDue,
            advanceSchedule: mockAdvanceSchedule
        };
    })
}));

vi.mock('@repo/email', () => ({
    createEmailClient: vi.fn().mockReturnValue({}),
    sendEmail: mockSendEmail
}));

vi.mock('@repo/notifications', () => ({
    ConversationNewMessage: vi.fn().mockReturnValue({ type: 'mock-email-template' }),
    ConversationNewMessageAnon: vi.fn().mockReturnValue({ type: 'mock-email-anon-template' })
}));

vi.mock('@repo/db', () => {
    /** Table reference used by the mocked `messages` export — see `from()` below. */
    const messagesTableRef = {
        conversationId: 'conversationId',
        createdAt: 'createdAt',
        body: 'body'
    };
    /** Table reference used by the mocked `conversations` export. */
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
                from: vi.fn((table: unknown) => {
                    if (table === messagesTableRef) {
                        return {
                            where: vi.fn((whereClause: unknown) => ({
                                orderBy: vi.fn().mockReturnValue({
                                    limit: vi.fn().mockImplementation(async () => {
                                        const conversationId = extractEqVal(whereClause);
                                        return conversationId
                                            ? (dbRowsState.messagesByConversationId.get(
                                                  conversationId
                                              ) ?? [])
                                            : [];
                                    })
                                })
                            }))
                        };
                    }
                    return {
                        where: vi.fn((whereClause: unknown) => ({
                            limit: vi.fn().mockImplementation(async () => {
                                const conversationId = extractEqVal(whereClause);
                                const row = conversationId
                                    ? dbRowsState.conversationsById.get(conversationId)
                                    : undefined;
                                return row ? [row] : [];
                            })
                        }))
                    };
                })
            }))
        })),
        sql: vi.fn((strings: TemplateStringsArray) => ({ sql: strings.join('') })),
        conversations: conversationsTableRef,
        messages: messagesTableRef,
        AccommodationModel: vi.fn().mockImplementation(function () {
            return { findById: mockAccommodationFindById };
        }),
        UserModel: vi.fn().mockImplementation(function () {
            return { findById: mockUserFindById };
        })
    };
});

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ and: args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ eq: { col, val } })),
    isNull: vi.fn((col: unknown) => ({ isNull: col })),
    desc: vi.fn((col: unknown) => ({ desc: col }))
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

vi.mock('../../src/utils/redis.js', () => ({
    getRedisClient: vi.fn().mockImplementation(async () => fakeRedisState.client)
}));

import { conversationNotificationJob } from '../../src/cron/jobs/conversation-notification.job.js';
import type { CronJobContext } from '../../src/cron/types.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Redis SET/DEL/EXISTS mock backed by a real in-memory Map, so `SET ... NX`
 * behaves like real Redis (fails when the key is already present). */
function createFakeRedis(claims: Map<string, string> = new Map()) {
    return {
        set: vi.fn(async (key: string, value: string, _ex: string, _ttl: number, nx?: string) => {
            if (nx === 'NX') {
                if (claims.has(key)) return null;
                claims.set(key, value);
                return 'OK';
            }
            claims.set(key, value);
            return 'OK';
        }),
        del: vi.fn(async (key: string) => {
            claims.delete(key);
            return 1;
        }),
        exists: vi.fn(async (key: string) => (claims.has(key) ? 1 : 0))
    };
}

/**
 * Seeds a fully-resolvable OWNER-recipient schedule: conversation,
 * accommodation, owner user, and an empty-ish message history. Returns the
 * "due schedule" row object to hand to `mockFindDue`.
 */
function seedResolvableSchedule(params: {
    scheduleId: string;
    conversationId: string;
    accommodationId: string;
    ownerId: string;
    recipientEmail: string;
    streakCount?: number;
}) {
    const {
        scheduleId,
        conversationId,
        accommodationId,
        ownerId,
        recipientEmail,
        streakCount = 1
    } = params;

    dbRowsState.conversationsById.set(conversationId, {
        id: conversationId,
        accommodationId,
        userId: null,
        anonymousEmail: null,
        anonymousName: null,
        locale: 'es',
        deletedAt: null
    });
    dbRowsState.accommodationsById.set(accommodationId, {
        id: accommodationId,
        name: 'Test Accommodation',
        slug: 'test-accommodation',
        ownerId
    });
    dbRowsState.usersById.set(ownerId, {
        id: ownerId,
        email: recipientEmail,
        displayName: 'Owner Name'
    });
    dbRowsState.messagesByConversationId.set(conversationId, [
        { body: 'Hello', createdAt: new Date() }
    ]);

    return {
        id: scheduleId,
        conversationId,
        recipientSide: 'OWNER',
        streakCount,
        pendingNotificationAt: new Date()
    };
}

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
        txOpenState.open = true;
        try {
            const fakeTx = {
                execute: vi.fn().mockImplementation(async () => {
                    callOrder.push('lock-acquire');
                    return { rows: [{ acquired: true }] };
                })
            };
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
            startedAt: new Date('2025-01-01T10:00:00Z'),
            dryRun: false
        };

        dbRowsState.conversationsById.clear();
        dbRowsState.messagesByConversationId.clear();
        dbRowsState.accommodationsById.clear();
        dbRowsState.usersById.clear();
        fakeRedisState.client = null;
        txOpenState.open = false;
        callOrder.length = 0;

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
            mockWithTransaction.mockImplementation(async function (
                callback: (tx: unknown) => Promise<unknown>
            ) {
                const fakeTx = {
                    execute: vi.fn().mockResolvedValue({ rows: [{ acquired: false }] })
                };
                return callback(fakeTx);
            });

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

    // -------------------------------------------------------------------------
    // HOS-112: dispatch/transaction boundary
    // -------------------------------------------------------------------------

    describe('Boundary: email dispatch runs outside the phase-3 transaction (AC-1/AC-5)', () => {
        it('sends the email before any transaction is open, and acquires the advisory lock only afterwards', async () => {
            const schedule = seedResolvableSchedule({
                scheduleId: 'sched-boundary',
                conversationId: 'conv-boundary',
                accommodationId: 'acc-boundary',
                ownerId: 'owner-boundary',
                recipientEmail: 'owner@example.com'
            });
            mockFindDue.mockResolvedValue({ data: [schedule], error: null });

            const txOpenDuringSend: boolean[] = [];
            mockSendEmail.mockImplementation(async () => {
                txOpenDuringSend.push(txOpenState.open);
                callOrder.push('send');
                return { success: true, messageId: 'msg-boundary' };
            });

            const result = await conversationNotificationJob.handler(mockContext);

            expect(result.processed).toBe(1);
            // No write transaction was open while sendEmail ran.
            expect(txOpenDuringSend).toEqual([false]);
            // The advisory lock (tracked via tx.execute) is only acquired AFTER
            // every send in this run has already happened.
            expect(callOrder).toEqual(['send', 'lock-acquire']);
        });
    });

    // -------------------------------------------------------------------------
    // HOS-112: atomic Redis claim
    // -------------------------------------------------------------------------

    describe('Redis atomic claim (AC-2)', () => {
        it('skips a schedule whose claim key is already held by another run/tick', async () => {
            const scheduleA = seedResolvableSchedule({
                scheduleId: 'sched-a',
                conversationId: 'conv-a',
                accommodationId: 'acc-a',
                ownerId: 'owner-a',
                recipientEmail: 'owner-a@example.com'
            });
            const scheduleB = seedResolvableSchedule({
                scheduleId: 'sched-b',
                conversationId: 'conv-b',
                accommodationId: 'acc-b',
                ownerId: 'owner-b',
                recipientEmail: 'owner-b@example.com'
            });
            mockFindDue.mockResolvedValue({ data: [scheduleA, scheduleB], error: null });

            // sched-a's idempotency key is already set — SET ... NX must fail for it.
            fakeRedisState.client = createFakeRedis(new Map([['conv:notif:sched-a', '1']]));

            const result = await conversationNotificationJob.handler(mockContext);

            expect(mockSendEmail).toHaveBeenCalledTimes(1);
            expect(mockSendEmail.mock.calls[0]?.[0]).toMatchObject({
                to: 'owner-b@example.com'
            });
            expect(result.processed).toBe(1);
            expect(result.errors).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // HOS-112: claim release on send failure
    // -------------------------------------------------------------------------

    describe('Redis claim release on send failure (AC-3)', () => {
        it('releases the claim and does not advance the streak when sendEmail fails', async () => {
            const schedule = seedResolvableSchedule({
                scheduleId: 'sched-fail',
                conversationId: 'conv-fail',
                accommodationId: 'acc-fail',
                ownerId: 'owner-fail',
                recipientEmail: 'owner-fail@example.com'
            });
            mockFindDue.mockResolvedValue({ data: [schedule], error: null });

            const fakeRedis = createFakeRedis();
            fakeRedisState.client = fakeRedis;

            mockSendEmail.mockResolvedValue({ success: false, error: 'Brevo 500' });

            const result = await conversationNotificationJob.handler(mockContext);

            expect(fakeRedis.del).toHaveBeenCalledWith('conv:notif:sched-fail');
            expect(mockAdvanceSchedule).not.toHaveBeenCalled();
            expect(result.processed).toBe(0);
            expect(result.errors).toBeGreaterThan(0);
        });
    });

    // -------------------------------------------------------------------------
    // HOS-112: only successful sends advance the streak
    // -------------------------------------------------------------------------

    describe('Streak advance only for successfully sent schedules (AC-4)', () => {
        it('advances exactly one schedule when one send succeeds and one fails in the same batch', async () => {
            const successSchedule = seedResolvableSchedule({
                scheduleId: 'sched-ok',
                conversationId: 'conv-ok',
                accommodationId: 'acc-ok',
                ownerId: 'owner-ok',
                recipientEmail: 'owner-ok@example.com'
            });
            const failSchedule = seedResolvableSchedule({
                scheduleId: 'sched-bad',
                conversationId: 'conv-bad',
                accommodationId: 'acc-bad',
                ownerId: 'owner-bad',
                recipientEmail: 'owner-bad@example.com'
            });
            mockFindDue.mockResolvedValue({ data: [successSchedule, failSchedule], error: null });
            fakeRedisState.client = createFakeRedis();

            mockSendEmail.mockImplementation(async (input: { to: string }) => {
                if (input.to === 'owner-bad@example.com') {
                    return { success: false, error: 'boom' };
                }
                return { success: true, messageId: 'msg-ok' };
            });

            const result = await conversationNotificationJob.handler(mockContext);

            expect(mockAdvanceSchedule).toHaveBeenCalledTimes(1);
            expect(mockAdvanceSchedule.mock.calls[0]?.[1]).toMatchObject({
                scheduleId: 'sched-ok'
            });
            expect(result.processed).toBe(1);
            expect(result.errors).toBeGreaterThan(0);
        });
    });

    // -------------------------------------------------------------------------
    // HOS-112: overlapping runs share Redis claim state
    // -------------------------------------------------------------------------

    describe('Overlapping runs share Redis claim state (AC-6)', () => {
        it('dispatches and advances each schedule at most once across two overlapping runs', async () => {
            const scheduleA = seedResolvableSchedule({
                scheduleId: 'sched-overlap-a',
                conversationId: 'conv-overlap-a',
                accommodationId: 'acc-overlap-a',
                ownerId: 'owner-overlap-a',
                recipientEmail: 'owner-overlap-a@example.com'
            });
            const scheduleB = seedResolvableSchedule({
                scheduleId: 'sched-overlap-b',
                conversationId: 'conv-overlap-b',
                accommodationId: 'acc-overlap-b',
                ownerId: 'owner-overlap-b',
                recipientEmail: 'owner-overlap-b@example.com'
            });
            // Both "runs" resolve the same due set — the DB rows haven't moved
            // yet, mirroring two overlapping ticks reading before either persists.
            mockFindDue.mockResolvedValue({ data: [scheduleA, scheduleB], error: null });

            // Shared claim store across both invocations — simulates one Redis
            // instance backing both overlapping runs.
            fakeRedisState.client = createFakeRedis();

            const firstRun = await conversationNotificationJob.handler(mockContext);
            const secondRun = await conversationNotificationJob.handler(mockContext);

            expect(mockSendEmail).toHaveBeenCalledTimes(2);
            expect(mockAdvanceSchedule).toHaveBeenCalledTimes(2);
            expect(firstRun.processed).toBe(2);
            expect(secondRun.processed).toBe(0);
        });
    });
});
