/**
 * Tests for mergeDetectedAndCuratedModels (HOS-94 §6.3, T-007).
 *
 * ## Coverage
 *
 * 1. Model id present in both detected and curated → `source: 'both'`.
 * 2. Detected-only model → `source: 'detected'`.
 * 3. Curated-only model (not returned by the provider) → `source: 'curated'`.
 * 4. Duplicate ids in the detected list are de-duplicated.
 * 5. Empty detected list → curated-only output, all `source: 'curated'`.
 * 6. Unknown providerId (no curated catalog entry) → all detected models,
 *    `source: 'detected'`.
 * 7. Deterministic ordering: curated order first, then extra detected-only.
 * 8. `uncertain: true` on a detected entry → `capabilityHint: 'uncertain'`
 *    carried into the merged output.
 * 9. Every produced entry parses against `AiProviderModelSchema`.
 *
 * @module test/services/ai-sync-models.merge
 */

import { AiProviderModelSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { mergeDetectedAndCuratedModels } from '../../src/services/ai-sync-models.merge';

describe('mergeDetectedAndCuratedModels', () => {
    it('should tag a model present in both detected and curated as "both"', () => {
        // Arrange
        const input = {
            providerId: 'openai',
            detected: [{ id: 'gpt-4o' }]
        };

        // Act
        const result = mergeDetectedAndCuratedModels(input);

        // Assert
        const entry = result.find((m) => m.id === 'gpt-4o');
        expect(entry).toEqual({ id: 'gpt-4o', source: 'both' });
    });

    it('should tag a detected-only model as "detected"', () => {
        // Arrange
        const input = {
            providerId: 'openai',
            detected: [{ id: 'gpt-5-preview' }]
        };

        // Act
        const result = mergeDetectedAndCuratedModels(input);

        // Assert
        const entry = result.find((m) => m.id === 'gpt-5-preview');
        expect(entry).toEqual({ id: 'gpt-5-preview', source: 'detected' });
    });

    it('should tag a curated-only model (missing from detected) as "curated"', () => {
        // Arrange
        const input = {
            providerId: 'openai',
            detected: [{ id: 'gpt-4o' }] // curated also has gpt-4o-mini, gpt-4.1, gpt-4.1-mini, o3-mini
        };

        // Act
        const result = mergeDetectedAndCuratedModels(input);

        // Assert
        const entry = result.find((m) => m.id === 'gpt-4o-mini');
        expect(entry).toEqual({ id: 'gpt-4o-mini', source: 'curated' });
    });

    it('should de-duplicate ids that appear more than once in the detected list', () => {
        // Arrange
        const input = {
            providerId: 'openai',
            detected: [
                { id: 'gpt-5-preview' },
                { id: 'gpt-5-preview' },
                { id: 'gpt-5-preview', uncertain: true }
            ]
        };

        // Act
        const result = mergeDetectedAndCuratedModels(input);

        // Assert
        const matches = result.filter((m) => m.id === 'gpt-5-preview');
        expect(matches).toHaveLength(1);
        // First occurrence wins: no `uncertain` flag on the first entry.
        expect(matches[0]).toEqual({ id: 'gpt-5-preview', source: 'detected' });
    });

    it('should return only curated models when the detected list is empty', () => {
        // Arrange
        const input = { providerId: 'anthropic', detected: [] };

        // Act
        const result = mergeDetectedAndCuratedModels(input);

        // Assert
        expect(result.length).toBeGreaterThan(0);
        expect(result.every((m) => m.source === 'curated')).toBe(true);
    });

    it('should return all detected models with source "detected" for an unknown providerId', () => {
        // Arrange
        const input = {
            providerId: 'my-custom-proxy',
            detected: [{ id: 'custom-model-a' }, { id: 'custom-model-b', uncertain: true }]
        };

        // Act
        const result = mergeDetectedAndCuratedModels(input);

        // Assert
        expect(result).toEqual([
            { id: 'custom-model-a', source: 'detected' },
            { id: 'custom-model-b', source: 'detected', capabilityHint: 'uncertain' }
        ]);
    });

    it('should order curated models first, then extra detected-only models in detection order', () => {
        // Arrange
        const input = {
            providerId: 'openai',
            detected: [{ id: 'zzz-new-model' }, { id: 'gpt-4o' }, { id: 'aaa-new-model' }]
        };

        // Act
        const result = mergeDetectedAndCuratedModels(input);
        const ids = result.map((m) => m.id);

        // Assert — curated order preserved (gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, o3-mini),
        // then extra detected-only entries in their original detection order.
        expect(ids.slice(0, 5)).toEqual([
            'gpt-4o',
            'gpt-4o-mini',
            'gpt-4.1',
            'gpt-4.1-mini',
            'o3-mini'
        ]);
        expect(ids.slice(5)).toEqual(['zzz-new-model', 'aaa-new-model']);
    });

    it('should carry an uncertain detected model forward as capabilityHint "uncertain"', () => {
        // Arrange
        const input = {
            providerId: 'openai',
            detected: [
                { id: 'gpt-4o', uncertain: true },
                { id: 'mystery-model', uncertain: true }
            ]
        };

        // Act
        const result = mergeDetectedAndCuratedModels(input);

        // Assert
        expect(result.find((m) => m.id === 'gpt-4o')).toEqual({
            id: 'gpt-4o',
            source: 'both',
            capabilityHint: 'uncertain'
        });
        expect(result.find((m) => m.id === 'mystery-model')).toEqual({
            id: 'mystery-model',
            source: 'detected',
            capabilityHint: 'uncertain'
        });
    });

    it('should produce entries that all parse against AiProviderModelSchema', () => {
        // Arrange
        const input = {
            providerId: 'ollama',
            detected: [{ id: 'llama3' }, { id: 'brand-new-local-model', uncertain: true }]
        };

        // Act
        const result = mergeDetectedAndCuratedModels(input);

        // Assert
        for (const entry of result) {
            expect(AiProviderModelSchema.safeParse(entry).success).toBe(true);
        }
        expect(result.length).toBeGreaterThan(0);
    });
});
