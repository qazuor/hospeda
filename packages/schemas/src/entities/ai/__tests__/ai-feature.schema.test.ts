import { describe, expect, it } from 'vitest';
import { type AiFeature, AiFeatureSchema } from '../ai-provider.schema.js';

describe('AiFeatureSchema', () => {
    it('should include all seven AI features', () => {
        const features = AiFeatureSchema.enum;
        expect(features).toHaveProperty('text_improve');
        expect(features).toHaveProperty('chat');
        expect(features).toHaveProperty('search');
        expect(features).toHaveProperty('support');
        expect(features).toHaveProperty('translate');
        expect(features).toHaveProperty('accommodation_import');
        expect(features).toHaveProperty('post_generate');
    });

    it('should validate known feature values', () => {
        const validFeatures: AiFeature[] = [
            'text_improve',
            'chat',
            'search',
            'support',
            'translate',
            'accommodation_import',
            'post_generate'
        ];
        for (const feature of validFeatures) {
            const result = AiFeatureSchema.safeParse(feature);
            expect(result.success).toBe(true);
        }
    });

    it('should reject unknown feature values', () => {
        const result = AiFeatureSchema.safeParse('unknown_feature');
        expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
        const result = AiFeatureSchema.safeParse('');
        expect(result.success).toBe(false);
    });

    it('should accept translate as a valid feature', () => {
        const result = AiFeatureSchema.safeParse('translate');
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBe('translate');
        }
    });

    it('should accept accommodation_import as a valid feature (SPEC-222)', () => {
        const result = AiFeatureSchema.safeParse('accommodation_import');
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBe('accommodation_import');
        }
    });

    it('should accept post_generate as a valid feature (SPEC-223)', () => {
        const result = AiFeatureSchema.safeParse('post_generate');
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBe('post_generate');
        }
    });
});
