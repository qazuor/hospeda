/**
 * Environment Configuration Tests
 * Tests the environment variable loading and validation
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dotenv
vi.mock('dotenv', () => ({
    config: vi.fn()
}));

// Store original process.env
const originalEnv = process.env;

describe('Environment Configuration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset process.env to original state
        process.env = { ...originalEnv };
        // Clear module cache to force re-import
        vi.resetModules();
    });

    describe('Environment Variable Loading', () => {
        it('should load environment variables with defaults', async () => {
            // Set minimal environment
            process.env = { NODE_ENV: 'test' };

            const { env } = await import('../../src/utils/env');

            expect(env.NODE_ENV).toBe('test');
            expect(env.API_PORT).toBe(3001);
            expect(env.API_HOST).toBe('localhost');
            expect(env.LOG_LEVEL).toBe('info');
        });

        it('should load all configuration sections', async () => {
            // Set environment with all sections
            process.env = {
                NODE_ENV: 'test',
                API_PORT: '8080',
                LOG_LEVEL: 'debug',
                CACHE_ENABLED: 'true',
                COMPRESSION_LEVEL: '5',
                RATE_LIMIT_KEY_GENERATOR: 'user',
                SECURITY_X_FRAME_OPTIONS: 'DENY'
            };

            const { env } = await import('../../src/utils/env');

            // Server Configuration
            expect(env.NODE_ENV).toBe('test');
            expect(env.API_PORT).toBe(8080);
            expect(env.API_HOST).toBe('localhost');

            // Logging Configuration
            expect(env.LOG_LEVEL).toBe('debug');
            expect(env.ENABLE_REQUEST_LOGGING).toBe(true);

            // Cache Configuration
            expect(env.CACHE_ENABLED).toBe(true);
            expect(env.CACHE_DEFAULT_MAX_AGE).toBe(300);
            expect(env.CACHE_DEFAULT_STALE_WHILE_REVALIDATE).toBe(60);
            expect(env.CACHE_DEFAULT_STALE_IF_ERROR).toBe(86400);
            expect(env.CACHE_PUBLIC_ENDPOINTS).toBe('/api/v1/public/accommodations,/health');
            expect(env.CACHE_PRIVATE_ENDPOINTS).toBe('/api/v1/public/users');
            expect(env.CACHE_NO_CACHE_ENDPOINTS).toBe('/health/db,/docs');

            // Compression Configuration
            expect(env.COMPRESSION_ENABLED).toBe(true);
            expect(env.COMPRESSION_LEVEL).toBe(5);
            expect(env.COMPRESSION_THRESHOLD).toBe(1024);
            expect(env.COMPRESSION_CHUNK_SIZE).toBe(16384);
            expect(env.COMPRESSION_FILTER).toBe(
                'text/*,application/json,application/xml,application/javascript'
            );
            expect(env.COMPRESSION_EXCLUDE_ENDPOINTS).toBe('/health/db,/docs');
            expect(env.COMPRESSION_ALGORITHMS).toBe('gzip,deflate');

            // Rate Limiting Configuration
            expect(env.RATE_LIMIT_ENABLED).toBe(true);
            expect(env.RATE_LIMIT_WINDOW_MS).toBe(900000);
            expect(env.RATE_LIMIT_MAX_REQUESTS).toBe(100);
            expect(env.RATE_LIMIT_KEY_GENERATOR).toBe('user');
            expect(env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS).toBe(false);
            expect(env.RATE_LIMIT_SKIP_FAILED_REQUESTS).toBe(false);
            expect(env.RATE_LIMIT_STANDARD_HEADERS).toBe(true);
            expect(env.RATE_LIMIT_LEGACY_HEADERS).toBe(false);
            expect(env.RATE_LIMIT_MESSAGE).toBe('Too many requests, please try again later.');

            // Security Configuration
            expect(env.SECURITY_ENABLED).toBe(true);
            expect(env.SECURITY_HEADERS_ENABLED).toBe(true);
            expect(env.SECURITY_CONTENT_SECURITY_POLICY).toBe(
                "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
            );
            expect(env.SECURITY_STRICT_TRANSPORT_SECURITY).toBe(
                'max-age=31536000; includeSubDomains'
            );
            expect(env.SECURITY_X_FRAME_OPTIONS).toBe('DENY');
            expect(env.SECURITY_X_CONTENT_TYPE_OPTIONS).toBe('nosniff');
            expect(env.SECURITY_X_XSS_PROTECTION).toBe('1; mode=block');
            expect(env.SECURITY_REFERRER_POLICY).toBe('strict-origin-when-cross-origin');
            expect(env.SECURITY_PERMISSIONS_POLICY).toBe(
                'camera=(), microphone=(), geolocation=()'
            );

            // Response Formatting Configuration
            expect(env.RESPONSE_FORMAT_ENABLED).toBe(true);
            expect(env.RESPONSE_INCLUDE_TIMESTAMP).toBe(true);
            expect(env.RESPONSE_INCLUDE_VERSION).toBe(true);
            expect(env.RESPONSE_API_VERSION).toBe('1.0.0');
            expect(env.RESPONSE_INCLUDE_REQUEST_ID).toBe(true);
            expect(env.RESPONSE_INCLUDE_METADATA).toBe(true);
            expect(env.RESPONSE_SUCCESS_MESSAGE).toBe('Success');
            expect(env.RESPONSE_ERROR_MESSAGE).toBe('An error occurred');

            // Validation Configuration
            expect(env.VALIDATION_MAX_BODY_SIZE).toBe(10 * 1024 * 1024);
            expect(env.VALIDATION_MAX_REQUEST_TIME).toBe(30000);
            expect(env.VALIDATION_ALLOWED_CONTENT_TYPES).toBe(
                'application/json,multipart/form-data'
            );
            expect(env.VALIDATION_REQUIRED_HEADERS).toBe('user-agent');
            expect(env.VALIDATION_CLERK_AUTH_ENABLED).toBe(true);
            expect(env.VALIDATION_CLERK_AUTH_HEADERS).toBe('authorization');
            expect(env.VALIDATION_SANITIZE_ENABLED).toBe(true);
            expect(env.VALIDATION_SANITIZE_MAX_STRING_LENGTH).toBe(1000);
            expect(env.VALIDATION_SANITIZE_REMOVE_HTML_TAGS).toBe(true);
            expect(env.VALIDATION_SANITIZE_ALLOWED_CHARS).toBe('[\\w\\s\\-.,!?@#$%&*()+=]');

            // Internationalization Configuration
            expect(env.SUPPORTED_LOCALES).toBe('en,es');
            expect(env.DEFAULT_LOCALE).toBe('en');
        });
    });

    describe('Environment Variable Validation', () => {
        it('should validate NODE_ENV enum values', async () => {
            const validEnvs = ['development', 'production', 'test'];

            for (const envValue of validEnvs) {
                process.env = { NODE_ENV: envValue };
                const { env } = await import('../../src/utils/env');
                expect(env.NODE_ENV).toBe(envValue);
                vi.resetModules();
            }
        });

        it('should use default NODE_ENV when not provided', async () => {
            process.env = {};
            const { env } = await import('../../src/utils/env');
            expect(env.NODE_ENV).toBe('development');
        });

        it('should validate LOG_LEVEL enum values', async () => {
            const validLevels = ['debug', 'info', 'warn', 'error'];

            for (const level of validLevels) {
                process.env = { LOG_LEVEL: level.toUpperCase() };
                const { env } = await import('../../src/utils/env');
                expect(env.LOG_LEVEL).toBe(level);
                vi.resetModules();
            }
        });

        it('should use default LOG_LEVEL when not provided', async () => {
            process.env = {};
            const { env } = await import('../../src/utils/env');
            expect(env.LOG_LEVEL).toBe('info');
        });

        it('should validate RATE_LIMIT_KEY_GENERATOR enum values', async () => {
            const validGenerators = ['ip', 'user', 'custom'];

            for (const generator of validGenerators) {
                process.env = { RATE_LIMIT_KEY_GENERATOR: generator };
                const { env } = await import('../../src/utils/env');
                expect(env.RATE_LIMIT_KEY_GENERATOR).toBe(generator);
                vi.resetModules();
            }
        });

        it('should validate SECURITY_X_FRAME_OPTIONS enum values', async () => {
            const validOptions = ['DENY', 'SAMEORIGIN', 'ALLOW-FROM'];

            for (const option of validOptions) {
                process.env = { SECURITY_X_FRAME_OPTIONS: option };
                const { env } = await import('../../src/utils/env');
                expect(env.SECURITY_X_FRAME_OPTIONS).toBe(option);
                vi.resetModules();
            }
        });

        it('should coerce string numbers to numbers', async () => {
            process.env = {
                API_PORT: '8080',
                CACHE_DEFAULT_MAX_AGE: '600',
                COMPRESSION_LEVEL: '9'
            };

            const { env } = await import('../../src/utils/env');

            expect(env.API_PORT).toBe(8080);
            expect(env.CACHE_DEFAULT_MAX_AGE).toBe(600);
            expect(env.COMPRESSION_LEVEL).toBe(9);
        });

        it('should coerce string booleans to booleans', async () => {
            process.env = {
                API_LOG_SAVE: 'true',
                CACHE_ENABLED: 'true',
                RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: 'true'
            };

            const { env } = await import('../../src/utils/env');

            expect(env.API_LOG_SAVE).toBe(true);
            expect(env.CACHE_ENABLED).toBe(true);
            expect(env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS).toBe(true);
        });
    });

    describe('Optional Environment Variables', () => {
        it('should handle optional DATABASE_URL', async () => {
            process.env = { DATABASE_URL: 'postgresql://localhost:5432/test' };
            const { env } = await import('../../src/utils/env');
            expect(env.DATABASE_URL).toBe('postgresql://localhost:5432/test');
        });

        it('should handle missing DATABASE_URL', async () => {
            process.env = {};
            const { env } = await import('../../src/utils/env');
            expect(env.DATABASE_URL).toBeUndefined();
        });

        it('should handle optional CLERK keys', async () => {
            process.env = {
                CLERK_PUBLISHABLE_KEY: 'pk_test_key',
                CLERK_SECRET_KEY: 'sk_test_key'
            };
            const { env } = await import('../../src/utils/env');
            expect(env.CLERK_PUBLISHABLE_KEY).toBe('pk_test_key');
            expect(env.CLERK_SECRET_KEY).toBe('sk_test_key');
        });

        it('should handle missing CLERK keys', async () => {
            process.env = {};
            const { env } = await import('../../src/utils/env');
            expect(env.CLERK_PUBLISHABLE_KEY).toBeUndefined();
            expect(env.CLERK_SECRET_KEY).toBeUndefined();
        });
    });

    describe('Validation Constraints', () => {
        it('should validate COMPRESSION_LEVEL range', async () => {
            process.env = { COMPRESSION_LEVEL: '5' };
            const { env } = await import('../../src/utils/env');
            expect(env.COMPRESSION_LEVEL).toBe(5);
        });

        it('should validate positive numbers', async () => {
            process.env = {
                VALIDATION_MAX_BODY_SIZE: '1048576',
                VALIDATION_MAX_REQUEST_TIME: '5000'
            };
            const { env } = await import('../../src/utils/env');
            expect(env.VALIDATION_MAX_BODY_SIZE).toBe(1048576);
            expect(env.VALIDATION_MAX_REQUEST_TIME).toBe(5000);
        });
    });

    describe('String Transformations', () => {
        it('should transform LOG_LEVEL to lowercase', async () => {
            process.env = { LOG_LEVEL: 'DEBUG' };
            const { env } = await import('../../src/utils/env');
            expect(env.LOG_LEVEL).toBe('debug');
        });

        it('should handle mixed case LOG_LEVEL', async () => {
            process.env = { LOG_LEVEL: 'WARN' };
            const { env } = await import('../../src/utils/env');
            expect(env.LOG_LEVEL).toBe('warn');
        });
    });

    describe('Error Handling', () => {
        it('should exit process on validation error', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
                throw new Error('Process exit');
            });

            process.env = { NODE_ENV: 'invalid' };

            await expect(import('../../src/utils/env')).rejects.toThrow('Process exit');

            expect(consoleSpy).toHaveBeenCalledWith(
                '❌ Invalid environment configuration:',
                expect.any(Error)
            );
            expect(exitSpy).toHaveBeenCalledWith(1);

            consoleSpy.mockRestore();
            exitSpy.mockRestore();
        });
    });

    describe('Type Exports', () => {
        it('should export env object with correct type', async () => {
            const { env } = await import('../../src/utils/env');
            expect(typeof env).toBe('object');
            expect(env).toHaveProperty('NODE_ENV');
            expect(env).toHaveProperty('API_PORT');
            expect(env).toHaveProperty('LOG_LEVEL');
        });

        it('should export env object with correct type', async () => {
            const { env } = await import('../../src/utils/env');
            expect(typeof env).toBe('object');
            expect(env).toHaveProperty('NODE_ENV');
            expect(env).toHaveProperty('API_PORT');
            expect(env).toHaveProperty('LOG_LEVEL');
        });
    });
});
