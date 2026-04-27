import { describe, expect, it } from 'vitest';
import {
    ConversationWithRelationsSchema,
    MessageWithSenderSchema
} from '../../../src/entities/conversation/conversation.relations.schema.js';
import { ConversationStatusEnum } from '../../../src/enums/conversation-status.enum.js';
import { MessageSenderTypeEnum } from '../../../src/enums/message-sender-type.enum.js';
import { MessageStatusEnum } from '../../../src/enums/message-status.enum.js';

// RFC 4122 v4 UUIDs (required by Zod v4 strict UUID validation)
const UUID_CONV = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const UUID_ACC = 'b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6';
const UUID_USER = 'c3d4e5f6-a7b8-4c9d-ae1f-a2b3c4d5e6f7';
const UUID_MSG = 'd4e5f6a7-b8c9-4d0e-bf2a-b3c4d5e6f7a8';

const baseConversation = {
    id: UUID_CONV,
    accommodationId: UUID_ACC,
    userId: null,
    anonymousName: 'Alice',
    anonymousEmail: 'alice@example.com',
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

const baseMessageWithSender = {
    id: UUID_MSG,
    conversationId: UUID_CONV,
    senderType: MessageSenderTypeEnum.GUEST,
    userId: null,
    body: 'Hello, I am interested!',
    status: MessageStatusEnum.VISIBLE,
    createdAt: '2025-04-01T10:00:00.000Z',
    updatedAt: '2025-04-01T10:00:00.000Z',
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    senderDisplayName: 'Alice',
    senderAvatarUrl: null
};

const baseAccommodationRef = {
    id: UUID_ACC,
    slug: 'casa-del-rio',
    name: 'Casa del Río',
    deletedAt: null
};

const baseGuestIdentity = {
    displayName: 'Alice',
    email: 'alice@example.com',
    isAuthenticated: false,
    userId: null
};

// ============================================================================
// MessageWithSenderSchema
// ============================================================================

describe('MessageWithSenderSchema', () => {
    describe('when given valid input', () => {
        it('should parse a message with sender display info', () => {
            const result = MessageWithSenderSchema.safeParse(baseMessageWithSender);
            expect(result.success).toBe(true);
        });

        it('should parse an owner message with avatar URL', () => {
            const result = MessageWithSenderSchema.safeParse({
                ...baseMessageWithSender,
                senderType: MessageSenderTypeEnum.OWNER,
                userId: UUID_USER,
                senderDisplayName: 'Host',
                senderAvatarUrl: 'https://example.com/avatar.jpg'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject a missing senderDisplayName', () => {
            const { senderDisplayName: _removed, ...rest } = baseMessageWithSender;
            const result = MessageWithSenderSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject an invalid senderAvatarUrl (not a URL)', () => {
            const result = MessageWithSenderSchema.safeParse({
                ...baseMessageWithSender,
                senderAvatarUrl: 'not-a-url'
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// ConversationWithRelationsSchema
// ============================================================================

describe('ConversationWithRelationsSchema', () => {
    const validWithRelations = {
        ...baseConversation,
        messages: [baseMessageWithSender],
        accommodation: baseAccommodationRef,
        guestIdentity: baseGuestIdentity
    };

    describe('when given valid input', () => {
        it('should parse a fully populated conversation with relations', () => {
            const result = ConversationWithRelationsSchema.safeParse(validWithRelations);
            expect(result.success).toBe(true);
        });

        it('should parse with empty messages array', () => {
            const result = ConversationWithRelationsSchema.safeParse({
                ...validWithRelations,
                messages: []
            });
            expect(result.success).toBe(true);
        });

        it('should parse with an authenticated guest identity', () => {
            const result = ConversationWithRelationsSchema.safeParse({
                ...validWithRelations,
                guestIdentity: {
                    displayName: 'Bob',
                    email: 'bob@example.com',
                    isAuthenticated: true,
                    userId: UUID_USER
                }
            });
            expect(result.success).toBe(true);
        });

        it('should parse with a soft-deleted accommodation', () => {
            const result = ConversationWithRelationsSchema.safeParse({
                ...validWithRelations,
                accommodation: {
                    ...baseAccommodationRef,
                    deletedAt: '2025-04-20T00:00:00.000Z'
                }
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject a missing accommodation field', () => {
            const { accommodation: _removed, ...rest } = validWithRelations;
            const result = ConversationWithRelationsSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject a missing guestIdentity field', () => {
            const { guestIdentity: _removed, ...rest } = validWithRelations;
            const result = ConversationWithRelationsSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject an accommodation with a non-UUID id', () => {
            const result = ConversationWithRelationsSchema.safeParse({
                ...validWithRelations,
                accommodation: { ...baseAccommodationRef, id: 'bad-id' }
            });
            expect(result.success).toBe(false);
        });
    });
});
