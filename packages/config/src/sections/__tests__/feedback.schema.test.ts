import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { type FeedbackConfig, FeedbackSchema, parseFeedbackSchema } from '../feedback.schema.js';

describe('FeedbackSchema', () => {
    describe('validation', () => {
        it('should accept valid configuration with all fields', () => {
            // Arrange
            const input = {
                HOSPEDA_LINEAR_API_KEY: 'lin_api_abc123',
                HOSPEDA_FEEDBACK_FALLBACK_EMAIL: 'support@hospeda.com',
                HOSPEDA_FEEDBACK_ENABLED: 'true'
            };

            // Act
            const result = FeedbackSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.HOSPEDA_LINEAR_API_KEY).toBe('lin_api_abc123');
                expect(result.data.HOSPEDA_FEEDBACK_FALLBACK_EMAIL).toBe('support@hospeda.com');
                expect(result.data.HOSPEDA_FEEDBACK_ENABLED).toBe(true);
            }
        });

        it('should accept configuration without Linear API key (optional field)', () => {
            // Arrange
            const input = {
                HOSPEDA_FEEDBACK_FALLBACK_EMAIL: 'fallback@hospeda.com',
                HOSPEDA_FEEDBACK_ENABLED: 'true'
            };

            // Act
            const result = FeedbackSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.HOSPEDA_LINEAR_API_KEY).toBeUndefined();
            }
        });

        it('should apply default values when no fields are provided', () => {
            // Arrange
            const input = {};

            // Act
            const result = FeedbackSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.HOSPEDA_FEEDBACK_FALLBACK_EMAIL).toBe('feedback@hospeda.com');
                expect(result.data.HOSPEDA_FEEDBACK_ENABLED).toBe(true);
                expect(result.data.HOSPEDA_LINEAR_API_KEY).toBeUndefined();
            }
        });

        it('should transform HOSPEDA_FEEDBACK_ENABLED "true" to boolean true', () => {
            const result = FeedbackSchema.safeParse({ HOSPEDA_FEEDBACK_ENABLED: 'true' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.HOSPEDA_FEEDBACK_ENABLED).toBe(true);
            }
        });

        it('should transform HOSPEDA_FEEDBACK_ENABLED "false" to boolean false', () => {
            const result = FeedbackSchema.safeParse({ HOSPEDA_FEEDBACK_ENABLED: 'false' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.HOSPEDA_FEEDBACK_ENABLED).toBe(false);
            }
        });

        it('should transform HOSPEDA_FEEDBACK_ENABLED "FALSE" (uppercase) to boolean false', () => {
            const result = FeedbackSchema.safeParse({ HOSPEDA_FEEDBACK_ENABLED: 'FALSE' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.HOSPEDA_FEEDBACK_ENABLED).toBe(false);
            }
        });

        it('should treat any non-"false" string for HOSPEDA_FEEDBACK_ENABLED as true', () => {
            const inputs = ['1', 'yes', 'on', 'enabled'];
            for (const val of inputs) {
                const result = FeedbackSchema.safeParse({ HOSPEDA_FEEDBACK_ENABLED: val });
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.HOSPEDA_FEEDBACK_ENABLED).toBe(true);
                }
            }
        });
    });

    describe('validation errors', () => {
        it('should reject an invalid email for HOSPEDA_FEEDBACK_FALLBACK_EMAIL', () => {
            // Arrange
            const input = {
                HOSPEDA_FEEDBACK_FALLBACK_EMAIL: 'not-an-email'
            };

            // Act
            const result = FeedbackSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toContainEqual(
                    expect.objectContaining({
                        path: ['HOSPEDA_FEEDBACK_FALLBACK_EMAIL'],
                        code: z.ZodIssueCode.invalid_string
                    })
                );
            }
        });

        it('should reject an empty string for HOSPEDA_LINEAR_API_KEY when provided', () => {
            // Arrange
            const input = {
                HOSPEDA_LINEAR_API_KEY: ''
            };

            // Act
            const result = FeedbackSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toContainEqual(
                    expect.objectContaining({
                        path: ['HOSPEDA_LINEAR_API_KEY']
                    })
                );
            }
        });
    });

    describe('type inference', () => {
        it('should infer the correct TypeScript type with boolean HOSPEDA_FEEDBACK_ENABLED', () => {
            const config: FeedbackConfig = {
                HOSPEDA_LINEAR_API_KEY: 'lin_key',
                HOSPEDA_FEEDBACK_FALLBACK_EMAIL: 'feedback@hospeda.com',
                HOSPEDA_FEEDBACK_ENABLED: true
            };

            expect(typeof config.HOSPEDA_FEEDBACK_ENABLED).toBe('boolean');
            expect(typeof config.HOSPEDA_FEEDBACK_FALLBACK_EMAIL).toBe('string');
        });

        it('should allow optional LINEAR_API_KEY in type', () => {
            const config: FeedbackConfig = {
                HOSPEDA_FEEDBACK_FALLBACK_EMAIL: 'feedback@hospeda.com',
                HOSPEDA_FEEDBACK_ENABLED: true
            };

            expect(config.HOSPEDA_LINEAR_API_KEY).toBeUndefined();
        });
    });
});

describe('parseFeedbackSchema', () => {
    it('should parse valid environment variables', () => {
        // Arrange
        const env = {
            HOSPEDA_LINEAR_API_KEY: 'lin_api_test',
            HOSPEDA_FEEDBACK_FALLBACK_EMAIL: 'team@hospeda.com',
            HOSPEDA_FEEDBACK_ENABLED: 'true'
        };

        // Act
        const config = parseFeedbackSchema(env);

        // Assert
        expect(config.HOSPEDA_LINEAR_API_KEY).toBe('lin_api_test');
        expect(config.HOSPEDA_FEEDBACK_FALLBACK_EMAIL).toBe('team@hospeda.com');
        expect(config.HOSPEDA_FEEDBACK_ENABLED).toBe(true);
    });

    it('should apply defaults when variables are missing', () => {
        // Arrange
        const env = {};

        // Act
        const config = parseFeedbackSchema(env);

        // Assert
        expect(config.HOSPEDA_LINEAR_API_KEY).toBeUndefined();
        expect(config.HOSPEDA_FEEDBACK_FALLBACK_EMAIL).toBe('feedback@hospeda.com');
        expect(config.HOSPEDA_FEEDBACK_ENABLED).toBe(true);
    });

    it('should parse HOSPEDA_FEEDBACK_ENABLED "false" correctly', () => {
        const config = parseFeedbackSchema({ HOSPEDA_FEEDBACK_ENABLED: 'false' });
        expect(config.HOSPEDA_FEEDBACK_ENABLED).toBe(false);
    });

    it('should handle undefined values correctly', () => {
        // Arrange
        const env: Record<string, string | undefined> = {
            HOSPEDA_LINEAR_API_KEY: undefined,
            HOSPEDA_FEEDBACK_FALLBACK_EMAIL: undefined,
            HOSPEDA_FEEDBACK_ENABLED: undefined
        };

        // Act
        const config = parseFeedbackSchema(env);

        // Assert
        expect(config.HOSPEDA_LINEAR_API_KEY).toBeUndefined();
        expect(config.HOSPEDA_FEEDBACK_FALLBACK_EMAIL).toBe('feedback@hospeda.com');
        expect(config.HOSPEDA_FEEDBACK_ENABLED).toBe(true);
    });

    it('should throw ZodError for invalid fallback email', () => {
        const env = { HOSPEDA_FEEDBACK_FALLBACK_EMAIL: 'invalid' };
        expect(() => parseFeedbackSchema(env)).toThrow(z.ZodError);
    });
});
