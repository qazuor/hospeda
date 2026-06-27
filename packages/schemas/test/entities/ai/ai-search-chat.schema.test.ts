import { describe, expect, it } from 'vitest';
import { AiChatMessageSchema } from '../../../src/entities/ai/ai-chat.schema';
import {
    AiSearchChatDoneEventSchema,
    AiSearchChatErrorEventSchema,
    AiSearchChatFiltersEventSchema,
    AiSearchChatRequestSchema,
    AiSearchChatSseEventSchema,
    AiSearchChatTokenEventSchema
} from '../../../src/entities/ai/ai-search-chat.schema';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const USER_MESSAGE = { role: 'user' as const, content: 'cabaña para 4 con pileta' };
const ASSISTANT_MESSAGE = { role: 'assistant' as const, content: 'Encontré algunas opciones' };

describe('AiSearchChatRequestSchema', () => {
    it('accepts a minimal first-turn request and defaults locale to "es"', () => {
        // Act
        const result = AiSearchChatRequestSchema.safeParse({ messages: [USER_MESSAGE] });
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.locale).toBe('es');
            expect(result.data.currentFilters).toBeUndefined();
            expect(result.data.conversationId).toBeUndefined();
        }
    });

    it('accepts a refinement turn with currentFilters, conversationId and locale', () => {
        const result = AiSearchChatRequestSchema.safeParse({
            messages: [USER_MESSAGE, ASSISTANT_MESSAGE, { role: 'user', content: 'más barata' }],
            currentFilters: { accommodationType: 'CABIN', minGuests: 4, hasPool: true },
            conversationId: VALID_UUID,
            locale: 'en'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.conversationId).toBe(VALID_UUID);
            expect(result.data.locale).toBe('en');
            expect(result.data.currentFilters?.minGuests).toBe(4);
        }
    });

    it('accepts a null conversationId', () => {
        const result = AiSearchChatRequestSchema.safeParse({
            messages: [USER_MESSAGE],
            conversationId: null
        });
        expect(result.success).toBe(true);
    });

    it('rejects an empty messages array', () => {
        const result = AiSearchChatRequestSchema.safeParse({ messages: [] });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('messages'))).toBe(true);
        }
    });

    it('rejects more than AI_CHAT_MAX_MESSAGES (20) messages', () => {
        const messages = Array.from({ length: 21 }, () => USER_MESSAGE);
        const result = AiSearchChatRequestSchema.safeParse({ messages });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('messages'))).toBe(true);
        }
    });

    it('rejects an unknown top-level key (strict)', () => {
        const result = AiSearchChatRequestSchema.safeParse({
            messages: [USER_MESSAGE],
            accommodationId: VALID_UUID
        });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid (non-uuid) conversationId', () => {
        const result = AiSearchChatRequestSchema.safeParse({
            messages: [USER_MESSAGE],
            conversationId: 'not-a-uuid'
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('conversationId'))).toBe(true);
        }
    });

    it('rejects an invalid message role', () => {
        const result = AiSearchChatRequestSchema.safeParse({
            messages: [{ role: 'system', content: 'hi' }]
        });
        expect(result.success).toBe(false);
    });
});

