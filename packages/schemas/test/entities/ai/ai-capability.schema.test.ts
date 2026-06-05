/**
 * Unit tests for AI capability Zod schemas (SPEC-173).
 *
 * Coverage:
 *   - AiUsageStatsSchema: valid triples; non-negative enforcement; wrong types.
 *   - AiCapabilityRequestBaseSchema: valid base; missing required fields; extra keys rejected.
 *   - AiMessageSchema: role enum; content non-empty; invalid role; unknown keys.
 *   - GenerateTextRequestSchema: prompt-only valid; messages-only valid; both → rejected;
 *       neither → rejected; empty prompt rejected; invalid message role rejected;
 *       empty message content rejected; unknown keys rejected.
 *   - GenerateTextResponseSchema: valid response; all fields required.
 *   - StreamTextRequestSchema: same prompt-or-messages contract as generateText.
 *   - StreamTextChunkSchema: valid delta (including empty string).
 *   - StreamTextFinalMetaSchema: valid final frame; usage required.
 *   - GenerateObjectRequestSchema: valid request; envelope only (no target schema field).
 *   - GenerateObjectResponseMetaSchema: valid meta; usage + provider + model + finishReason.
 *   - ModerateRequestSchema: valid input; locale optional; unknown keys rejected.
 *   - ModerateResponseSchema: flagged bool; categories record; scores optional.
 *
 * @module test/entities/ai/ai-capability.schema.test
 */

import { describe, expect, it } from 'vitest';
import {
    AiCapabilityRequestBaseSchema,
    AiMessageSchema,
    AiUsageStatsSchema,
    GenerateObjectRequestSchema,
    GenerateObjectResponseMetaSchema,
    GenerateTextRequestSchema,
    GenerateTextResponseSchema,
    ModerateRequestSchema,
    ModerateResponseSchema,
    StreamTextChunkSchema,
    StreamTextFinalMetaSchema,
    StreamTextRequestSchema
} from '../../../src/entities/ai/ai-capability.schema';
import { ExtractIntentRequestSchema } from '../../../src/entities/ai/ai-intent.schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validUsage = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };
const validBase = { feature: 'text_improve' as const, locale: 'es' as const };

// ---------------------------------------------------------------------------
// AiUsageStatsSchema
// ---------------------------------------------------------------------------

