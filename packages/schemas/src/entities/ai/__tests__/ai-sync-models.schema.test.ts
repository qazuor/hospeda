import { describe, expect, it } from 'vitest';
import { AiProviderModelSchema, AiSyncModelsResultSchema } from '../ai-sync-models.schema.js';

describe('AiProviderModelSchema', () => {
    it('should validate a full model entry with all optional fields', () => {
        // Arrange
        const input = {
            id: 'gpt-4o',
            source: 'both',
            label: 'GPT-4o',
            capabilityHint: 'chat',
            deprecated: false
        };

        // Act
        const result = AiProviderModelSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toEqual(input);
        }
    });

    it('should validate a minimal model entry with only required fields', () => {
        // Arrange
        const input = { id: 'gpt-4o-mini', source: 'detected' };

        // Act
        const result = AiProviderModelSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.id).toBe('gpt-4o-mini');
            expect(result.data.source).toBe('detected');
            expect(result.data.label).toBeUndefined();
            expect(result.data.capabilityHint).toBeUndefined();
            expect(result.data.deprecated).toBeUndefined();
        }
    });

    it('should accept each valid source value', () => {
        for (const source of ['detected', 'curated', 'both'] as const) {
            const result = AiProviderModelSchema.safeParse({ id: 'claude-3-5-sonnet', source });
            expect(result.success).toBe(true);
        }
    });

    it('should reject an invalid source value', () => {
        // Arrange
        const input = { id: 'gpt-4o', source: 'invented' };

        // Act
        const result = AiProviderModelSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject an empty id', () => {
        // Arrange
        const input = { id: '', source: 'detected' };

        // Act
        const result = AiProviderModelSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject a missing id', () => {
        const result = AiProviderModelSchema.safeParse({ source: 'detected' });
        expect(result.success).toBe(false);
    });

    it('should reject a missing source', () => {
        const result = AiProviderModelSchema.safeParse({ id: 'gpt-4o' });
        expect(result.success).toBe(false);
    });
});

describe('AiSyncModelsResultSchema', () => {
    it('should validate a full sync result including warnings', () => {
        // Arrange
        const input = {
            providerId: 'openai',
            models: [
                { id: 'gpt-4o', source: 'both' },
                { id: 'gpt-4o-mini', source: 'detected' }
            ],
            fetchedAt: '2026-07-05T12:00:00.000Z',
            warnings: ['unexpected response shape for model "o1-preview-legacy"']
        };

        // Act
        const result = AiSyncModelsResultSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.models).toHaveLength(2);
            expect(result.data.warnings).toEqual(input.warnings);
        }
    });

    it('should validate a minimal sync result without warnings', () => {
        // Arrange
        const input = {
            providerId: 'anthropic',
            models: [],
            fetchedAt: '2026-07-05T12:00:00.000Z'
        };

        // Act
        const result = AiSyncModelsResultSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.warnings).toBeUndefined();
            expect(result.data.models).toEqual([]);
        }
    });

    it('should reject a non-ISO fetchedAt value', () => {
        // Arrange
        const input = {
            providerId: 'openai',
            models: [],
            fetchedAt: 'not-a-date'
        };

        // Act
        const result = AiSyncModelsResultSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject when a model item in the array is invalid', () => {
        // Arrange
        const input = {
            providerId: 'openai',
            models: [{ id: 'gpt-4o', source: 'not-a-real-source' }],
            fetchedAt: '2026-07-05T12:00:00.000Z'
        };

        // Act
        const result = AiSyncModelsResultSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject a missing providerId', () => {
        const result = AiSyncModelsResultSchema.safeParse({
            models: [],
            fetchedAt: '2026-07-05T12:00:00.000Z'
        });
        expect(result.success).toBe(false);
    });
});
