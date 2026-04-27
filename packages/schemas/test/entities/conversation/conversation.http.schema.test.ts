import { describe, expect, it } from 'vitest';
import {
    ConversationErrorReasonSchema,
    InitiateAnonResponseSchema,
    InitiateAuthResponseSchema,
    ThreadResponseSchema,
    UnreadCountResponseSchema
} from '../../../src/entities/conversation/conversation.http.schema.js';
import { ConversationStatusEnum } from '../../../src/enums/conversation-status.enum.js';
import { MessageSenderTypeEnum } from '../../../src/enums/message-sender-type.enum.js';
import { MessageStatusEnum } from '../../../src/enums/message-status.enum.js';

// RFC 4122 v4 UUIDs (required by Zod v4 strict UUID validation)
const UUID_CONV = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const UUID_ACC = 'b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6';
const UUID_MSG = 'c3d4e5f6-a7b8-4c9d-ae1f-a2b3c4d5e6f7';
const UUID_MSG2 = 'd4e5f6a7-b8c9-4d0e-bf2a-b3c4d5e6f7a8';

const baseConversation = {
    id: UUID_CONV,
    accommodationId: UUID_ACC,
    userId: null,
    anonymousName: 'Bob',
    anonymousEmail: 'bob@example.com',
    anonymousEmailVerified: true,
    anonymousPhone: null,
    status: ConversationStatusEnum.PENDING_OWNER,
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
    guestMessageCount: 1,
    ownerMessageCount: 0,
    createdAt: '2025-04-01T00:00:00.000Z',
    updatedAt: '2025-04-01T00:00:00.000Z',
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};

const baseMessage = {
    id: UUID_MSG,
    conversationId: UUID_CONV,
    senderType: MessageSenderTypeEnum.GUEST,
    userId: null,
    body: 'Hi, is your place available?',
    status: MessageStatusEnum.VISIBLE,
    createdAt: '2025-04-01T10:00:00.000Z',
    updatedAt: '2025-04-01T10:00:00.000Z',
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};

// ============================================================================
// ConversationErrorReasonSchema
// ============================================================================

describe('ConversationErrorReasonSchema', () => {
    const validReasons = [
        'TOKEN_EXPIRED',
        'TOKEN_REVOKED',
        'MESSAGE_CONTENT_BLOCKED',
        'MESSAGE_TOO_LONG',
        'CONVERSATION_DUPLICATE',
        'CONVERSATION_NOT_FOUND',
        'ACCOMMODATION_DELETED',
        'RATE_LIMIT_EXCEEDED',
        'VERIFICATION_INVALID',
        'CONVERSATION_BLOCKED'
    ] as const;

    it('should accept all canonical error reason codes', () => {
        for (const reason of validReasons) {
            const result = ConversationErrorReasonSchema.safeParse(reason);
            expect(result.success).toBe(true);
        }
    });

    it('should reject an unknown reason code', () => {
        const result = ConversationErrorReasonSchema.safeParse('UNKNOWN_REASON');
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// InitiateAnonResponseSchema
// ============================================================================

describe('InitiateAnonResponseSchema', () => {
    describe('when given valid input', () => {
        it('should parse a pending_verification outcome with conversationId', () => {
            const result = InitiateAnonResponseSchema.safeParse({
                status: 'pending_verification',
                conversationId: UUID_CONV
            });
            expect(result.success).toBe(true);
        });

        it('should parse a resent outcome', () => {
            const result = InitiateAnonResponseSchema.safeParse({
                status: 'resent',
                conversationId: UUID_CONV
            });
            expect(result.success).toBe(true);
        });

        it('should parse a conflict outcome without conversationId', () => {
            const result = InitiateAnonResponseSchema.safeParse({ status: 'conflict' });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject an unknown status discriminator', () => {
            const result = InitiateAnonResponseSchema.safeParse({ status: 'created' });
            expect(result.success).toBe(false);
        });

        it('should reject an invalid conversationId', () => {
            const result = InitiateAnonResponseSchema.safeParse({
                status: 'pending_verification',
                conversationId: 'not-a-uuid'
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// InitiateAuthResponseSchema
// ============================================================================

describe('InitiateAuthResponseSchema', () => {
    describe('when given valid input', () => {
        it('should parse a new-conversation response', () => {
            const result = InitiateAuthResponseSchema.safeParse({
                conversationId: UUID_CONV,
                isNew: true,
                messageId: UUID_MSG
            });
            expect(result.success).toBe(true);
        });

        it('should parse an append-to-existing response', () => {
            const result = InitiateAuthResponseSchema.safeParse({
                conversationId: UUID_CONV,
                isNew: false,
                messageId: UUID_MSG2
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject a missing messageId', () => {
            const result = InitiateAuthResponseSchema.safeParse({
                conversationId: UUID_CONV,
                isNew: true
            });
            expect(result.success).toBe(false);
        });

        it('should reject a non-boolean isNew', () => {
            const result = InitiateAuthResponseSchema.safeParse({
                conversationId: UUID_CONV,
                isNew: 'yes',
                messageId: UUID_MSG
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// ThreadResponseSchema
// ============================================================================

describe('ThreadResponseSchema', () => {
    describe('when given valid input', () => {
        it('should parse a thread with messages and no nextCursor', () => {
            const result = ThreadResponseSchema.safeParse({
                conversation: baseConversation,
                messages: [baseMessage],
                nextCursor: null
            });
            expect(result.success).toBe(true);
        });

        it('should parse a thread with a nextCursor set', () => {
            const result = ThreadResponseSchema.safeParse({
                conversation: baseConversation,
                messages: [baseMessage],
                nextCursor: '2025-04-01T09:59:00.000Z'
            });
            expect(result.success).toBe(true);
        });

        it('should parse a thread with empty messages array', () => {
            const result = ThreadResponseSchema.safeParse({
                conversation: baseConversation,
                messages: [],
                nextCursor: null
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject a missing conversation field', () => {
            const result = ThreadResponseSchema.safeParse({
                messages: [baseMessage],
                nextCursor: null
            });
            expect(result.success).toBe(false);
        });

        it('should reject an invalid nextCursor (not ISO-8601)', () => {
            const result = ThreadResponseSchema.safeParse({
                conversation: baseConversation,
                messages: [],
                nextCursor: 'not-a-date'
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// UnreadCountResponseSchema
// ============================================================================

describe('UnreadCountResponseSchema', () => {
    describe('when given valid input', () => {
        it('should parse { count: 0 }', () => {
            const result = UnreadCountResponseSchema.safeParse({ count: 0 });
            expect(result.success).toBe(true);
        });

        it('should parse { count: 42 }', () => {
            const result = UnreadCountResponseSchema.safeParse({ count: 42 });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject a negative count', () => {
            const result = UnreadCountResponseSchema.safeParse({ count: -1 });
            expect(result.success).toBe(false);
        });

        it('should reject a non-integer count', () => {
            const result = UnreadCountResponseSchema.safeParse({ count: 1.5 });
            expect(result.success).toBe(false);
        });
    });
});
