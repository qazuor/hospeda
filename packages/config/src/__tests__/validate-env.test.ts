import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EnvValidationError, commonEnvSchemas, validateEnv } from '../env.js';

describe('EnvValidationError', () => {
    it('should include context and formatted error messages', () => {
        // Arrange
        const schema = z.object({
            REQUIRED_VAR: z.string(),
            REQUIRED_NUM: z.number()
        });
        const parseResult = schema.safeParse({});

        // Act
        const error = new EnvValidationError(
            (parseResult as { success: false; error: z.ZodError }).error,
            'Test Context'
        );

        // Assert
        expect(error.name).toBe('EnvValidationError');
        expect(error.message).toContain('Test Context');
        expect(error.message).toContain('REQUIRED_VAR');
        expect(error.message).toContain('REQUIRED_NUM');
        expect(error.context).toBe('Test Context');
        expect(error.errors).toBeInstanceOf(z.ZodError);
    });

    it('should be an instance of Error', () => {
        // Arrange
        const zodError = new z.ZodError([]);

        // Act
        const error = new EnvValidationError(zodError, 'ctx');

        // Assert
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(EnvValidationError);
    });
});

describe('validateEnv', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    it('should return validated env object when schema matches', () => {
        // Arrange
        const schema = z.object({
            NODE_ENV: z.string().default('test')
        });

        // Act
        const result = validateEnv(schema, 'Test');

        // Assert
        expect(result).toBeDefined();
        expect(typeof result.NODE_ENV).toBe('string');
    });

    it('should throw EnvValidationError when validation fails', () => {
        // Arrange
        const schema = z.object({
            HOSPEDA_NONEXISTENT_REQUIRED_VAR: z.string()
        });

        // Act / Assert
        expect(() => validateEnv(schema, 'Test')).toThrow(EnvValidationError);
    });

    it('should include context in the error message', () => {
        // Arrange
        const schema = z.object({
            HOSPEDA_NONEXISTENT_REQUIRED_VAR: z.string()
        });

        // Act / Assert
        try {
            validateEnv(schema, 'My App');
            expect.fail('Should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(EnvValidationError);
            expect((error as EnvValidationError).message).toContain('My App');
        }
    });

    it('should re-throw non-ZodError errors', () => {
        // Arrange - schema with a custom refine that throws a non-Zod error
        const schema = {
            parse: () => {
                throw new TypeError('unexpected');
            }
        } as unknown as z.ZodSchema;

        // Act / Assert
        expect(() => validateEnv(schema, 'Test')).toThrow(TypeError);
    });
});

describe('commonEnvSchemas', () => {
    describe('server', () => {
        it('should validate valid server env', () => {
            // Arrange
            const input = {
                NODE_ENV: 'production',
                HOSPEDA_API_URL: 'https://api.hospeda.com',
                HOSPEDA_DATABASE_URL: 'postgresql://user:pass@localhost:5432/db'
            };

            // Act
            const result = commonEnvSchemas.server.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should apply default NODE_ENV', () => {
            // Arrange
            const input = {
                HOSPEDA_API_URL: 'https://api.hospeda.com',
                HOSPEDA_DATABASE_URL: 'postgresql://localhost/db'
            };

            // Act
            const result = commonEnvSchemas.server.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.NODE_ENV).toBe('development');
            }
        });

        it('should reject invalid API URL', () => {
            // Arrange
            const input = {
                HOSPEDA_API_URL: 'not-a-url',
                HOSPEDA_DATABASE_URL: 'postgresql://localhost/db'
            };

            // Act
            const result = commonEnvSchemas.server.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject empty database URL', () => {
            // Arrange
            const input = {
                HOSPEDA_API_URL: 'https://api.hospeda.com',
                HOSPEDA_DATABASE_URL: ''
            };

            // Act
            const result = commonEnvSchemas.server.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('client', () => {
        it('should validate valid client env', () => {
            // Arrange
            const input = {
                HOSPEDA_API_URL: 'https://api.hospeda.com',
                HOSPEDA_SITE_URL: 'https://hospeda.com',
                HOSPEDA_BETTER_AUTH_URL: 'https://api.hospeda.com/api/auth'
            };

            // Act
            const result = commonEnvSchemas.client.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject missing HOSPEDA_SITE_URL', () => {
            // Arrange
            const input = {
                HOSPEDA_API_URL: 'https://api.hospeda.com',
                HOSPEDA_BETTER_AUTH_URL: 'https://api.hospeda.com/api/auth'
            };

            // Act
            const result = commonEnvSchemas.client.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('auth', () => {
        it('should validate valid auth env', () => {
            // Arrange
            const input = {
                HOSPEDA_BETTER_AUTH_URL: 'https://auth.hospeda.com',
                HOSPEDA_BETTER_AUTH_SECRET: 'super-secret-key-at-least-32-chars'
            };

            // Act
            const result = commonEnvSchemas.auth.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject empty auth secret', () => {
            // Arrange
            const input = {
                HOSPEDA_BETTER_AUTH_URL: 'https://auth.hospeda.com',
                HOSPEDA_BETTER_AUTH_SECRET: ''
            };

            // Act
            const result = commonEnvSchemas.auth.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('i18n', () => {
        it('should apply default locales', () => {
            // Arrange
            const input = {};

            // Act
            const result = commonEnvSchemas.i18n.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.HOSPEDA_SUPPORTED_LOCALES).toBe('en,es');
                expect(result.data.HOSPEDA_DEFAULT_LOCALE).toBe('en');
            }
        });

        it('should accept custom locales', () => {
            // Arrange
            const input = {
                HOSPEDA_SUPPORTED_LOCALES: 'es,en,pt',
                HOSPEDA_DEFAULT_LOCALE: 'es'
            };

            // Act
            const result = commonEnvSchemas.i18n.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.HOSPEDA_SUPPORTED_LOCALES).toBe('es,en,pt');
                expect(result.data.HOSPEDA_DEFAULT_LOCALE).toBe('es');
            }
        });
    });

    describe('logging', () => {
        it('should apply default values', () => {
            // Arrange
            const input = {};

            // Act
            const result = commonEnvSchemas.logging.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.LOG_LEVEL).toBe('info');
                expect(result.data.ENABLE_REQUEST_LOGGING).toBe(true);
                expect(result.data.LOG_INCLUDE_TIMESTAMPS).toBe(true);
                expect(result.data.LOG_USE_COLORS).toBe(true);
            }
        });

        it('should reject invalid log level', () => {
            // Arrange
            const input = { LOG_LEVEL: 'trace' };

            // Act
            const result = commonEnvSchemas.logging.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('exchangeRate', () => {
        it('should apply default URLs', () => {
            // Arrange
            const input = {};

            // Act
            const result = commonEnvSchemas.exchangeRate.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.HOSPEDA_DOLAR_API_BASE_URL).toBe('https://dolarapi.com/v1');
                expect(result.data.HOSPEDA_EXCHANGE_RATE_API_BASE_URL).toBe(
                    'https://v6.exchangerate-api.com/v6'
                );
                expect(result.data.HOSPEDA_EXCHANGE_RATE_API_KEY).toBeUndefined();
            }
        });
    });
});
