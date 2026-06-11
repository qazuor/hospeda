import { describe, expect, it } from 'vitest';
import { AiFeatureSchema, type AiFeature } from '../ai-provider.schema.js';

describe('AiFeatureSchema', () => {
    it('should include all five V1 AI features', () => {
        const features = AiFeatureSchema.enum;
        expect(features).toHaveProperty('text_improve');
        expect(features).toHaveProperty('chat');
        expect(features).toHaveProperty('search');
        expect(features).toHaveProperty('support');
        expect(features).toHaveProperty('translate');
    });

    it('should validate known feature values', () => {
        const validFeatures: AiFeature[] = ['text_improve', 'chat', 'search', 'support', 'translate'];
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
});
