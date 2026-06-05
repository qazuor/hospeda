/**
 * @file message.service.test.ts
 *
 * Unit tests for MessageService.
 *
 * All model and service interactions are mocked so the suite runs without
 * a live database connection.
 *
 * Coverage targets:
 * - Happy path: GUEST / OWNER message creation, state transitions, metrics, notifications
 * - Content moderation: blocked word, blocked domain, body too long
 * - Guard checks: accommodation deleted, conversation blocked
 * - SYSTEM messages: no notifications, no counters, no sender-side timestamps
 * - State machine: CLOSED → PENDING_OWNER reopen, BLOCKED rejection
 * - Metrics: first_*_message_at only set on first message
 * - getMessages: cursor pagination, nextCursor presence/absence
 */

// Mock withServiceTransaction to avoid requiring a real DB connection.
// The mock passes the ServiceContext (with a fake tx) directly to the callback.
vi.mock('../../../src/utils/transaction.js', () => ({
    withServiceTransaction: vi.fn(
        async (fn: (ctx: Record<string, unknown>) => Promise<unknown>) => {
            const fakeTxClient = {};
            return fn({ tx: fakeTxClient, hookState: {} });
        }
    )
}));

// Mock @repo/content-moderation so MessageService tests are isolated from
// the real engine's env-var parsing.  Each content-moderation test group
// configures the mock return value to simulate blocked / clean results.
vi.mock('@repo/content-moderation', () => ({
    moderateText: vi.fn()
}));