describe('AiSearchChatFiltersEventSchema', () => {
    it('accepts URL-ready params plus the extracted intent', () => {
        // `params` is the URL-ready query form (booleans as 'true'/'false'); `intent`
        // is the raw filter slot bag (booleans as real booleans).
        const result = AiSearchChatFiltersEventSchema.safeParse({
            params: { minGuests: 4, hasPool: 'true' },
            intent: { accommodationType: 'CABIN', minGuests: 4, hasPool: true }
        });
        expect(result.success).toBe(true);
    });

    it('accepts confidence field (SPEC-265 A1)', () => {
        const result = AiSearchChatFiltersEventSchema.safeParse({
            params: { minGuests: 4 },
            intent: { minGuests: 4 },
            confidence: 0.85
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.confidence).toBe(0.85);
        }
    });

    it('accepts payload without confidence (backward-compatible, SPEC-265 A1)', () => {
        const result = AiSearchChatFiltersEventSchema.safeParse({
            params: { minGuests: 4 },
            intent: { minGuests: 4 }
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.confidence).toBeUndefined();
        }
    });

    it('rejects confidence outside [0, 1]', () => {
        const resultHigh = AiSearchChatFiltersEventSchema.safeParse({
            params: {},
            intent: {},
            confidence: 1.5
        });
        expect(resultHigh.success).toBe(false);

        const resultLow = AiSearchChatFiltersEventSchema.safeParse({
            params: {},
            intent: {},
            confidence: -0.1
        });
        expect(resultLow.success).toBe(false);
    });

    it('rejects a payload missing intent', () => {
        const result = AiSearchChatFiltersEventSchema.safeParse({ params: {} });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('intent'))).toBe(true);
        }
    });
});

describe('AiSearchChatTokenEventSchema', () => {
    it('accepts a delta chunk', () => {
        expect(AiSearchChatTokenEventSchema.safeParse({ delta: 'Encontré' }).success).toBe(true);
    });

    it('accepts an empty delta', () => {
        expect(AiSearchChatTokenEventSchema.safeParse({ delta: '' }).success).toBe(true);
    });

    it('rejects a non-string delta', () => {
        expect(AiSearchChatTokenEventSchema.safeParse({ delta: 42 }).success).toBe(false);
    });
});

describe('AiSearchChatDoneEventSchema', () => {
    it('accepts a uuid conversationId', () => {
        expect(AiSearchChatDoneEventSchema.safeParse({ conversationId: VALID_UUID }).success).toBe(
            true
        );
    });

    it('accepts a null conversationId (best-effort persistence)', () => {
        expect(AiSearchChatDoneEventSchema.safeParse({ conversationId: null }).success).toBe(true);
    });

    it('rejects a non-uuid conversationId', () => {
        expect(AiSearchChatDoneEventSchema.safeParse({ conversationId: 'x' }).success).toBe(false);
    });
});

describe('AiSearchChatErrorEventSchema', () => {
    it('accepts a code and message', () => {
        const result = AiSearchChatErrorEventSchema.safeParse({
            code: 'PROVIDER_ERROR',
            message: 'upstream failed'
        });
        expect(result.success).toBe(true);
    });

    it('rejects an empty code', () => {
        const result = AiSearchChatErrorEventSchema.safeParse({ code: '', message: 'x' });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('code'))).toBe(true);
        }
    });
});

describe('AiChatMessageSchema (SPEC-265 C2 — content cap)', () => {
    it('accepts content within the 500-char cap', () => {
        const result = AiChatMessageSchema.safeParse({
            role: 'user',
            content: 'a'.repeat(500)
        });
        expect(result.success).toBe(true);
    });

    it('rejects content exceeding 500 chars', () => {
        const result = AiChatMessageSchema.safeParse({
            role: 'user',
            content: 'a'.repeat(501)
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('content'))).toBe(true);
        }
    });

    it('rejects empty content', () => {
        const result = AiChatMessageSchema.safeParse({
            role: 'user',
            content: ''
        });
        expect(result.success).toBe(false);
    });
});

describe('AiSearchChatSseEventSchema (discriminated union)', () => {
    it.each([
        { type: 'filters', params: {}, intent: {} },
        { type: 'token', delta: 'hi' },
        { type: 'done', conversationId: null },
        { type: 'error', code: 'E', message: 'm' }
    ])('parses the "$type" event variant', (event) => {
        expect(AiSearchChatSseEventSchema.safeParse(event).success).toBe(true);
    });

    it('rejects an unknown event type', () => {
        expect(AiSearchChatSseEventSchema.safeParse({ type: 'heartbeat' }).success).toBe(false);
    });
});