describe('AiUsageStatsSchema', () => {
    it('accepts a valid token-count triple', () => {
        // Arrange
        const input = { promptTokens: 50, completionTokens: 150, totalTokens: 200 };
        // Act
        const result = AiUsageStatsSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.totalTokens).toBe(200);
        }
    });

    it('accepts zero for all counts (valid — some adapters report 0)', () => {
        const result = AiUsageStatsSchema.safeParse({
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
        });
        expect(result.success).toBe(true);
    });

    it('rejects negative promptTokens', () => {
        const result = AiUsageStatsSchema.safeParse({
            promptTokens: -1,
            completionTokens: 0,
            totalTokens: 0
        });
        expect(result.success).toBe(false);
    });

    it('rejects negative completionTokens', () => {
        const result = AiUsageStatsSchema.safeParse({
            promptTokens: 0,
            completionTokens: -5,
            totalTokens: 0
        });
        expect(result.success).toBe(false);
    });

    it('rejects a non-integer totalTokens', () => {
        const result = AiUsageStatsSchema.safeParse({
            promptTokens: 1,
            completionTokens: 1,
            totalTokens: 1.5
        });
        expect(result.success).toBe(false);
    });

    it('rejects a missing required field', () => {
        const result = AiUsageStatsSchema.safeParse({
            promptTokens: 1,
            completionTokens: 1
            // totalTokens missing
        });
        expect(result.success).toBe(false);
    });

    it('rejects a string value', () => {
        const result = AiUsageStatsSchema.safeParse({
            promptTokens: 'ten',
            completionTokens: 0,
            totalTokens: 0
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// AiCapabilityRequestBaseSchema
// ---------------------------------------------------------------------------

describe('AiCapabilityRequestBaseSchema', () => {
    it('accepts a minimal valid base (feature + locale only)', () => {
        // Arrange
        const input = { feature: 'chat', locale: 'en' };
        // Act
        const result = AiCapabilityRequestBaseSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts all fields including optional model and params', () => {
        const result = AiCapabilityRequestBaseSchema.safeParse({
            feature: 'search',
            locale: 'pt',
            model: 'gpt-4o-mini',
            params: { temperature: 0.5, maxTokens: 512 }
        });
        expect(result.success).toBe(true);
    });

    it('accepts each valid locale: es, en, pt', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            const result = AiCapabilityRequestBaseSchema.safeParse({ feature: 'support', locale });
            expect(result.success, `locale '${locale}' should be valid`).toBe(true);
        }
    });

    it('rejects an unknown locale', () => {
        const result = AiCapabilityRequestBaseSchema.safeParse({
            feature: 'chat',
            locale: 'fr'
        });
        expect(result.success).toBe(false);
    });

    it('rejects missing feature', () => {
        const result = AiCapabilityRequestBaseSchema.safeParse({ locale: 'es' });
        expect(result.success).toBe(false);
    });

    it('rejects an unknown feature value', () => {
        const result = AiCapabilityRequestBaseSchema.safeParse({
            feature: 'summarize',
            locale: 'es'
        });
        expect(result.success).toBe(false);
    });

    it('rejects an empty model string', () => {
        const result = AiCapabilityRequestBaseSchema.safeParse({
            ...validBase,
            model: ''
        });
        expect(result.success).toBe(false);
    });

    it('rejects unknown extra keys (strict schema)', () => {
        const result = AiCapabilityRequestBaseSchema.safeParse({
            ...validBase,
            unknownField: 'surprise'
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// AiMessageSchema
// ---------------------------------------------------------------------------

describe('AiMessageSchema', () => {
    it('accepts a valid user message', () => {
        // Arrange
        const input = { role: 'user', content: 'Hello, can you help me?' };
        // Act
        const result = AiMessageSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.role).toBe('user');
        }
    });

    it('accepts each valid role: system, user, assistant', () => {
        for (const role of ['system', 'user', 'assistant'] as const) {
            const result = AiMessageSchema.safeParse({ role, content: 'Message content.' });
            expect(result.success, `role '${role}' should be valid`).toBe(true);
        }
    });

    it('rejects an invalid role', () => {
        const result = AiMessageSchema.safeParse({ role: 'tool', content: 'Tool result.' });
        expect(result.success).toBe(false);
    });

    it('rejects an empty content string', () => {
        const result = AiMessageSchema.safeParse({ role: 'user', content: '' });
        expect(result.success).toBe(false);
    });

    it('rejects a missing role field', () => {
        const result = AiMessageSchema.safeParse({ content: 'Hello.' });
        expect(result.success).toBe(false);
    });

    it('rejects a missing content field', () => {
        const result = AiMessageSchema.safeParse({ role: 'user' });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// GenerateTextRequestSchema
// ---------------------------------------------------------------------------

describe('GenerateTextRequestSchema', () => {
    it('accepts a valid prompt-only request', () => {
        // Arrange
        const input = { feature: 'text_improve', locale: 'es', prompt: 'Improve this text.' };
        // Act
        const result = GenerateTextRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts a valid messages-only request (multi-turn)', () => {
        // Arrange
        const input = {
            feature: 'chat',
            locale: 'es',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'What accommodations are available?' }
            ]
        };
        // Act
        const result = GenerateTextRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts optional model and params alongside prompt', () => {
        const result = GenerateTextRequestSchema.safeParse({
            feature: 'chat',
            locale: 'en',
            prompt: 'Hello!',
            model: 'claude-3-5-haiku',
            params: { temperature: 0.8 }
        });
        expect(result.success).toBe(true);
    });

    it('accepts optional model and params alongside messages', () => {
        const result = GenerateTextRequestSchema.safeParse({
            feature: 'chat',
            locale: 'en',
            messages: [{ role: 'user', content: 'Hello!' }],
            model: 'gpt-4o-mini',
            params: { maxTokens: 256 }
        });
        expect(result.success).toBe(true);
    });

    it('rejects when BOTH prompt and messages are provided', () => {
        // Arrange
        const input = {
            feature: 'chat',
            locale: 'es',
            prompt: 'Single turn.',
            messages: [{ role: 'user', content: 'Multi turn.' }]
        };
        // Act
        const result = GenerateTextRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            const message = result.error.issues[0]?.message ?? '';
            expect(message).toContain('both were given');
        }
    });

    it('rejects when NEITHER prompt nor messages is provided', () => {
        // Arrange: only base fields, no prompt or messages
        const input = { feature: 'text_improve', locale: 'es' };
        // Act
        const result = GenerateTextRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            const message = result.error.issues[0]?.message ?? '';
            expect(message).toContain('neither was');
        }
    });

    it('rejects an empty prompt string', () => {
        const result = GenerateTextRequestSchema.safeParse({ ...validBase, prompt: '' });
        expect(result.success).toBe(false);
    });

    it('rejects an empty messages array', () => {
        const result = GenerateTextRequestSchema.safeParse({ ...validBase, messages: [] });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid role inside a message', () => {
        const result = GenerateTextRequestSchema.safeParse({
            ...validBase,
            messages: [{ role: 'tool', content: 'Call result.' }]
        });
        expect(result.success).toBe(false);
    });

    it('rejects empty content inside a message', () => {
        const result = GenerateTextRequestSchema.safeParse({
            ...validBase,
            messages: [{ role: 'user', content: '' }]
        });
        expect(result.success).toBe(false);
    });

    it('rejects unknown extra keys (strict)', () => {
        const result = GenerateTextRequestSchema.safeParse({
            ...validBase,
            prompt: 'Valid',
            extraField: true
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// GenerateTextResponseSchema
// ---------------------------------------------------------------------------

describe('GenerateTextResponseSchema', () => {
    const validResponse = {
        text: 'Generated output.',
        usage: validUsage,
        provider: 'openai' as const,
        model: 'gpt-4o-mini',
        finishReason: 'stop'
    };

    it('accepts a valid response', () => {
        const result = GenerateTextResponseSchema.safeParse(validResponse);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.text).toBe('Generated output.');
            expect(result.data.finishReason).toBe('stop');
        }
    });

    it('accepts a non-standard finishReason string (open set)', () => {
        const result = GenerateTextResponseSchema.safeParse({
            ...validResponse,
            finishReason: 'content-filter'
        });
        expect(result.success).toBe(true);
    });

    it('rejects an empty finishReason', () => {
        const result = GenerateTextResponseSchema.safeParse({
            ...validResponse,
            finishReason: ''
        });
        expect(result.success).toBe(false);
    });

    it('rejects a missing usage block', () => {
        const { usage: _, ...withoutUsage } = validResponse;
        const result = GenerateTextResponseSchema.safeParse(withoutUsage);
        expect(result.success).toBe(false);
    });

    it('rejects an unknown provider', () => {
        const result = GenerateTextResponseSchema.safeParse({
            ...validResponse,
            provider: 'gemini'
        });
        expect(result.success).toBe(false);
    });

    it('accepts the stub provider (test provider must always be valid)', () => {
        const result = GenerateTextResponseSchema.safeParse({
            ...validResponse,
            provider: 'stub'
        });
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// StreamTextRequestSchema
// ---------------------------------------------------------------------------

describe('StreamTextRequestSchema', () => {
    it('accepts a valid prompt-only stream request', () => {
        const result = StreamTextRequestSchema.safeParse({
            feature: 'chat',
            locale: 'es',
            prompt: 'Tell me a story.'
        });
        expect(result.success).toBe(true);
    });

    it('accepts a valid messages-only stream request (multi-turn)', () => {
        const result = StreamTextRequestSchema.safeParse({
            feature: 'chat',
            locale: 'en',
            messages: [
                { role: 'system', content: 'You are a creative storyteller.' },
                { role: 'user', content: 'Tell me a story about the river.' }
            ]
        });
        expect(result.success).toBe(true);
    });

    it('rejects when BOTH prompt and messages are provided', () => {
        const result = StreamTextRequestSchema.safeParse({
            feature: 'chat',
            locale: 'es',
            prompt: 'A story.',
            messages: [{ role: 'user', content: 'Also a story.' }]
        });
        expect(result.success).toBe(false);
    });

    it('rejects when NEITHER prompt nor messages is provided', () => {
        const result = StreamTextRequestSchema.safeParse({ feature: 'chat', locale: 'es' });
        expect(result.success).toBe(false);
    });

    it('rejects an empty prompt string', () => {
        const result = StreamTextRequestSchema.safeParse({ ...validBase, prompt: '' });
        expect(result.success).toBe(false);
    });

    it('rejects unknown extra keys (strict)', () => {
        const result = StreamTextRequestSchema.safeParse({
            ...validBase,
            prompt: 'Valid',
            stream: true // unknown key
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// StreamTextChunkSchema
// ---------------------------------------------------------------------------

describe('StreamTextChunkSchema', () => {
    it('accepts a non-empty delta chunk', () => {
        const result = StreamTextChunkSchema.safeParse({ delta: 'Hello' });
        expect(result.success).toBe(true);
    });

    it('accepts an empty delta string (valid — heartbeat frames may have empty delta)', () => {
        // The spec says callers concatenate non-empty deltas; empty is valid structurally.
        const result = StreamTextChunkSchema.safeParse({ delta: '' });
        expect(result.success).toBe(true);
    });

    it('rejects a missing delta field', () => {
        const result = StreamTextChunkSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('rejects a non-string delta', () => {
        const result = StreamTextChunkSchema.safeParse({ delta: 42 as unknown });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// StreamTextFinalMetaSchema
// ---------------------------------------------------------------------------

describe('StreamTextFinalMetaSchema', () => {
    const validFinalMeta = {
        usage: validUsage,
        provider: 'anthropic' as const,
        model: 'claude-3-5-haiku-20241022',
        finishReason: 'stop'
    };

    it('accepts a valid final metadata frame', () => {
        const result = StreamTextFinalMetaSchema.safeParse(validFinalMeta);
        expect(result.success).toBe(true);
    });

    it('rejects missing usage', () => {
        const { usage: _, ...withoutUsage } = validFinalMeta;
        const result = StreamTextFinalMetaSchema.safeParse(withoutUsage);
        expect(result.success).toBe(false);
    });

    it('rejects an invalid provider', () => {
        const result = StreamTextFinalMetaSchema.safeParse({
            ...validFinalMeta,
            provider: 'cohere'
        });
        expect(result.success).toBe(false);
    });

    it('rejects an empty model string', () => {
        const result = StreamTextFinalMetaSchema.safeParse({
            ...validFinalMeta,
            model: ''
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// GenerateObjectRequestSchema
// ---------------------------------------------------------------------------

describe('GenerateObjectRequestSchema', () => {
    it('accepts a valid generateObject request', () => {
        // Arrange
        const input = {
            feature: 'text_improve',
            locale: 'pt',
            prompt: 'Extract structured accommodation info from this text.'
        };
        // Act
        const result = GenerateObjectRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
    });

    it('does NOT include a schema field (target schema is a type param at engine layer)', () => {
        // The generateObject request has no `schema` field — the caller passes
        // the Zod schema at call-time, not through this request shape.
        const validRequest = {
            feature: 'text_improve',
            locale: 'es',
            prompt: 'Extract info.'
        };
        const result = GenerateObjectRequestSchema.safeParse(validRequest);
        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as Record<string, unknown>).schema).toBeUndefined();
        }
    });

    it('rejects unknown extra keys (strict)', () => {
        const result = GenerateObjectRequestSchema.safeParse({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'Valid',
            targetSchema: { type: 'object' } // unknown
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// GenerateObjectResponseMetaSchema
// ---------------------------------------------------------------------------

describe('GenerateObjectResponseMetaSchema', () => {
    const validMeta = {
        usage: validUsage,
        provider: 'openai' as const,
        model: 'gpt-4o',
        finishReason: 'stop'
    };

    it('accepts valid response metadata', () => {
        const result = GenerateObjectResponseMetaSchema.safeParse(validMeta);
        expect(result.success).toBe(true);
    });

    it('rejects missing finishReason', () => {
        const { finishReason: _, ...without } = validMeta;
        const result = GenerateObjectResponseMetaSchema.safeParse(without);
        expect(result.success).toBe(false);
    });

    it('accepts metadata WITH an extra object field (not strict — callers may merge)', () => {
        // The response meta schema is intentionally not strict so callers can
        // merge it with their typed object schema.
        const result = GenerateObjectResponseMetaSchema.safeParse({
            ...validMeta,
            object: { name: 'Casa del Lago' }
        });
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// ModerateRequestSchema
// ---------------------------------------------------------------------------

describe('ModerateRequestSchema', () => {
    it('accepts a valid moderate request with only input', () => {
        // Arrange
        const input = { input: 'This text may contain harmful content.' };
        // Act
        const result = ModerateRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts input with optional locale', () => {
        const result = ModerateRequestSchema.safeParse({ input: 'Some text.', locale: 'es' });
        expect(result.success).toBe(true);
    });

    it('accepts each valid locale in moderate request', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            const result = ModerateRequestSchema.safeParse({ input: 'Test.', locale });
            expect(result.success, `locale '${locale}' should be valid in moderate`).toBe(true);
        }
    });

    it('rejects an empty input string', () => {
        const result = ModerateRequestSchema.safeParse({ input: '' });
        expect(result.success).toBe(false);
    });

    it('rejects a missing input field', () => {
        const result = ModerateRequestSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('rejects an invalid locale', () => {
        const result = ModerateRequestSchema.safeParse({ input: 'Text.', locale: 'de' });
        expect(result.success).toBe(false);
    });

    it('rejects unknown extra keys (strict)', () => {
        const result = ModerateRequestSchema.safeParse({
            input: 'Text.',
            provider: 'openai' // unknown in moderate request
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// ModerateResponseSchema
// ---------------------------------------------------------------------------

describe('ModerateResponseSchema', () => {
    it('accepts a valid flagged=true response with categories', () => {
        // Arrange
        const input = {
            flagged: true,
            categories: { hate: true, violence: false }
        };
        // Act
        const result = ModerateResponseSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.flagged).toBe(true);
        }
    });

    it('accepts flagged=false with empty categories', () => {
        const result = ModerateResponseSchema.safeParse({
            flagged: false,
            categories: {}
        });
        expect(result.success).toBe(true);
    });

    it('accepts optional scores when present', () => {
        const result = ModerateResponseSchema.safeParse({
            flagged: true,
            categories: { hate: true },
            scores: { hate: 0.97 }
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.scores?.hate).toBe(0.97);
        }
    });

    it('accepts absence of scores (optional)', () => {
        const result = ModerateResponseSchema.safeParse({
            flagged: false,
            categories: { hate: false }
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.scores).toBeUndefined();
        }
    });

    it('rejects a score outside [0, 1]', () => {
        const result = ModerateResponseSchema.safeParse({
            flagged: true,
            categories: { hate: true },
            scores: { hate: 1.5 }
        });
        expect(result.success).toBe(false);
    });

    it('rejects a negative score', () => {
        const result = ModerateResponseSchema.safeParse({
            flagged: false,
            categories: {},
            scores: { violence: -0.1 }
        });
        expect(result.success).toBe(false);
    });

    it('rejects a non-boolean flagged value', () => {
        const result = ModerateResponseSchema.safeParse({
            flagged: 'yes' as unknown,
            categories: {}
        });
        expect(result.success).toBe(false);
    });

    it('rejects missing categories field', () => {
        const result = ModerateResponseSchema.safeParse({ flagged: false });
        expect(result.success).toBe(false);
    });

    it('does not reject extra fields on the response (not strict — provider may add diagnostic fields)', () => {
        const result = ModerateResponseSchema.safeParse({
            flagged: false,
            categories: {},
            requestId: 'abc-123' // extra provider-level field
        });
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// ExtractIntentRequestSchema (imported from ai-capability, re-exported via ai-intent)
// ---------------------------------------------------------------------------

describe('ExtractIntentRequestSchema', () => {
    it('accepts a valid query', () => {
        const result = ExtractIntentRequestSchema.safeParse({
            query: 'Busco alojamiento para 2 personas en Colón'
        });
        expect(result.success).toBe(true);
    });

    it('accepts query with optional locale', () => {
        const result = ExtractIntentRequestSchema.safeParse({
            query: 'Find me a cabin',
            locale: 'en'
        });
        expect(result.success).toBe(true);
    });

    it('rejects an empty query', () => {
        const result = ExtractIntentRequestSchema.safeParse({ query: '' });
        expect(result.success).toBe(false);
    });

    it('rejects unknown extra keys (strict)', () => {
        const result = ExtractIntentRequestSchema.safeParse({ query: 'Valid', feature: 'search' });
        expect(result.success).toBe(false);
    });
});
