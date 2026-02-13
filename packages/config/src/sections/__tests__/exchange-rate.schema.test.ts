import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
    type ExchangeRateConfig,
    ExchangeRateSchema,
    parseExchangeRateSchema
} from '../exchange-rate.schema.js';

describe('ExchangeRateSchema', () => {
    describe('validation', () => {
        it('should accept valid exchange rate configuration with all fields', () => {
            const validConfig = {
                HOSPEDA_EXCHANGE_RATE_API_KEY: 'test-api-key-123',
                HOSPEDA_DOLAR_API_BASE_URL: 'https://dolarapi.com/v1',
                HOSPEDA_EXCHANGE_RATE_API_BASE_URL: 'https://v6.exchangerate-api.com/v6'
            };

            const result = ExchangeRateSchema.safeParse(validConfig);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.HOSPEDA_EXCHANGE_RATE_API_KEY).toBe('test-api-key-123');
                expect(result.data.HOSPEDA_DOLAR_API_BASE_URL).toBe('https://dolarapi.com/v1');
                expect(result.data.HOSPEDA_EXCHANGE_RATE_API_BASE_URL).toBe(
                    'https://v6.exchangerate-api.com/v6'
                );
            }
        });

        it('should accept valid configuration without API key (optional)', () => {
            const validConfig = {
                HOSPEDA_DOLAR_API_BASE_URL: 'https://dolarapi.com/v1',
                HOSPEDA_EXCHANGE_RATE_API_BASE_URL: 'https://v6.exchangerate-api.com/v6'
            };

            const result = ExchangeRateSchema.safeParse(validConfig);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.HOSPEDA_EXCHANGE_RATE_API_KEY).toBeUndefined();
            }
        });

        it('should apply default values when URLs are not provided', () => {
            const minimalConfig = {};

            const result = ExchangeRateSchema.safeParse(minimalConfig);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.HOSPEDA_DOLAR_API_BASE_URL).toBe('https://dolarapi.com/v1');
                expect(result.data.HOSPEDA_EXCHANGE_RATE_API_BASE_URL).toBe(
                    'https://v6.exchangerate-api.com/v6'
                );
            }
        });

        it('should accept custom valid URLs', () => {
            const customConfig = {
                HOSPEDA_DOLAR_API_BASE_URL: 'https://custom-dolar-api.example.com',
                HOSPEDA_EXCHANGE_RATE_API_BASE_URL: 'https://custom-exchange-api.example.com'
            };

            const result = ExchangeRateSchema.safeParse(customConfig);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.HOSPEDA_DOLAR_API_BASE_URL).toBe(
                    'https://custom-dolar-api.example.com'
                );
                expect(result.data.HOSPEDA_EXCHANGE_RATE_API_BASE_URL).toBe(
                    'https://custom-exchange-api.example.com'
                );
            }
        });
    });

    describe('validation errors', () => {
        it('should reject invalid URL for HOSPEDA_DOLAR_API_BASE_URL', () => {
            const invalidConfig = {
                HOSPEDA_DOLAR_API_BASE_URL: 'not-a-valid-url'
            };

            const result = ExchangeRateSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);

            if (!result.success) {
                expect(result.error.issues).toContainEqual(
                    expect.objectContaining({
                        path: ['HOSPEDA_DOLAR_API_BASE_URL'],
                        code: z.ZodIssueCode.invalid_string
                    })
                );
            }
        });

        it('should reject invalid URL for HOSPEDA_EXCHANGE_RATE_API_BASE_URL', () => {
            const invalidConfig = {
                HOSPEDA_EXCHANGE_RATE_API_BASE_URL: 'invalid-url'
            };

            const result = ExchangeRateSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);

            if (!result.success) {
                expect(result.error.issues).toContainEqual(
                    expect.objectContaining({
                        path: ['HOSPEDA_EXCHANGE_RATE_API_BASE_URL'],
                        code: z.ZodIssueCode.invalid_string
                    })
                );
            }
        });

        it('should reject empty string URLs', () => {
            const invalidConfig = {
                HOSPEDA_DOLAR_API_BASE_URL: '',
                HOSPEDA_EXCHANGE_RATE_API_BASE_URL: ''
            };

            const result = ExchangeRateSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
        });
    });

    describe('type inference', () => {
        it('should infer correct TypeScript type', () => {
            const config: ExchangeRateConfig = {
                HOSPEDA_EXCHANGE_RATE_API_KEY: 'key',
                HOSPEDA_DOLAR_API_BASE_URL: 'https://dolarapi.com/v1',
                HOSPEDA_EXCHANGE_RATE_API_BASE_URL: 'https://v6.exchangerate-api.com/v6'
            };

            // Type assertion to ensure TypeScript compilation
            expect(typeof config.HOSPEDA_DOLAR_API_BASE_URL).toBe('string');
            expect(typeof config.HOSPEDA_EXCHANGE_RATE_API_BASE_URL).toBe('string');
        });

        it('should allow optional API key in type', () => {
            const configWithoutKey: ExchangeRateConfig = {
                HOSPEDA_DOLAR_API_BASE_URL: 'https://dolarapi.com/v1',
                HOSPEDA_EXCHANGE_RATE_API_BASE_URL: 'https://v6.exchangerate-api.com/v6'
            };

            // Should compile without errors
            expect(configWithoutKey.HOSPEDA_EXCHANGE_RATE_API_KEY).toBeUndefined();
        });
    });
});

