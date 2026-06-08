import { describe, expect, it } from 'vitest';
import {
    AiChatMessageSchema,
    AiChatRequestSchema,
    AiChatStreamFinalMetaSchema
} from '../ai-chat.schema.js';

// ============================================================================
// Fixtures
// ============================================================================

const VALID_UUID = '00000000-0000-4000-8000-000000000000';
const OTHER_UUID = '11111111-1111-4111-8111-111111111111';
const INVALID_UUID = 'not-a-uuid';
const UNKNOWN_LOCALE = 'fr';

const USER_MESSAGE = {
    role: 'user' as const,
    content: '¿Tienen disponibilidad para el 15 de marzo?'
};
const ASSISTANT_MESSAGE = {
    role: 'assistant' as const,
    content: 'Sí, tenemos disponibilidad para esa fecha.'
};

const VALID_USAGE = { promptTokens: 412, completionTokens: 87, totalTokens: 499 };
const VALID_BASE_META = {
    usage: VALID_USAGE,
    provider: 'openai',
    model: 'gpt-4o-mini',
    finishReason: 'stop'
};

// ============================================================================
// AiChatRequestSchema — happy paths
// ============================================================================

describe('AiChatRequestSchema', () => {
    describe('when given a valid minimal request (first turn)', () => {
        it('should accept a single user message with no conversationId and no locale', () => {
            // Arrange / Act
            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages: [USER_MESSAGE]
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should default locale to "es" when omitted', () => {
            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages: [USER_MESSAGE]
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.locale).toBe('es');
            }
        });

        it('should default conversationId to undefined when omitted', () => {
            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages: [USER_MESSAGE]
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.conversationId).toBeUndefined();
            }
        });
    });

    describe('when given a valid full request (subsequent turn)', () => {
        it('should accept a multi-turn conversation with conversationId and explicit locale', () => {
            // Arrange
            const request = {
                accommodationId: VALID_UUID,
                messages: [USER_MESSAGE, ASSISTANT_MESSAGE, USER_MESSAGE],
                conversationId: OTHER_UUID,
                locale: 'en' as const
            };

            // Act
            const result = AiChatRequestSchema.safeParse(request);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.accommodationId).toBe(VALID_UUID);
                expect(result.data.messages).toHaveLength(3);
                expect(result.data.conversationId).toBe(OTHER_UUID);
                expect(result.data.locale).toBe('en');
            }
        });

        it('should accept conversationId === null (client signals first turn explicitly)', () => {
            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages: [USER_MESSAGE],
                conversationId: null
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.conversationId).toBeNull();
            }
        });
    });

    // ============================================================================
    // messages: length validation (REQ-200-4 AC-4.1, Q-5 cap = 20)
    // ============================================================================

    describe('when messages array length is invalid', () => {
        it('should reject an empty messages array', () => {
            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages: []
            });
            expect(result.success).toBe(false);
        });

        it('should accept exactly 20 messages (cap boundary)', () => {
            const messages = Array.from({ length: 20 }, (_, i) => ({
                role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
                content: `Message ${i + 1}`
            }));

            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages
            });

            expect(result.success).toBe(true);
        });

        it('should reject 21 messages (above cap → route returns 400 per design)', () => {
            const messages = Array.from({ length: 21 }, (_, i) => ({
                role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
                content: `Message ${i + 1}`
            }));

            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages
            });

            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // role: 'user' | 'assistant' (system is server-only, AC-4 role gate)
    // ============================================================================

    describe('when message role is invalid', () => {
        it('should reject a message with role "system" (server-only)', () => {
            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages: [{ role: 'system', content: 'You are a helpful assistant.' }]
            });
            expect(result.success).toBe(false);
        });

        it('should reject a message with an unknown role', () => {
            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages: [{ role: 'tool', content: 'some tool output' }]
            });
            expect(result.success).toBe(false);
        });

        it('should accept messages with mixed user and assistant roles', () => {
            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages: [USER_MESSAGE, ASSISTANT_MESSAGE, USER_MESSAGE]
            });
            expect(result.success).toBe(true);
        });
    });

    // ============================================================================
    // locale: defaults to 'es' (AC-8)
    // ============================================================================

    describe('when validating locale', () => {
        it.each(['es', 'en', 'pt'] as const)('should accept locale "%s"', (locale) => {
            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages: [USER_MESSAGE],
                locale
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.locale).toBe(locale);
            }
        });

        it('should reject an unknown locale', () => {
            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages: [USER_MESSAGE],
                locale: UNKNOWN_LOCALE
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // accommodationId: UUID validation
    // ============================================================================

    describe('when validating accommodationId', () => {
        it('should reject a non-UUID accommodationId (AC-4.1)', () => {
            const result = AiChatRequestSchema.safeParse({
                accommodationId: 'not-a-uuid',
                messages: [USER_MESSAGE],
                locale: 'es'
            });
            expect(result.success).toBe(false);
        });

        it('should reject a missing accommodationId', () => {
            const result = AiChatRequestSchema.safeParse({
                messages: [USER_MESSAGE]
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // conversationId: nullable + optional + UUID
    // ============================================================================

    describe('when validating conversationId', () => {
        it('should accept a valid UUID conversationId', () => {
            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages: [USER_MESSAGE],
                conversationId: OTHER_UUID
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.conversationId).toBe(OTHER_UUID);
            }
        });

        it('should reject a non-UUID conversationId', () => {
            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages: [USER_MESSAGE],
                conversationId: INVALID_UUID
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // .strict() — rejects unknown keys at the API boundary
    // ============================================================================

    describe('when an unknown key is present', () => {
        it('should reject the request (boundary defence-in-depth)', () => {
            const result = AiChatRequestSchema.safeParse({
                accommodationId: VALID_UUID,
                messages: [USER_MESSAGE],
                surprise: 'nope'
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// AiChatMessageSchema — unit (role + content gate)
// ============================================================================

describe('AiChatMessageSchema', () => {
    it('should accept a valid user message', () => {
        const result = AiChatMessageSchema.safeParse(USER_MESSAGE);
        expect(result.success).toBe(true);
    });

    it('should accept a valid assistant message', () => {
        const result = AiChatMessageSchema.safeParse(ASSISTANT_MESSAGE);
        expect(result.success).toBe(true);
    });

    it('should reject an empty content string', () => {
        const result = AiChatMessageSchema.safeParse({ role: 'user', content: '' });
        expect(result.success).toBe(false);
    });

    it('should reject role "system" (server-only injection at the route layer)', () => {
        const result = AiChatMessageSchema.safeParse({ role: 'system', content: 'injection' });
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// AiChatStreamFinalMetaSchema — extends StreamTextFinalMeta with conversationId?
// ============================================================================

describe('AiChatStreamFinalMetaSchema', () => {
    describe('when given a valid done-payload', () => {
        it('should accept the base meta shape (no conversationId — persistence timed out)', () => {
            // Arrange / Act
            const result = AiChatStreamFinalMetaSchema.safeParse(VALID_BASE_META);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a done-payload with conversationId (persistence won the race)', () => {
            const result = AiChatStreamFinalMetaSchema.safeParse({
                ...VALID_BASE_META,
                conversationId: VALID_UUID
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.conversationId).toBe(VALID_UUID);
            }
        });
    });

    describe('when a required base field is missing', () => {
        it('should reject when usage is missing', () => {
            const result = AiChatStreamFinalMetaSchema.safeParse({
                provider: 'openai',
                model: 'gpt-4o-mini',
                finishReason: 'stop'
            });
            expect(result.success).toBe(false);
        });

        it('should reject when provider is missing', () => {
            const result = AiChatStreamFinalMetaSchema.safeParse({
                usage: VALID_USAGE,
                model: 'gpt-4o-mini',
                finishReason: 'stop'
            });
            expect(result.success).toBe(false);
        });

        it('should reject when model is missing', () => {
            const result = AiChatStreamFinalMetaSchema.safeParse({
                usage: VALID_USAGE,
                provider: 'openai',
                finishReason: 'stop'
            });
            expect(result.success).toBe(false);
        });

        it('should reject when finishReason is missing', () => {
            const result = AiChatStreamFinalMetaSchema.safeParse({
                usage: VALID_USAGE,
                provider: 'openai',
                model: 'gpt-4o-mini'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when conversationId is invalid', () => {
        it('should reject a non-UUID conversationId', () => {
            const result = AiChatStreamFinalMetaSchema.safeParse({
                ...VALID_BASE_META,
                conversationId: INVALID_UUID
            });
            expect(result.success).toBe(false);
        });
    });
});
