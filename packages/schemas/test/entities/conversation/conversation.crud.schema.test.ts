import { describe, expect, it } from 'vitest';
import {
    ArchiveConversationSchema,
    CreateConversationAnonSchema,
    CreateConversationAuthSchema,
    CreateMessageSchema,
    UpdateConversationStatusSchema
} from '../../../src/entities/conversation/conversation.crud.schema.js';
import { ConversationStatusEnum } from '../../../src/enums/conversation-status.enum.js';

// RFC 4122 v4 UUIDs (required by Zod v4 strict UUID validation)
const UUID_ACC = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

// ============================================================================
// CreateConversationAnonSchema
// ============================================================================

describe('CreateConversationAnonSchema', () => {
    const validAnon = {
        accommodationId: UUID_ACC,
        guestName: 'Alice Smith',
        guestEmail: 'alice@example.com',
        message: 'Hi, I would like to know more about your place.'
    };

    describe('when given valid input', () => {
        it('should parse a minimal valid anonymous initiation body', () => {
            const result = CreateConversationAnonSchema.safeParse(validAnon);
            expect(result.success).toBe(true);
        });

        it('should parse with optional guestPhone and locale', () => {
            const result = CreateConversationAnonSchema.safeParse({
                ...validAnon,
                guestPhone: '+549123456789',
                locale: 'en'
            });
            expect(result.success).toBe(true);
        });

        it('should accept a message of exactly 5000 characters', () => {
            const result = CreateConversationAnonSchema.safeParse({
                ...validAnon,
                message: 'x'.repeat(5000)
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject an invalid email', () => {
            const result = CreateConversationAnonSchema.safeParse({
                ...validAnon,
                guestEmail: 'not-an-email'
            });
            expect(result.success).toBe(false);
        });

        it('should reject an empty message', () => {
            const result = CreateConversationAnonSchema.safeParse({ ...validAnon, message: '' });
            expect(result.success).toBe(false);
        });

        it('should reject a message over 5000 characters', () => {
            const result = CreateConversationAnonSchema.safeParse({
                ...validAnon,
                message: 'x'.repeat(5001)
            });
            expect(result.success).toBe(false);
        });

        it('should reject an empty guestName', () => {
            const result = CreateConversationAnonSchema.safeParse({ ...validAnon, guestName: '' });
            expect(result.success).toBe(false);
        });

        it('should reject extra fields (.strict())', () => {
            const result = CreateConversationAnonSchema.safeParse({
                ...validAnon,
                unexpectedField: 'value'
            });
            expect(result.success).toBe(false);
        });

        it('should reject a non-UUID accommodationId', () => {
            const result = CreateConversationAnonSchema.safeParse({
                ...validAnon,
                accommodationId: 'not-a-uuid'
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// CreateConversationAuthSchema
// ============================================================================

describe('CreateConversationAuthSchema', () => {
    const validAuth = {
        accommodationId: UUID_ACC,
        message: 'Hello, can I book for next week?'
    };

    describe('when given valid input', () => {
        it('should parse a minimal valid authenticated initiation body', () => {
            const result = CreateConversationAuthSchema.safeParse(validAuth);
            expect(result.success).toBe(true);
        });

        it('should parse with optional locale', () => {
            const result = CreateConversationAuthSchema.safeParse({ ...validAuth, locale: 'pt' });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject an empty message', () => {
            const result = CreateConversationAuthSchema.safeParse({ ...validAuth, message: '' });
            expect(result.success).toBe(false);
        });

        it('should reject a message over 5000 characters', () => {
            const result = CreateConversationAuthSchema.safeParse({
                ...validAuth,
                message: 'y'.repeat(5001)
            });
            expect(result.success).toBe(false);
        });

        it('should reject extra fields (.strict())', () => {
            const result = CreateConversationAuthSchema.safeParse({
                ...validAuth,
                guestEmail: 'should-not-be-here@example.com'
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// UpdateConversationStatusSchema
// ============================================================================

describe('UpdateConversationStatusSchema', () => {
    describe('when given valid input', () => {
        it('should parse a CLOSED status without blockReason', () => {
            const result = UpdateConversationStatusSchema.safeParse({
                status: ConversationStatusEnum.CLOSED
            });
            expect(result.success).toBe(true);
        });

        it('should parse BLOCKED status with a blockReason', () => {
            const result = UpdateConversationStatusSchema.safeParse({
                status: ConversationStatusEnum.BLOCKED,
                blockReason: 'Repeated spam messages'
            });
            expect(result.success).toBe(true);
        });

        it('should parse OPEN status without blockReason', () => {
            const result = UpdateConversationStatusSchema.safeParse({
                status: ConversationStatusEnum.OPEN
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject BLOCKED status without blockReason (refine rule)', () => {
            const result = UpdateConversationStatusSchema.safeParse({
                status: ConversationStatusEnum.BLOCKED
            });
            expect(result.success).toBe(false);
        });

        it('should reject an invalid status value', () => {
            const result = UpdateConversationStatusSchema.safeParse({ status: 'PENDING' });
            expect(result.success).toBe(false);
        });

        it('should reject extra fields (.strict())', () => {
            const result = UpdateConversationStatusSchema.safeParse({
                status: ConversationStatusEnum.CLOSED,
                unknownField: 'oops'
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// ArchiveConversationSchema
// ============================================================================

describe('ArchiveConversationSchema', () => {
    describe('when given valid input', () => {
        it('should parse { archived: true }', () => {
            const result = ArchiveConversationSchema.safeParse({ archived: true });
            expect(result.success).toBe(true);
        });

        it('should parse { archived: false }', () => {
            const result = ArchiveConversationSchema.safeParse({ archived: false });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject a non-boolean archived value', () => {
            const result = ArchiveConversationSchema.safeParse({ archived: 'yes' });
            expect(result.success).toBe(false);
        });

        it('should reject extra fields (.strict())', () => {
            const result = ArchiveConversationSchema.safeParse({ archived: true, extra: 1 });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// CreateMessageSchema
// ============================================================================

describe('CreateMessageSchema', () => {
    describe('when given valid input', () => {
        it('should parse a minimal message body', () => {
            const result = CreateMessageSchema.safeParse({ body: 'Hello!' });
            expect(result.success).toBe(true);
        });

        it('should accept a body of exactly 5000 characters', () => {
            const result = CreateMessageSchema.safeParse({ body: 'z'.repeat(5000) });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject an empty body', () => {
            const result = CreateMessageSchema.safeParse({ body: '' });
            expect(result.success).toBe(false);
        });

        it('should reject a body over 5000 characters', () => {
            const result = CreateMessageSchema.safeParse({ body: 'z'.repeat(5001) });
            expect(result.success).toBe(false);
        });

        it('should reject extra fields (.strict())', () => {
            const result = CreateMessageSchema.safeParse({ body: 'Hi', extra: true });
            expect(result.success).toBe(false);
        });
    });
});
