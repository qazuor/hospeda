import { describe, expect, it } from 'vitest';
import { MessageSchema } from '../../../src/entities/conversation/message.schema.js';
import { MessageSenderTypeEnum } from '../../../src/enums/message-sender-type.enum.js';
import { MessageStatusEnum } from '../../../src/enums/message-status.enum.js';

// RFC 4122 v4 UUIDs (required by Zod v4 strict UUID validation)
const UUID_MSG = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const UUID_CONV = 'b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6';
const UUID_USER = 'c3d4e5f6-a7b8-4c9d-ae1f-a2b3c4d5e6f7';

const validMessage = {
    id: UUID_MSG,
    conversationId: UUID_CONV,
    senderType: MessageSenderTypeEnum.GUEST,
    userId: null,
    body: 'Hello, I would like to book your accommodation.',
    status: MessageStatusEnum.VISIBLE,
    createdAt: '2025-04-01T10:00:00.000Z',
    updatedAt: '2025-04-01T10:00:00.000Z',
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};

describe('MessageSchema', () => {
    describe('when given valid input', () => {
        it('should parse a valid guest message', () => {
            // Arrange
            const input = { ...validMessage };

            // Act
            const result = MessageSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse an owner message with userId set', () => {
            // Arrange
            const input = {
                ...validMessage,
                senderType: MessageSenderTypeEnum.OWNER,
                userId: UUID_USER
            };

            // Act
            const result = MessageSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse a system message with SYSTEM status', () => {
            // Arrange
            const input = {
                ...validMessage,
                senderType: MessageSenderTypeEnum.SYSTEM,
                status: MessageStatusEnum.SYSTEM,
                body: 'Conversation closed by owner.'
            };

            // Act
            const result = MessageSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a body of exactly 5000 characters', () => {
            // Arrange
            const input = { ...validMessage, body: 'a'.repeat(5000) };

            // Act
            const result = MessageSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject an empty body', () => {
            // Arrange
            const input = { ...validMessage, body: '' };

            // Act
            const result = MessageSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a body exceeding 5000 characters', () => {
            // Arrange
            const input = { ...validMessage, body: 'a'.repeat(5001) };

            // Act
            const result = MessageSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an invalid senderType', () => {
            // Arrange
            const input = { ...validMessage, senderType: 'UNKNOWN' };

            // Act
            const result = MessageSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an invalid status', () => {
            // Arrange
            const input = { ...validMessage, status: 'DELETED' };

            // Act
            const result = MessageSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a non-UUID conversationId', () => {
            // Arrange
            const input = { ...validMessage, conversationId: 'not-a-uuid' };

            // Act
            const result = MessageSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});
