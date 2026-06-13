import { describe, expect, it } from 'vitest';
import { TranslationMetaSchema } from '../../common/i18n.schema.js';

// ============================================================================
// TranslationMetaSchema
// ============================================================================

describe('TranslationMetaSchema', () => {
    describe('when given valid metadata', () => {
        it('should accept a complete translation metadata object', () => {
            const valid = {
                name: {
                    en: {
                        autoTranslated: true,
                        translatedAt: '2026-06-10T15:30:00Z',
                        provider: 'google',
                        model: 'gemini-1.5-flash'
                    },
                    pt: {
                        autoTranslated: true,
                        translatedAt: '2026-06-10T15:30:01Z',
                        provider: 'google',
                        model: 'gemini-1.5-flash'
                    }
                },
                description: {
                    en: {
                        autoTranslated: false,
                        translatedAt: '2026-06-10T16:00:00Z'
                    }
                }
            };

            const result = TranslationMetaSchema.safeParse(valid);
            expect(result.success).toBe(true);
        });

        it('should accept metadata without optional provider/model', () => {
            const valid = {
                name: {
                    en: {
                        autoTranslated: false,
                        translatedAt: '2026-06-10T12:00:00Z'
                    }
                }
            };

            const result = TranslationMetaSchema.safeParse(valid);
            expect(result.success).toBe(true);
        });

        it('should accept an empty object', () => {
            const result = TranslationMetaSchema.safeParse({});
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid metadata', () => {
        it('should reject when autoTranslated is missing', () => {
            const invalid = {
                name: {
                    en: {
                        translatedAt: '2026-06-10T12:00:00Z'
                    }
                }
            };

            const result = TranslationMetaSchema.safeParse(invalid);
            expect(result.success).toBe(false);
        });

        it('should reject when translatedAt is missing', () => {
            const invalid = {
                name: {
                    en: {
                        autoTranslated: true
                    }
                }
            };

            const result = TranslationMetaSchema.safeParse(invalid);
            expect(result.success).toBe(false);
        });

        it('should reject non-object values', () => {
            const result = TranslationMetaSchema.safeParse('not an object');
            expect(result.success).toBe(false);
        });

        it('should reject null', () => {
            const result = TranslationMetaSchema.safeParse(null);
            expect(result.success).toBe(false);
        });
    });
});