describe('parseExchangeRateSchema', () => {
    it('should parse valid environment variables', () => {
        const env = {
            HOSPEDA_EXCHANGE_RATE_API_KEY: 'test-key',
            HOSPEDA_DOLAR_API_BASE_URL: 'https://dolarapi.com/v1',
            HOSPEDA_EXCHANGE_RATE_API_BASE_URL: 'https://v6.exchangerate-api.com/v6'
        };

        const config = parseExchangeRateSchema(env);

        expect(config.HOSPEDA_EXCHANGE_RATE_API_KEY).toBe('test-key');
        expect(config.HOSPEDA_DOLAR_API_BASE_URL).toBe('https://dolarapi.com/v1');
        expect(config.HOSPEDA_EXCHANGE_RATE_API_BASE_URL).toBe(
            'https://v6.exchangerate-api.com/v6'
        );
    });

    it('should apply defaults when variables are missing', () => {
        const env = {};

        const config = parseExchangeRateSchema(env);

        expect(config.HOSPEDA_EXCHANGE_RATE_API_KEY).toBeUndefined();
        expect(config.HOSPEDA_DOLAR_API_BASE_URL).toBe('https://dolarapi.com/v1');
        expect(config.HOSPEDA_EXCHANGE_RATE_API_BASE_URL).toBe(
            'https://v6.exchangerate-api.com/v6'
        );
    });

    it('should parse environment with only API key', () => {
        const env = {
            HOSPEDA_EXCHANGE_RATE_API_KEY: 'production-key'
        };

        const config = parseExchangeRateSchema(env);

        expect(config.HOSPEDA_EXCHANGE_RATE_API_KEY).toBe('production-key');
        expect(config.HOSPEDA_DOLAR_API_BASE_URL).toBe('https://dolarapi.com/v1');
        expect(config.HOSPEDA_EXCHANGE_RATE_API_BASE_URL).toBe(
            'https://v6.exchangerate-api.com/v6'
        );
    });

    it('should throw ZodError for invalid URLs', () => {
        const env = {
            HOSPEDA_DOLAR_API_BASE_URL: 'not-a-url'
        };

        expect(() => parseExchangeRateSchema(env)).toThrow(z.ZodError);
    });

    it('should handle undefined values correctly', () => {
        const env = {
            HOSPEDA_EXCHANGE_RATE_API_KEY: undefined,
            HOSPEDA_DOLAR_API_BASE_URL: undefined,
            HOSPEDA_EXCHANGE_RATE_API_BASE_URL: undefined
        };

        const config = parseExchangeRateSchema(env);

        expect(config.HOSPEDA_EXCHANGE_RATE_API_KEY).toBeUndefined();
        expect(config.HOSPEDA_DOLAR_API_BASE_URL).toBe('https://dolarapi.com/v1');
        expect(config.HOSPEDA_EXCHANGE_RATE_API_BASE_URL).toBe(
            'https://v6.exchangerate-api.com/v6'
        );
    });

    it('should accept custom valid URLs', () => {
        const env = {
            HOSPEDA_DOLAR_API_BASE_URL: 'https://my-dolar-api.local',
            HOSPEDA_EXCHANGE_RATE_API_BASE_URL: 'https://my-exchange-api.local'
        };

        const config = parseExchangeRateSchema(env);

        expect(config.HOSPEDA_DOLAR_API_BASE_URL).toBe('https://my-dolar-api.local');
        expect(config.HOSPEDA_EXCHANGE_RATE_API_BASE_URL).toBe('https://my-exchange-api.local');
    });
});

describe('commonEnvSchemas integration', () => {
    it('should be compatible with commonEnvSchemas pattern', () => {
        // Verify that the schema can be used like other common schemas
        const extendedSchema = ExchangeRateSchema.extend({
            NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
        });

        const result = extendedSchema.safeParse({
            NODE_ENV: 'development'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.NODE_ENV).toBe('development');
            expect(result.data.HOSPEDA_DOLAR_API_BASE_URL).toBe('https://dolarapi.com/v1');
        }
    });
});