import * as contentModeration from '@repo/content-moderation';
import { AccommodationModel, ConversationModel, MessageModel } from '@repo/db';
import type { SelectConversation, SelectMessage } from '@repo/db';
import {
    ConversationStatusEnum,
    MessageSenderTypeEnum,
    NotificationRecipientSideEnum,
    PermissionEnum,
    RoleEnum
} from '@repo/schemas';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageService } from '../../../src/services/conversation/message.service.js';
import type { NotificationScheduleService } from '../../../src/services/conversation/notification-schedule.service.js';
import { createActor } from '../../factories/actorFactory.js';
import {
    expectForbiddenError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';

/** Clean (no blocked terms) ModerationResult for use as default mock return value. */
const CLEAN_MODERATION_RESULT: contentModeration.ModerationResult = {
    score: 0,
    categories: Object.freeze({
        spam: 0,
        sexual: 0,
        violence: 0,
        hate: 0,
        harassment: 0,
        other: 0
    }),
    matchedTerms: Object.freeze([])
};

/** Blocked ModerationResult for simulating a word/domain hit. */
const BLOCKED_MODERATION_RESULT: contentModeration.ModerationResult = {
    score: 1.0,
    categories: Object.freeze({
        spam: 0,
        sexual: 0,
        violence: 0,
        hate: 0,
        harassment: 0,
        other: 1.0
    }),
    matchedTerms: Object.freeze(['badword'])
};

/** Cast helper for Vitest mock access */
const asMock = <T>(fn: T) => fn as unknown as Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR = createActor({
    id: crypto.randomUUID(),
    role: RoleEnum.USER,
    permissions: [PermissionEnum.CONVERSATION_REPLY_OWN]
});

const ADMIN_ACTOR = createActor({
    id: crypto.randomUUID(),
    role: RoleEnum.SUPER_ADMIN,
    permissions: [
        PermissionEnum.CONVERSATION_VIEW_ANY,
        PermissionEnum.CONVERSATION_REPLY_ANY,
        PermissionEnum.CONVERSATION_DELETE_ANY,
        PermissionEnum.CONVERSATION_UPDATE_STATUS_ANY,
        PermissionEnum.CONVERSATION_REPLY_OWN
    ]
});

const FORBIDDEN_ACTOR = createActor({
    id: crypto.randomUUID(),
    role: RoleEnum.USER,
    permissions: []
});

const CONVERSATION_ID = crypto.randomUUID();
const ACCOMMODATION_ID = crypto.randomUUID();
const MESSAGE_ID = crypto.randomUUID();

function makeConversation(overrides: Partial<SelectConversation> = {}): SelectConversation {
    const now = new Date();
    return {
        id: CONVERSATION_ID,
        accommodationId: ACCOMMODATION_ID,
        userId: null,
        anonymousName: null,
        anonymousEmail: null,
        anonymousEmailVerified: false,
        anonymousPhone: null,
        status: 'OPEN' as SelectConversation['status'],
        blockReason: null,
        locale: 'es',
        archivedByGuest: false,
        archivedByOwner: false,
        lastReadAtByGuest: null,
        lastReadAtByOwner: null,
        firstGuestMessageAt: null,
        firstOwnerReplyAt: null,
        lastActivityAt: null,
        lastGuestMessageAt: null,
        lastOwnerMessageAt: null,
        closedAt: null,
        blockedAt: null,
        guestMessageCount: 0,
        ownerMessageCount: 0,
        createdAt: now,
        updatedAt: now,
        createdById: null,
        updatedById: null,
        deletedAt: null,
        deletedById: null,
        ...overrides
    };
}

function makeMessage(overrides: Partial<SelectMessage> = {}): SelectMessage {
    const now = new Date();
    return {
        id: MESSAGE_ID,
        conversationId: CONVERSATION_ID,
        senderType: 'GUEST' as SelectMessage['senderType'],
        userId: null,
        body: 'Hello, is this place available?',
        status: 'VISIBLE' as SelectMessage['status'],
        createdAt: now,
        updatedAt: now,
        createdById: null,
        updatedById: null,
        deletedAt: null,
        deletedById: null,
        ...overrides
    };
}

function makeAccommodation(overrides: { deletedAt?: Date | null } = {}): {
    deletedAt: Date | null | undefined;
    id: string;
} {
    return { id: ACCOMMODATION_ID, deletedAt: null, ...overrides };
}

// Fake DrizzleClient for ctx.tx
const _fakeTx = {} as import('@repo/db').DrizzleClient;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('MessageService', () => {
    let service: MessageService;
    let messageModelMock: MessageModel;
    let conversationModelMock: ConversationModel;
    let accommodationModelMock: AccommodationModel;
    let notificationScheduleMock: NotificationScheduleService;

    beforeEach(() => {
        messageModelMock = createTypedModelMock(MessageModel, [
            'findByConversationId',
            'countUnread',
            'sumUnreadForOwner'
        ]);
        conversationModelMock = createTypedModelMock(ConversationModel, [
            'findById',
            'findByUserIdAndAccommodationId',
            'findByAnonymousEmailAndAccommodationId',
            'listByUserId',
            'listByAccommodationIds',
            'closeAllForAccommodation'
        ]);
        accommodationModelMock = createTypedModelMock(AccommodationModel, ['findById']);
        notificationScheduleMock = {
            upsertForMessage: vi.fn(),
            cancelForRecipient: vi.fn(),
            cancelAllForConversation: vi.fn()
        } as unknown as NotificationScheduleService;

        const loggerMock = createLoggerMock();
        service = new MessageService(
            { logger: loggerMock },
            messageModelMock,
            conversationModelMock,
            accommodationModelMock,
            notificationScheduleMock
        );

        // Default: content moderation returns clean result (no blocked terms)
        asMock(contentModeration.moderateText).mockResolvedValue(CLEAN_MODERATION_RESULT);

        // Default: notification schedule calls succeed
        asMock(notificationScheduleMock.upsertForMessage).mockResolvedValue({ data: {} });
        asMock(notificationScheduleMock.cancelForRecipient).mockResolvedValue({
            data: { count: 0 }
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Happy path: GUEST message in OPEN conversation
    // -----------------------------------------------------------------------

    describe('createMessage — happy path (GUEST → OPEN)', () => {
        it('should insert message, update metrics, schedule notifications for owner, cancel for guest', async () => {
            // Arrange
            const conversation = makeConversation({
                status: 'OPEN' as SelectConversation['status'],
                guestMessageCount: 2
            });
            const message = makeMessage({ senderType: 'GUEST' });

            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(messageModelMock.create).mockResolvedValue(message);
            asMock(conversationModelMock.update).mockResolvedValue(conversation);

            // Act
            const result = await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'Is this place available in July?',
                userId: ACTOR.id
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.senderType).toBe('GUEST');

            // Metrics update: status should transition to PENDING_OWNER
            const updateCall = asMock(conversationModelMock.update).mock.calls[0] as [
                Record<string, unknown>,
                Record<string, unknown>
            ];
            expect(updateCall[1].status).toBe(ConversationStatusEnum.PENDING_OWNER);
            expect(updateCall[1].guestMessageCount).toBe(3); // was 2, now 3
            expect(updateCall[1].lastActivityAt).toBeDefined();
            expect(updateCall[1].lastGuestMessageAt).toBeDefined();

            // Notification schedule: upsert for OWNER (recipient), cancel for GUEST (sender)
            const upsertCall = asMock(notificationScheduleMock.upsertForMessage).mock.calls[0] as [
                unknown,
                { conversationId: string; recipientSide: NotificationRecipientSideEnum }
            ];
            expect(upsertCall[1].recipientSide).toBe(NotificationRecipientSideEnum.OWNER);

            const cancelCall = asMock(notificationScheduleMock.cancelForRecipient).mock
                .calls[0] as [
                unknown,
                { conversationId: string; recipientSide: NotificationRecipientSideEnum }
            ];
            expect(cancelCall[1].recipientSide).toBe(NotificationRecipientSideEnum.GUEST);
        });
    });

    // -----------------------------------------------------------------------
    // State machine transitions
    // -----------------------------------------------------------------------

    describe('createMessage — state machine', () => {
        it('GUEST message in PENDING_GUEST → PENDING_OWNER', async () => {
            const conversation = makeConversation({
                status: 'PENDING_GUEST' as SelectConversation['status']
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(messageModelMock.create).mockResolvedValue(makeMessage());
            asMock(conversationModelMock.update).mockResolvedValue(conversation);

            const result = await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'Reply from guest'
            });

            expectSuccess(result);
            const updateCall = asMock(conversationModelMock.update).mock.calls[0] as [
                unknown,
                Record<string, unknown>
            ];
            expect(updateCall[1].status).toBe(ConversationStatusEnum.PENDING_OWNER);
        });

        it('OWNER message in PENDING_OWNER → PENDING_GUEST', async () => {
            const conversation = makeConversation({
                status: 'PENDING_OWNER' as SelectConversation['status']
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(messageModelMock.create).mockResolvedValue(makeMessage({ senderType: 'OWNER' }));
            asMock(conversationModelMock.update).mockResolvedValue(conversation);

            const result = await service.createMessage(ADMIN_ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.OWNER,
                body: 'Hello, yes we are available!'
            });

            expectSuccess(result);
            const updateCall = asMock(conversationModelMock.update).mock.calls[0] as [
                unknown,
                Record<string, unknown>
            ];
            expect(updateCall[1].status).toBe(ConversationStatusEnum.PENDING_GUEST);
        });

        it('OWNER message in OPEN → PENDING_GUEST', async () => {
            const conversation = makeConversation({
                status: 'OPEN' as SelectConversation['status']
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(messageModelMock.create).mockResolvedValue(makeMessage({ senderType: 'OWNER' }));
            asMock(conversationModelMock.update).mockResolvedValue(conversation);

            const result = await service.createMessage(ADMIN_ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.OWNER,
                body: 'Welcome!'
            });

            expectSuccess(result);
            const updateCall = asMock(conversationModelMock.update).mock.calls[0] as [
                unknown,
                Record<string, unknown>
            ];
            expect(updateCall[1].status).toBe(ConversationStatusEnum.PENDING_GUEST);
        });

        it('GUEST message in CLOSED → PENDING_OWNER (auto-reopen)', async () => {
            const conversation = makeConversation({
                status: 'CLOSED' as SelectConversation['status']
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(messageModelMock.create).mockResolvedValue(makeMessage());
            asMock(conversationModelMock.update).mockResolvedValue(conversation);

            const result = await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'Just checking again!'
            });

            expectSuccess(result);
            const updateCall = asMock(conversationModelMock.update).mock.calls[0] as [
                unknown,
                Record<string, unknown>
            ];
            expect(updateCall[1].status).toBe(ConversationStatusEnum.PENDING_OWNER);
        });

        it('SYSTEM message — status is unchanged', async () => {
            const conversation = makeConversation({
                status: 'OPEN' as SelectConversation['status']
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(messageModelMock.create).mockResolvedValue(
                makeMessage({ senderType: 'SYSTEM' })
            );
            asMock(conversationModelMock.update).mockResolvedValue(conversation);

            const result = await service.createMessage(ADMIN_ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.SYSTEM,
                body: 'Conversation closed by owner'
            });

            expectSuccess(result);
            const updateCall = asMock(conversationModelMock.update).mock.calls[0] as [
                unknown,
                Record<string, unknown>
            ];
            // status is not changed since senderType = SYSTEM
            expect(updateCall[1].status).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Guard: BLOCKED conversation
    // -----------------------------------------------------------------------

    describe('createMessage — BLOCKED conversation', () => {
        it('should reject with CONVERSATION_BLOCKED reason', async () => {
            const conversation = makeConversation({
                status: 'BLOCKED' as SelectConversation['status']
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());

            const result = await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'Hello!'
            });

            expect(result.error?.code).toBe('FORBIDDEN');
            expect((result.error as unknown as { reason?: string })?.reason).toBe(
                'CONVERSATION_BLOCKED'
            );
            expect(asMock(messageModelMock.create)).not.toHaveBeenCalled();
            expect(asMock(conversationModelMock.update)).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Guard: accommodation soft-deleted
    // -----------------------------------------------------------------------

    describe('createMessage — accommodation soft-deleted', () => {
        it('should reject with ACCOMMODATION_DELETED reason', async () => {
            const conversation = makeConversation({
                status: 'OPEN' as SelectConversation['status']
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(
                makeAccommodation({ deletedAt: new Date() })
            );

            const result = await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'Hello!'
            });

            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect((result.error as unknown as { reason?: string })?.reason).toBe(
                'ACCOMMODATION_DELETED'
            );
            expect(asMock(messageModelMock.create)).not.toHaveBeenCalled();
        });

        it('should reject when accommodation is null (not found)', async () => {
            const conversation = makeConversation({
                status: 'OPEN' as SelectConversation['status']
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(null);

            const result = await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'Hello!'
            });

            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect((result.error as unknown as { reason?: string })?.reason).toBe(
                'ACCOMMODATION_DELETED'
            );
        });
    });

    // -----------------------------------------------------------------------
    // Guard: conversation not found
    // -----------------------------------------------------------------------

    describe('createMessage — conversation not found', () => {
        it('should reject with CONVERSATION_NOT_FOUND reason', async () => {
            asMock(conversationModelMock.findById).mockResolvedValue(null);

            const result = await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'Hello!'
            });

            expect(result.error?.code).toBe('NOT_FOUND');
            expect((result.error as unknown as { reason?: string })?.reason).toBe(
                'CONVERSATION_NOT_FOUND'
            );
        });
    });

    // -----------------------------------------------------------------------
    // Content moderation — body too long
    // -----------------------------------------------------------------------

    describe('createMessage — body too long', () => {
        it('should reject body exceeding 5000 chars with MESSAGE_TOO_LONG', async () => {
            const conversation = makeConversation();
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());

            const result = await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'a'.repeat(5001)
            });

            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect((result.error as unknown as { reason?: string })?.reason).toBe(
                'MESSAGE_TOO_LONG'
            );
            expect(asMock(messageModelMock.create)).not.toHaveBeenCalled();
        });

        it('should allow body exactly at 5000 chars', async () => {
            const conversation = makeConversation();
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(messageModelMock.create).mockResolvedValue(
                makeMessage({ body: 'a'.repeat(5000) })
            );
            asMock(conversationModelMock.update).mockResolvedValue(conversation);

            const result = await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'a'.repeat(5000)
            });

            expectSuccess(result);
        });
    });

    // -----------------------------------------------------------------------
    // Content moderation — blocked word (REGRESSION — T-011)
    // -----------------------------------------------------------------------

    describe('createMessage — blocked word (via @repo/content-moderation)', () => {
        it('should reject body with a blocked word — error code VALIDATION_ERROR + reason MESSAGE_CONTENT_BLOCKED', async () => {
            // Arrange — simulate moderateText reporting a blocked word hit
            asMock(contentModeration.moderateText).mockResolvedValue(BLOCKED_MODERATION_RESULT);

            const conversation = makeConversation();
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());

            // Act
            const result = await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'This contains badword here'
            });

            // Assert
            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect((result.error as unknown as { reason?: string })?.reason).toBe(
                'MESSAGE_CONTENT_BLOCKED'
            );
            expect(asMock(messageModelMock.create)).not.toHaveBeenCalled();
        });

        it('should pass a body with no blocked words (clean result)', async () => {
            // Arrange — default mock returns CLEAN_MODERATION_RESULT (set in beforeEach)
            const conversation = makeConversation();
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(messageModelMock.create).mockResolvedValue(makeMessage());
            asMock(conversationModelMock.update).mockResolvedValue(conversation);

            // Act
            const result = await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'Hello, is this place available in July?'
            });

            // Assert
            expectSuccess(result);
        });

        it('should pass context "message" to moderateText', async () => {
            // Arrange
            const conversation = makeConversation();
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(messageModelMock.create).mockResolvedValue(makeMessage());
            asMock(conversationModelMock.update).mockResolvedValue(conversation);

            // Act
            await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'Hello!'
            });

            // Assert — moderateText called with context: 'message'
            const moderateCall = asMock(contentModeration.moderateText).mock.calls[0] as [
                { text: string; context?: string }
            ];
            expect(moderateCall[0].context).toBe('message');
        });
    });

    // -----------------------------------------------------------------------
    // Content moderation — blocked domain (REGRESSION — T-011)
    // -----------------------------------------------------------------------

    describe('createMessage — blocked domain (via @repo/content-moderation)', () => {
        it('should reject body with a blocked domain URL — error code VALIDATION_ERROR + reason MESSAGE_CONTENT_BLOCKED', async () => {
            // Arrange — simulate moderateText reporting a blocked domain hit
            const domainBlockedResult: contentModeration.ModerationResult = {
                score: 1.0,
                categories: Object.freeze({
                    spam: 0,
                    sexual: 0,
                    violence: 0,
                    hate: 0,
                    harassment: 0,
                    other: 1.0
                }),
                matchedTerms: Object.freeze(['spam.com'])
            };
            asMock(contentModeration.moderateText).mockResolvedValue(domainBlockedResult);

            const conversation = makeConversation();
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());

            // Act
            const result = await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'Visit https://spam.com for deals'
            });

            // Assert
            expect(result.error?.code).toBe('VALIDATION_ERROR');
            expect((result.error as unknown as { reason?: string })?.reason).toBe(
                'MESSAGE_CONTENT_BLOCKED'
            );
            expect(asMock(messageModelMock.create)).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // SYSTEM message: no notification scheduling, no counters
    // -----------------------------------------------------------------------

    describe('createMessage — SYSTEM message', () => {
        it('should NOT call notification scheduling for SYSTEM messages', async () => {
            const conversation = makeConversation({
                status: 'OPEN' as SelectConversation['status']
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(messageModelMock.create).mockResolvedValue(
                makeMessage({ senderType: 'SYSTEM' })
            );
            asMock(conversationModelMock.update).mockResolvedValue(conversation);

            await service.createMessage(ADMIN_ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.SYSTEM,
                body: 'Conversation closed by owner'
            });

            expect(asMock(notificationScheduleMock.upsertForMessage)).not.toHaveBeenCalled();
            expect(asMock(notificationScheduleMock.cancelForRecipient)).not.toHaveBeenCalled();
        });

        it('should NOT increment message_count or update last_*_message_at for SYSTEM messages', async () => {
            const conversation = makeConversation({
                status: 'OPEN' as SelectConversation['status'],
                guestMessageCount: 5,
                ownerMessageCount: 3
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(messageModelMock.create).mockResolvedValue(
                makeMessage({ senderType: 'SYSTEM' })
            );
            asMock(conversationModelMock.update).mockResolvedValue(conversation);

            await service.createMessage(ADMIN_ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.SYSTEM,
                body: 'Conversation closed'
            });

            const updateCall = asMock(conversationModelMock.update).mock.calls[0] as [
                unknown,
                Record<string, unknown>
            ];
            expect(updateCall[1].guestMessageCount).toBeUndefined();
            expect(updateCall[1].ownerMessageCount).toBeUndefined();
            expect(updateCall[1].lastGuestMessageAt).toBeUndefined();
            expect(updateCall[1].lastOwnerMessageAt).toBeUndefined();
            // lastActivityAt is ALWAYS updated
            expect(updateCall[1].lastActivityAt).toBeDefined();
        });
    });

    // -----------------------------------------------------------------------
    // Metrics: first_guest_message_at only set on first message
    // -----------------------------------------------------------------------

    describe('createMessage — firstGuestMessageAt', () => {
        it('should set firstGuestMessageAt on the first guest message', async () => {
            const conversation = makeConversation({ firstGuestMessageAt: null });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(messageModelMock.create).mockResolvedValue(makeMessage());
            asMock(conversationModelMock.update).mockResolvedValue(conversation);

            await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'First message!'
            });

            const updateCall = asMock(conversationModelMock.update).mock.calls[0] as [
                unknown,
                Record<string, unknown>
            ];
            expect(updateCall[1].firstGuestMessageAt).toBeDefined();
        });

        it('should NOT reset firstGuestMessageAt on subsequent guest messages', async () => {
            const existingFirstAt = new Date(Date.now() - 60_000);
            const conversation = makeConversation({
                firstGuestMessageAt: existingFirstAt,
                guestMessageCount: 3
            });
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(messageModelMock.create).mockResolvedValue(makeMessage());
            asMock(conversationModelMock.update).mockResolvedValue(conversation);

            await service.createMessage(ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'Fourth message'
            });

            const updateCall = asMock(conversationModelMock.update).mock.calls[0] as [
                unknown,
                Record<string, unknown>
            ];
            // Should NOT include firstGuestMessageAt in the update (it already has a value)
            expect(updateCall[1].firstGuestMessageAt).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Metrics: lastActivityAt always updates
    // -----------------------------------------------------------------------

    describe('createMessage — lastActivityAt', () => {
        it('should always update lastActivityAt regardless of senderType', async () => {
            for (const senderType of [
                MessageSenderTypeEnum.GUEST,
                MessageSenderTypeEnum.OWNER,
                MessageSenderTypeEnum.SYSTEM
            ]) {
                vi.clearAllMocks();

                const conversation = makeConversation({
                    status: 'OPEN' as SelectConversation['status']
                });
                asMock(conversationModelMock.findById).mockResolvedValue(conversation);
                asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
                asMock(messageModelMock.create).mockResolvedValue(
                    makeMessage({ senderType: senderType as SelectMessage['senderType'] })
                );
                asMock(conversationModelMock.update).mockResolvedValue(conversation);
                asMock(notificationScheduleMock.upsertForMessage).mockResolvedValue({ data: {} });
                asMock(notificationScheduleMock.cancelForRecipient).mockResolvedValue({
                    data: { count: 0 }
                });

                await service.createMessage(ADMIN_ACTOR, {
                    conversationId: CONVERSATION_ID,
                    senderType,
                    body: 'Test message'
                });

                const updateCall = asMock(conversationModelMock.update).mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(updateCall[1].lastActivityAt).toBeDefined();
            }
        });
    });

    // -----------------------------------------------------------------------
    // Permission check
    // -----------------------------------------------------------------------

    describe('createMessage — permissions', () => {
        it('should return FORBIDDEN for actor without write permissions', async () => {
            const result = await service.createMessage(FORBIDDEN_ACTOR, {
                conversationId: CONVERSATION_ID,
                senderType: MessageSenderTypeEnum.GUEST,
                body: 'Hello!'
            });

            expectForbiddenError(result);
            expect(asMock(conversationModelMock.findById)).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // createSystemMessage
    // -----------------------------------------------------------------------

    describe('createSystemMessage', () => {
        it('should create a SYSTEM message successfully', async () => {
            const conversation = makeConversation();
            asMock(conversationModelMock.findById).mockResolvedValue(conversation);
            asMock(accommodationModelMock.findById).mockResolvedValue(makeAccommodation());
            asMock(messageModelMock.create).mockResolvedValue(
                makeMessage({ senderType: 'SYSTEM' })
            );
            asMock(conversationModelMock.update).mockResolvedValue(conversation);

            const result = await service.createSystemMessage(ADMIN_ACTOR, {
                conversationId: CONVERSATION_ID,
                body: 'Conversation closed by owner'
            });

            expectSuccess(result);
        });
    });

    // -----------------------------------------------------------------------
    // getMessages — cursor-based pagination
    // -----------------------------------------------------------------------

    describe('getMessages', () => {
        it('should return first page without cursor and include nextCursor when more exist', async () => {
            // Arrange: 51 rows returned means there are more older messages
            const rows = Array.from({ length: 51 }, (_, i) =>
                makeMessage({ id: crypto.randomUUID(), createdAt: new Date(Date.now() - i * 1000) })
            ).reverse(); // oldest first

            asMock(messageModelMock.findByConversationId).mockResolvedValue(rows);

            // Act
            const result = await service.getMessages(ACTOR, {
                conversationId: CONVERSATION_ID,
                limit: 50
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.messages).toHaveLength(50);
            expect(result.data?.nextCursor).toBeDefined();
        });

        it('should return all messages and NO nextCursor when result fits in one page', async () => {
            const rows = Array.from({ length: 10 }, (_, i) =>
                makeMessage({ id: crypto.randomUUID(), createdAt: new Date(Date.now() - i * 1000) })
            );
            asMock(messageModelMock.findByConversationId).mockResolvedValue(rows);

            const result = await service.getMessages(ACTOR, {
                conversationId: CONVERSATION_ID,
                limit: 50
            });

            expectSuccess(result);
            expect(result.data?.messages).toHaveLength(10);
            expect(result.data?.nextCursor).toBeUndefined();
        });

        it('should pass the cursor to the model when provided', async () => {
            const cursor = new Date(Date.now() - 5000);
            asMock(messageModelMock.findByConversationId).mockResolvedValue([]);

            await service.getMessages(ACTOR, { conversationId: CONVERSATION_ID, cursor });

            const call = asMock(messageModelMock.findByConversationId).mock.calls[0] as [
                string,
                { cursor?: Date; limit?: number }
            ];
            expect(call[1].cursor).toEqual(cursor);
        });

        it('should reject limit > 100 with a validation error', async () => {
            // The Zod schema enforces max 100; the model is never called.
            const result = await service.getMessages(ACTOR, {
                conversationId: CONVERSATION_ID,
                limit: 200 // exceeds max
            });

            expectValidationError(result);
            expect(asMock(messageModelMock.findByConversationId)).not.toHaveBeenCalled();
        });

        it('should return FORBIDDEN for actor without read permissions', async () => {
            const result = await service.getMessages(FORBIDDEN_ACTOR, {
                conversationId: CONVERSATION_ID
            });

            expectForbiddenError(result);
        });
    });
});
