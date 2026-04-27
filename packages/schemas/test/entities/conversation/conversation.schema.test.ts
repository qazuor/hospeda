import { describe, expect, it } from 'vitest';
import { ConversationSchema } from '../../../src/entities/conversation/conversation.schema.js';
import { ConversationStatusEnum } from '../../../src/enums/conversation-status.enum.js';

// RFC 4122 v4 UUIDs (required by Zod v4 strict UUID validation)
const UUID_CONV = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const UUID_ACC = 'b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6';
const UUID_USER = 'c3d4e5f6-a7b8-4c9d-ae1f-a2b3c4d5e6f7';

const validConversation = {
    id: UUID_CONV,
    accommodationId: UUID_ACC,
    userId: null,
    anonymousName: 'Alice',
    anonymousEmail: 'alice@example.com',
    anonymousEmailVerified: false,
    anonymousPhone: null,
    status: ConversationStatusEnum.PENDING_VERIFICATION,
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
    createdAt: '2025-04-01T00:00:00.000Z',
    updatedAt: '2025-04-01T00:00:00.000Z',
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};

describe('ConversationSchema', () => {
    describe('when given valid input', () => {
        it('should parse a fully populated anonymous conversation', () => {
            // Arrange
            const input = { ...validConversation };

            // Act
            const result = ConversationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse a conversation with an authenticated userId', () => {
            // Arrange
            const input = {
                ...validConversation,
                userId: UUID_USER,
                anonymousName: null,
                anonymousEmail: null
            };

            // Act
            const result = ConversationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse all ConversationStatusEnum values', () => {
            for (const status of Object.values(ConversationStatusEnum)) {
                const result = ConversationSchema.safeParse({ ...validConversation, status });
                expect(result.success).toBe(true);
            }
        });

        it('should parse a conversation with datetime fields set', () => {
            // Arrange
            const input = {
                ...validConversation,
                lastReadAtByOwner: '2025-04-10T12:00:00.000Z',
                lastActivityAt: '2025-04-10T12:00:00.000Z',
                guestMessageCount: 3,
                ownerMessageCount: 1
            };

            // Act
            const result = ConversationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject a non-UUID accommodationId', () => {
            // Arrange
            const input = { ...validConversation, accommodationId: 'not-a-uuid' };

            // Act
            const result = ConversationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an invalid anonymousEmail', () => {
            // Arrange
            const input = { ...validConversation, anonymousEmail: 'not-an-email' };

            // Act
            const result = ConversationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an invalid status value', () => {
            // Arrange
            const input = { ...validConversation, status: 'INVALID_STATUS' };

            // Act
            const result = ConversationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an invalid datetime for createdAt', () => {
            // Arrange
            const input = { ...validConversation, createdAt: 'not-a-date' };

            // Act
            const result = ConversationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a negative guestMessageCount', () => {
            // Arrange
            const input = { ...validConversation, guestMessageCount: -1 };

            // Act
            const result = ConversationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});
