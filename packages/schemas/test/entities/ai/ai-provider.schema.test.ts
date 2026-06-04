/**
 * Unit tests for AI provider Zod schemas (SPEC-173).
 *
 * Coverage:
 *   - AiProviderIdSchema: accepts each valid provider, rejects unknowns.
 *   - AiFeatureSchema: accepts each valid feature, rejects unknowns.
 *   - AiModelParamsSchema: valid combinations; out-of-range / wrong-type rejections.
 *
 * @module test/entities/ai/ai-provider.schema.test
 */

import { describe, expect, it } from 'vitest';
import {
    AiFeatureSchema,
    AiModelParamsSchema,
    AiProviderIdSchema
} from '../../../src/entities/ai/ai-provider.schema';

// ---------------------------------------------------------------------------
// AiProviderIdSchema
// ---------------------------------------------------------------------------

describe('AiProviderIdSchema', () => {
    it('accepts each valid provider identifier', () => {
        for (const id of ['openai', 'anthropic', 'stub'] as const) {
            // Arrange + Act
            const result = AiProviderIdSchema.safeParse(id);
            // Assert
            expect(result.success, `expected '${id}' to be valid`).toBe(true);
        }
    });

    it('rejects an unknown provider', () => {
        // Arrange
        const unknown = 'gemini';
        // Act
        const result = AiProviderIdSchema.safeParse(unknown);
        // Assert
        expect(result.success).toBe(false);
    });

    it('rejects an empty string', () => {
        const result = AiProviderIdSchema.safeParse('');
        expect(result.success).toBe(false);
    });

    it('rejects a non-string value', () => {
        const result = AiProviderIdSchema.safeParse(42 as unknown);
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// AiFeatureSchema
// ---------------------------------------------------------------------------

describe('AiFeatureSchema', () => {
    it('accepts each valid feature identifier', () => {
        for (const feature of ['text_improve', 'chat', 'search', 'support'] as const) {
            const result = AiFeatureSchema.safeParse(feature);
            expect(result.success, `expected '${feature}' to be valid`).toBe(true);
        }
    });

    it('rejects an unknown feature', () => {
        const result = AiFeatureSchema.safeParse('summarize');
        expect(result.success).toBe(false);
    });

    it('rejects the billing-prefixed form (ai_text_improve)', () => {
        // The schema uses the unprefixed form — billing uses ai_* prefix.
        const result = AiFeatureSchema.safeParse('ai_text_improve');
        expect(result.success).toBe(false);
    });

    it('rejects a non-string value', () => {
        const result = AiFeatureSchema.safeParse(null as unknown);
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// AiModelParamsSchema
// ---------------------------------------------------------------------------

describe('AiModelParamsSchema', () => {
    it('accepts an empty object (all params optional)', () => {
        const result = AiModelParamsSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('accepts valid temperature + maxTokens + topP', () => {
        const result = AiModelParamsSchema.safeParse({
            temperature: 0.7,
            maxTokens: 2048,
            topP: 0.9
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.temperature).toBe(0.7);
            expect(result.data.maxTokens).toBe(2048);
            expect(result.data.topP).toBe(0.9);
        }
    });

    it('accepts temperature at the boundary values 0 and 2', () => {
        expect(AiModelParamsSchema.safeParse({ temperature: 0 }).success).toBe(true);
        expect(AiModelParamsSchema.safeParse({ temperature: 2 }).success).toBe(true);
    });

    it('rejects temperature below 0', () => {
        const result = AiModelParamsSchema.safeParse({ temperature: -0.1 });
        expect(result.success).toBe(false);
    });

    it('rejects temperature above 2', () => {
        const result = AiModelParamsSchema.safeParse({ temperature: 2.1 });
        expect(result.success).toBe(false);
    });

    it('rejects maxTokens of 0 (must be at least 1)', () => {
        const result = AiModelParamsSchema.safeParse({ maxTokens: 0 });
        expect(result.success).toBe(false);
    });

    it('rejects negative maxTokens', () => {
        const result = AiModelParamsSchema.safeParse({ maxTokens: -1 });
        expect(result.success).toBe(false);
    });

    it('rejects non-integer maxTokens', () => {
        const result = AiModelParamsSchema.safeParse({ maxTokens: 1.5 });
        expect(result.success).toBe(false);
    });

    it('accepts topP at the boundary values 0 and 1', () => {
        expect(AiModelParamsSchema.safeParse({ topP: 0 }).success).toBe(true);
        expect(AiModelParamsSchema.safeParse({ topP: 1 }).success).toBe(true);
    });

    it('rejects topP above 1', () => {
        const result = AiModelParamsSchema.safeParse({ topP: 1.01 });
        expect(result.success).toBe(false);
    });

    it('rejects topP below 0', () => {
        const result = AiModelParamsSchema.safeParse({ topP: -0.01 });
        expect(result.success).toBe(false);
    });
});
