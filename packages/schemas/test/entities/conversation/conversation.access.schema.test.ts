import { describe, expect, it } from 'vitest';
import {
    AccessTokenSchema,
    GuestConversationResponseSchema,
    RequestAccessSchema,
    VerificationTokenPayloadSchema
} from '../../../src/entities/conversation/conversation.access.schema.js';
import { MessageSenderTypeEnum } from '../../../src/enums/message-sender-type.enum.js';
import { MessageStatusEnum } from '../../../src/enums/message-status.enum.js';

// RFC 4122 v4 UUIDs (required by Zod v4 strict UUID validation)
const UUID_TOKEN = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const UUID_CONV = 'b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6';
const UUID_ACC = 'c3d4e5f6-a7b8-4c9d-ae1f-a2b3c4d5e6f7';
const UUID_MSG = 'd4e5f6a7-b8c9-4d0e-bf2a-b3c4d5e6f7a8';

const validMessage = {
    id: UUID_MSG,
    conversationId: UUID_CONV,
    senderType: MessageSenderTypeEnum.GUEST,
    userId: null,
    body: 'Test message',
    status: MessageStatusEnum.VISIBLE,
    createdAt: '2025-04-01T10:00:00.000Z',
    updatedAt: '2025-04-01T10:00:00.000Z',
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};

// ============================================================================
// AccessTokenSchema
// ============================================================================

describe('AccessTokenSchema', () => {
    const validToken = {
        id: UUID_TOKEN,
        conversationId: UUID_CONV,
        tokenHash: 'a'.repeat(64), // 64 hex chars (SHA-256)
        expiresAt: '2025-05-01T00:00:00.000Z',
        revokedAt: null,
        day15ReminderSentAt: null,
        day25ReminderSentAt: null,
        createdAt: '2025-04-01T00:00:00.000Z'
    };

    describe('when given valid input', () => {
        it('should parse a valid access token row', () => {
            const result = AccessTokenSchema.safeParse(validToken);
            expect(result.success).toBe(true);
        });

        it('should parse with reminder timestamps set', () => {
            const result = AccessTokenSchema.safeParse({
                ...validToken,
                day15ReminderSentAt: '2025-04-16T08:00:00.000Z',
                day25ReminderSentAt: '2025-04-26T08:00:00.000Z'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject a tokenHash that is not exactly 64 characters', () => {
            const result = AccessTokenSchema.safeParse({ ...validToken, tokenHash: 'abc' });
            expect(result.success).toBe(false);
        });

        it('should reject an invalid expiresAt datetime', () => {
            const result = AccessTokenSchema.safeParse({
                ...validToken,
                expiresAt: 'not-a-datetime'
            });
            expect(result.success).toBe(false);
        });

        it('should reject a non-UUID conversationId', () => {
            const result = AccessTokenSchema.safeParse({
                ...validToken,
                conversationId: 'bad-id'
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// VerificationTokenPayloadSchema
// ============================================================================

describe('VerificationTokenPayloadSchema', () => {
    describe('when given valid input', () => {
        it('should parse a valid JWT payload', () => {
            const result = VerificationTokenPayloadSchema.safeParse({
                conversationId: UUID_CONV,
                email: 'alice@example.com'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject an invalid email', () => {
            const result = VerificationTokenPayloadSchema.safeParse({
                conversationId: UUID_CONV,
                email: 'not-valid'
            });
            expect(result.success).toBe(false);
        });

        it('should reject a non-UUID conversationId', () => {
            const result = VerificationTokenPayloadSchema.safeParse({
                conversationId: 'bad-id',
                email: 'alice@example.com'
            });
            expect(result.success).toBe(false);
        });

        it('should reject extra claims (.strict())', () => {
            const result = VerificationTokenPayloadSchema.safeParse({
                conversationId: UUID_CONV,
                email: 'alice@example.com',
                extraField: 'unexpected'
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// RequestAccessSchema
// ============================================================================

describe('RequestAccessSchema', () => {
    describe('when given valid input', () => {
        it('should parse a valid email', () => {
            const result = RequestAccessSchema.safeParse({ email: 'guest@example.com' });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject an invalid email format', () => {
            const result = RequestAccessSchema.safeParse({ email: 'not-an-email' });
            expect(result.success).toBe(false);
        });

        it('should reject extra fields (.strict())', () => {
            const result = RequestAccessSchema.safeParse({
                email: 'guest@example.com',
                extra: 'value'
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// GuestConversationResponseSchema
// ============================================================================

describe('GuestConversationResponseSchema', () => {
    const validResponse = {
        conversationId: UUID_CONV,
        status: 'PENDING_OWNER',
        accommodationName: 'Casa del Río',
        accommodationId: UUID_ACC,
        guestName: 'Alice',
        messages: [validMessage],
        nextCursor: null,
        archivedByGuest: false,
        lastReadAtByGuest: null
    };

    describe('when given valid input', () => {
        it('should parse a valid guest thread response', () => {
            const result = GuestConversationResponseSchema.safeParse(validResponse);
            expect(result.success).toBe(true);
        });

        it('should parse with a nextCursor set', () => {
            const result = GuestConversationResponseSchema.safeParse({
                ...validResponse,
                nextCursor: '2025-04-01T09:00:00.000Z'
            });
            expect(result.success).toBe(true);
        });

        it('should parse with empty messages array', () => {
            const result = GuestConversationResponseSchema.safeParse({
                ...validResponse,
                messages: []
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject a non-UUID conversationId', () => {
            const result = GuestConversationResponseSchema.safeParse({
                ...validResponse,
                conversationId: 'bad-id'
            });
            expect(result.success).toBe(false);
        });

        it('should reject a missing accommodationName', () => {
            const { accommodationName: _removed, ...rest } = validResponse;
            const result = GuestConversationResponseSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });
    });
});
