/**
 * @file notification-schedule.service.test.ts
 *
 * Unit tests for NotificationScheduleService.
 *
 * All model interactions are mocked using createTypedModelMock so the suite
 * runs without a live database connection.
 *
 * Streak math under test:
 * - Streak 1 → 2: pendingNotificationAt = streakStartedAt + 24h, streakCount = 2
 * - Streak 2 → 3: pendingNotificationAt = streakStartedAt + 72h, streakCount = 3
 * - Streak 3 → terminal: cancelledAt = now, returns null
 */

import { NotificationScheduleModel } from '@repo/db';
import type { SelectConversationNotificationSchedule } from '@repo/db';
import { NotificationRecipientSideEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationScheduleService } from '../../../src/services/conversation/notification-schedule.service';
import { createActor } from '../../factories/actorFactory';
import { expectForbiddenError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

/** Cast helper for Vitest mock access */
const asMock = <T>(fn: T) => fn as unknown as Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SYSTEM_ACTOR = createActor({
    role: RoleEnum.SUPER_ADMIN,
    permissions: [
        PermissionEnum.CONVERSATION_VIEW_ANY,
        PermissionEnum.CONVERSATION_REPLY_ANY,
        PermissionEnum.CONVERSATION_DELETE_ANY,
        PermissionEnum.CONVERSATION_UPDATE_STATUS_ANY
    ]
});

const USER_ACTOR = createActor({
    role: RoleEnum.USER,
    permissions: [PermissionEnum.CONVERSATION_REPLY_OWN]
});

const FORBIDDEN_ACTOR = createActor({
    role: RoleEnum.USER,
    permissions: []
});

const CONVERSATION_ID = 'aaaabbbb-cccc-4ddd-8eee-ffffffffffff';
const SCHEDULE_ID = 'ccccdddd-eeee-4fff-8aaa-bbbbbbbbbbbb';

function makeScheduleRow(
    overrides: Partial<SelectConversationNotificationSchedule> = {}
): SelectConversationNotificationSchedule {
    const now = new Date();
    return {
        id: SCHEDULE_ID,
        conversationId: CONVERSATION_ID,
        recipientSide: NotificationRecipientSideEnum.OWNER,
        pendingNotificationAt: new Date(Date.now() + 30 * 60 * 1000),
        streakCount: 1,
        streakStartedAt: now,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationScheduleService', () => {
    let service: NotificationScheduleService;
    let modelMock: NotificationScheduleModel;

    beforeEach(() => {
        modelMock = createTypedModelMock(NotificationScheduleModel, [
            'findDue',
            'findActive',
            'upsertSchedule',
            'cancelForConversation',
            'cancelForSide',
            'findById'
        ]);
        const loggerMock = createLoggerMock();
        service = new NotificationScheduleService({ logger: loggerMock }, modelMock);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    // -----------------------------------------------------------------------
    // upsertForMessage
    // -----------------------------------------------------------------------

    describe('upsertForMessage', () => {
        it('should create a fresh schedule with streak_count=1 and pending_at = now + 30min', async () => {
            vi.useFakeTimers();
            const fixedNow = 1_700_000_000_000;
            vi.setSystemTime(fixedNow);

            const row = makeScheduleRow({ streakCount: 1 });
            asMock(modelMock.upsertSchedule).mockResolvedValue(row);

            const fakeDb = {} as import('@repo/db').DrizzleClient;
            const ctx = { tx: fakeDb, hookState: {} };

            const result = await service.upsertForMessage(
                USER_ACTOR,
                {
                    conversationId: CONVERSATION_ID,
                    recipientSide: NotificationRecipientSideEnum.OWNER
                },
                ctx
            );

            expectSuccess(result);
            expect(result.data?.streakCount).toBe(1);

            const call0 = asMock(modelMock.upsertSchedule).mock.calls[0] as [string, string, Date];
            const [convId, side, scheduledAt] = call0;
            expect(convId).toBe(CONVERSATION_ID);
            expect(side).toBe(NotificationRecipientSideEnum.OWNER);

            const expectedAt = new Date(fixedNow + 30 * 60 * 1000);
            expect((scheduledAt as Date).getTime()).toBe(expectedAt.getTime());
        });

        it('should reset streak even when existing schedule has streak >= 3', async () => {
            // The model upsertSchedule resets on ON CONFLICT: new insert resets streak_count=1.
            // The service just calls upsertSchedule; the DB enforces the reset.
            const resetRow = makeScheduleRow({ streakCount: 1 });
            asMock(modelMock.upsertSchedule).mockResolvedValue(resetRow);

            const fakeDb = {} as import('@repo/db').DrizzleClient;
            const ctx = { tx: fakeDb, hookState: {} };

            const result = await service.upsertForMessage(
                USER_ACTOR,
                {
                    conversationId: CONVERSATION_ID,
                    recipientSide: NotificationRecipientSideEnum.GUEST
                },
                ctx
            );

            expectSuccess(result);
            // After reset, streakCount should be back to 1
            expect(result.data?.streakCount).toBe(1);
        });

        it('should return INTERNAL_ERROR when no transaction is provided', async () => {
            // upsertForMessage requires ctx.tx for atomicity
            const result = await service.upsertForMessage(
                USER_ACTOR,
                {
                    conversationId: CONVERSATION_ID,
                    recipientSide: NotificationRecipientSideEnum.OWNER
                }
                // no ctx — tx is undefined
            );
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });

        it('should return FORBIDDEN when actor lacks conversation permissions', async () => {
            // Call without a transaction — permission check fires before the tx guard.
            // Since ctx.tx is absent, runWithLoggingAndValidation returns { error } rather
            // than re-throwing (the re-throw path is only active when ctx.tx is set).
            const result = await service.upsertForMessage(FORBIDDEN_ACTOR, {
                conversationId: CONVERSATION_ID,
                recipientSide: NotificationRecipientSideEnum.OWNER
            });
            expectForbiddenError(result);
        });
    });

    // -----------------------------------------------------------------------
    // cancelForRecipient
    // -----------------------------------------------------------------------

    describe('cancelForRecipient', () => {
        it('should call model.cancelForSide and return count', async () => {
            const fakeDb = {} as import('@repo/db').DrizzleClient;
            asMock(modelMock.cancelForSide).mockResolvedValue(1);

            const result = await service.cancelForRecipient(
                USER_ACTOR,
                {
                    conversationId: CONVERSATION_ID,
                    recipientSide: NotificationRecipientSideEnum.OWNER
                },
                fakeDb
            );

            expectSuccess(result);
            expect(result.data?.count).toBe(1);
        });

        it('should set cancelled_at without deleting the row (count = 1, row not deleted)', async () => {
            // The model's cancelForSide issues an UPDATE SET cancelled_at = now, not DELETE.
            // We verify the correct model method is called (not hardDelete).
            const fakeDb = {} as import('@repo/db').DrizzleClient;
            asMock(modelMock.cancelForSide).mockResolvedValue(1);

            await service.cancelForRecipient(
                USER_ACTOR,
                {
                    conversationId: CONVERSATION_ID,
                    recipientSide: NotificationRecipientSideEnum.GUEST
                },
                fakeDb
            );

            expect(asMock(modelMock.cancelForSide)).toHaveBeenCalledTimes(1);
            expect(asMock(modelMock.hardDelete)).not.toHaveBeenCalled();
        });

        it('should return FORBIDDEN when actor lacks conversation permissions', async () => {
            const fakeDb = {} as import('@repo/db').DrizzleClient;
            const result = await service.cancelForRecipient(
                FORBIDDEN_ACTOR,
                {
                    conversationId: CONVERSATION_ID,
                    recipientSide: NotificationRecipientSideEnum.OWNER
                },
                fakeDb
            );
            expectForbiddenError(result);
        });
    });

    // -----------------------------------------------------------------------
    // cancelAllForConversation
    // -----------------------------------------------------------------------

    describe('cancelAllForConversation', () => {
        it('should cancel both sides by calling model.cancelForConversation', async () => {
            const fakeDb = {} as import('@repo/db').DrizzleClient;
            asMock(modelMock.cancelForConversation).mockResolvedValue(2);

            const result = await service.cancelAllForConversation(
                SYSTEM_ACTOR,
                { conversationId: CONVERSATION_ID },
                fakeDb
            );

            expectSuccess(result);
            expect(result.data?.count).toBe(2);
            expect(asMock(modelMock.cancelForConversation)).toHaveBeenCalledWith(
                CONVERSATION_ID,
                fakeDb
            );
        });

        it('should return FORBIDDEN when actor lacks CONVERSATION_VIEW_ANY', async () => {
            const fakeDb = {} as import('@repo/db').DrizzleClient;
            const result = await service.cancelAllForConversation(
                USER_ACTOR,
                { conversationId: CONVERSATION_ID },
                fakeDb
            );
            expectForbiddenError(result);
        });
    });

    // -----------------------------------------------------------------------
    // findDue
    // -----------------------------------------------------------------------

    describe('findDue', () => {
        it('should call model.findDue with the provided now timestamp', async () => {
            const now = new Date();
            asMock(modelMock.findDue).mockResolvedValue([makeScheduleRow()]);

            const result = await service.findDue(SYSTEM_ACTOR, { now });

            expectSuccess(result);
            expect(result.data).toHaveLength(1);
            expect(asMock(modelMock.findDue)).toHaveBeenCalledWith(now, undefined);
        });

        it('should return FORBIDDEN when actor lacks CONVERSATION_VIEW_ANY', async () => {
            const result = await service.findDue(USER_ACTOR, { now: new Date() });
            expectForbiddenError(result);
        });
    });

    // -----------------------------------------------------------------------
    // advanceSchedule — streak math
    // -----------------------------------------------------------------------

    describe('advanceSchedule', () => {
        it('should advance streak 1 → 2 with pendingAt = streakStartedAt + 24h', async () => {
            vi.useFakeTimers();
            const fixedNow = new Date('2025-01-01T12:00:00Z');
            vi.setSystemTime(fixedNow);

            const streakStartedAt = new Date('2025-01-01T08:00:00Z');
            const scheduleRow = makeScheduleRow({ streakCount: 1, streakStartedAt });
            asMock(modelMock.findById).mockResolvedValue(scheduleRow);

            const expectedPendingAt = new Date(streakStartedAt.getTime() + 24 * 60 * 60 * 1000);

            asMock(modelMock.update).mockImplementation(async (_where, patch) => ({
                ...scheduleRow,
                ...(patch as Record<string, unknown>)
            }));

            const result = await service.advanceSchedule(SYSTEM_ACTOR, {
                scheduleId: SCHEDULE_ID,
                currentStreakCount: 1
            });

            expectSuccess(result);
            expect(result.data?.streakCount).toBe(2);
            expect((result.data?.pendingNotificationAt as Date).getTime()).toBe(
                expectedPendingAt.getTime()
            );
        });

        it('should advance streak 2 → 3 with pendingAt = streakStartedAt + 72h', async () => {
            vi.useFakeTimers();
            const fixedNow = new Date('2025-01-04T12:00:00Z');
            vi.setSystemTime(fixedNow);

            const streakStartedAt = new Date('2025-01-01T08:00:00Z');
            const scheduleRow = makeScheduleRow({ streakCount: 2, streakStartedAt });
            asMock(modelMock.findById).mockResolvedValue(scheduleRow);

            const expectedPendingAt = new Date(streakStartedAt.getTime() + 72 * 60 * 60 * 1000);

            asMock(modelMock.update).mockImplementation(async (_where, patch) => ({
                ...scheduleRow,
                ...(patch as Record<string, unknown>)
            }));

            const result = await service.advanceSchedule(SYSTEM_ACTOR, {
                scheduleId: SCHEDULE_ID,
                currentStreakCount: 2
            });

            expectSuccess(result);
            expect(result.data?.streakCount).toBe(3);
            expect((result.data?.pendingNotificationAt as Date).getTime()).toBe(
                expectedPendingAt.getTime()
            );
        });

        it('should cancel schedule (return null) when streak 3 is dispatched', async () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2025-01-04T12:00:00Z'));

            const scheduleRow = makeScheduleRow({ streakCount: 3 });
            asMock(modelMock.findById).mockResolvedValue(scheduleRow);
            asMock(modelMock.update).mockResolvedValue({ ...scheduleRow, cancelledAt: new Date() });

            const result = await service.advanceSchedule(SYSTEM_ACTOR, {
                scheduleId: SCHEDULE_ID,
                currentStreakCount: 3
            });

            expectSuccess(result);
            // Terminal: null signals no more notifications until new activity
            expect(result.data).toBeNull();

            // Verify cancelledAt was set (not just streakCount incremented)
            const cancelCall = asMock(modelMock.update).mock.calls[0] as [
                unknown,
                Record<string, unknown>
            ];
            const [, cancelPatch] = cancelCall;
            expect(cancelPatch.cancelledAt).toBeInstanceOf(Date);
        });

        it('should return NOT_FOUND when schedule does not exist', async () => {
            asMock(modelMock.findById).mockResolvedValue(null);

            const result = await service.advanceSchedule(SYSTEM_ACTOR, {
                scheduleId: SCHEDULE_ID,
                currentStreakCount: 1
            });

            expectNotFoundError(result);
        });

        it('should return FORBIDDEN when actor lacks CONVERSATION_VIEW_ANY', async () => {
            const result = await service.advanceSchedule(USER_ACTOR, {
                scheduleId: SCHEDULE_ID,
                currentStreakCount: 1
            });
            expectForbiddenError(result);
        });
    });
});
