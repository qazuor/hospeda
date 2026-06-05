/**
 * Environment Configuration Tests
 * Tests the environment variable loading and validation
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dotenv
vi.mock('dotenv', () => ({
    config: vi.fn()
}));

// Mock apiLogger used by env.ts
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Store original process.env
const originalEnv = process.env;

// Helper to create minimal valid environment
const createValidTestEnv = (overrides: Record<string, string | undefined> = {}) => ({
    NODE_ENV: 'test' as string | undefined,
    HOSPEDA_API_URL: 'http://localhost:3001',
    HOSPEDA_DATABASE_URL: 'postgresql://localhost:5432/hospeda_test',
    HOSPEDA_BETTER_AUTH_SECRET: 'test_better_auth_secret_key_32chars!',
    HOSPEDA_BETTER_AUTH_URL: 'http://localhost:3001/api/auth',
    HOSPEDA_SITE_URL: 'http://localhost:4321',
    HOSPEDA_LOCATION_SALT: 'test-location-salt-fixed-for-deterministic-tests-32+chars',
    HOSPEDA_VIEWS_HASH_SECRET: 'test-views-hash-secret-fixed-for-deterministic-tests-32ch',
    ...overrides
});

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
            // Set minimal environment with required variables
            process.env = createValidTestEnv();

            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();

            expect(envModule.env.NODE_ENV).toBe('test');
            expect(envModule.env.API_PORT).toBe(3001);
            expect(envModule.env.API_HOST).toBe('localhost');
            expect(envModule.env.API_LOG_LEVEL).toBe('info');
            expect(envModule.env.HOSPEDA_API_URL).toBe('http://localhost:3001');
            expect(envModule.env.HOSPEDA_DATABASE_URL).toBe(
                'postgresql://localhost:5432/hospeda_test'
            );
        });

        it('should load all configuration sections', async () => {
            // Set environment with all sections
            process.env = createValidTestEnv({
                API_PORT: '8080',
                API_LOG_LEVEL: 'debug',
                API_CACHE_ENABLED: 'true',
                API_COMPRESSION_LEVEL: '5',
                API_RATE_LIMIT_KEY_GENERATOR: 'user',
                API_SECURITY_X_FRAME_OPTIONS: 'DENY'
            });

            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();

            // Server Configuration
            expect(envModule.env.NODE_ENV).toBe('test');
            expect(envModule.env.API_PORT).toBe(8080);
            expect(envModule.env.API_HOST).toBe('localhost');

            // Logging Configuration
            expect(envModule.env.API_LOG_LEVEL).toBe('debug');
            expect(envModule.env.API_ENABLE_REQUEST_LOGGING).toBe(true);

            // Cache Configuration
            expect(envModule.env.API_CACHE_ENABLED).toBe(true);
            expect(envModule.env.API_CACHE_DEFAULT_MAX_AGE).toBe(300);
            expect(envModule.env.API_CACHE_DEFAULT_STALE_WHILE_REVALIDATE).toBe(60);
            expect(envModule.env.API_CACHE_DEFAULT_STALE_IF_ERROR).toBe(86400);

            // Compression Configuration
            expect(envModule.env.API_COMPRESSION_ENABLED).toBe(true);
            expect(envModule.env.API_COMPRESSION_LEVEL).toBe(5);
            expect(envModule.env.API_COMPRESSION_THRESHOLD).toBe(1024);
            expect(envModule.env.API_COMPRESSION_ALGORITHMS).toBe('gzip,deflate');

            // Rate Limiting Configuration
            expect(envModule.env.API_RATE_LIMIT_ENABLED).toBe(true); // Default value (middleware ignores in tests)
            expect(envModule.env.API_RATE_LIMIT_WINDOW_MS).toBe(900000);
            expect(envModule.env.API_RATE_LIMIT_MAX_REQUESTS).toBe(500);
            expect(envModule.env.API_RATE_LIMIT_KEY_GENERATOR).toBe('user');
            expect(envModule.env.API_RATE_LIMIT_SKIP).toBe('none');
            expect(envModule.env.API_RATE_LIMIT_HEADERS).toBe('standard');
            expect(envModule.env.API_RATE_LIMIT_MESSAGE).toBe(
                'Too many requests, please try again later.'
            );

            // Security Configuration
            expect(envModule.env.API_SECURITY_ENABLED).toBe(true);
            expect(envModule.env.API_SECURITY_HEADERS_ENABLED).toBe(true);
            expect(envModule.env.API_SECURITY_CONTENT_SECURITY_POLICY).toBe(
                "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-src 'none';"
            );
            expect(envModule.env.API_SECURITY_STRICT_TRANSPORT_SECURITY).toBe(
                'max-age=31536000; includeSubDomains'
            );
            expect(envModule.env.API_SECURITY_X_FRAME_OPTIONS).toBe('DENY');
            expect(envModule.env.API_SECURITY_REFERRER_POLICY).toBe(
                'strict-origin-when-cross-origin'
            );
            expect(envModule.env.API_SECURITY_PERMISSIONS_POLICY).toBe(
                'camera=(), microphone=(), geolocation=()'
            );

            // Response Formatting Configuration
            expect(envModule.env.API_RESPONSE_FORMAT_ENABLED).toBe(true);
            expect(envModule.env.API_RESPONSE_INCLUDE_TIMESTAMP).toBe(true);
            expect(envModule.env.API_RESPONSE_API_VERSION).toBe('1.0.0');
            expect(envModule.env.API_RESPONSE_INCLUDE_REQUEST_ID).toBe(true);
            expect(envModule.env.API_RESPONSE_INCLUDE_METADATA).toBe(true);
            expect(envModule.env.API_RESPONSE_SUCCESS_MESSAGE).toBe('Success');
            expect(envModule.env.API_RESPONSE_ERROR_MESSAGE).toBe('An error occurred');

            // Validation Configuration
            expect(envModule.env.API_VALIDATION_MAX_BODY_SIZE).toBe(10 * 1024 * 1024);
            expect(envModule.env.API_VALIDATION_MAX_REQUEST_TIME).toBe(30000);
            expect(envModule.env.API_VALIDATION_ALLOWED_CONTENT_TYPES).toBe(
                'application/json,multipart/form-data'
            );
            expect(envModule.env.API_VALIDATION_REQUIRED_HEADERS).toBe('user-agent');
            expect(envModule.env.API_VALIDATION_AUTH_ENABLED).toBe(true);
            expect(envModule.env.API_VALIDATION_AUTH_HEADERS).toBe('authorization');
            expect(envModule.env.API_VALIDATION_SANITIZE_ENABLED).toBe(true);
            expect(envModule.env.API_VALIDATION_SANITIZE_MAX_STRING_LENGTH).toBe(1000);
            expect(envModule.env.API_VALIDATION_SANITIZE_REMOVE_HTML_TAGS).toBe(true);
            expect(envModule.env.API_VALIDATION_SANITIZE_ALLOWED_CHARS).toBe(
                '[\\w\\sáéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛçÇãõÃÕ\\-.,!?@#$%&*()+=]'
            );

            // Internationalization Configuration - handled by client apps, not API
        });
    });

    describe('Environment Variable Validation', () => {
        it('should validate NODE_ENV enum values', async () => {
            const testCases = [
                { envValue: 'development', extra: {} },
                // production requires HOSPEDA_REDIS_URL and non-localhost origins
                {
                    envValue: 'production',
                    extra: {
                        HOSPEDA_REDIS_URL: 'redis://localhost:6379',
                        API_CORS_ORIGINS: 'https://hospeda.com.ar'
                    }
                },
                { envValue: 'test', extra: {} }
            ];

            for (const { envValue, extra } of testCases) {
                process.env = createValidTestEnv({ NODE_ENV: envValue, ...extra });
                const envModule = await import('../../src/utils/env');
                envModule.validateApiEnv();
                expect(envModule.env.NODE_ENV).toBe(envValue);
                vi.resetModules();
            }
        });

        it('should use default NODE_ENV when not provided', async () => {
            process.env = createValidTestEnv({ NODE_ENV: undefined });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.NODE_ENV).toBe('development');
        });

        it('should validate LOG_LEVEL enum values', async () => {
            const validLevels = ['debug', 'info', 'warn', 'error'];

            for (const level of validLevels) {
                process.env = createValidTestEnv({ API_LOG_LEVEL: level.toUpperCase() });
                const envModule = await import('../../src/utils/env');
                envModule.validateApiEnv();
                expect(envModule.env.API_LOG_LEVEL).toBe(level);
                vi.resetModules();
            }
        });

        it('should use default LOG_LEVEL when not provided', async () => {
            process.env = createValidTestEnv();
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.API_LOG_LEVEL).toBe('info');
        });

        it('should validate RATE_LIMIT_KEY_GENERATOR enum values', async () => {
            const validGenerators = ['ip', 'user', 'custom'];

            for (const generator of validGenerators) {
                process.env = createValidTestEnv({ API_RATE_LIMIT_KEY_GENERATOR: generator });
                const envModule = await import('../../src/utils/env');
                envModule.validateApiEnv();
                expect(envModule.env.API_RATE_LIMIT_KEY_GENERATOR).toBe(generator);
                vi.resetModules();
            }
        });

        it('should validate SECURITY_X_FRAME_OPTIONS enum values', async () => {
            const validOptions = ['DENY', 'SAMEORIGIN', 'ALLOW-FROM'];

            for (const option of validOptions) {
                process.env = createValidTestEnv({ API_SECURITY_X_FRAME_OPTIONS: option });
                const envModule = await import('../../src/utils/env');
                envModule.validateApiEnv();
                expect(envModule.env.API_SECURITY_X_FRAME_OPTIONS).toBe(option);
                vi.resetModules();
            }
        });

        it('should coerce string numbers to numbers', async () => {
            process.env = createValidTestEnv({
                API_PORT: '8080',
                API_CACHE_DEFAULT_MAX_AGE: '600',
                API_COMPRESSION_LEVEL: '9'
            });

            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();

            expect(envModule.env.API_PORT).toBe(8080);
            expect(envModule.env.API_CACHE_DEFAULT_MAX_AGE).toBe(600);
            expect(envModule.env.API_COMPRESSION_LEVEL).toBe(9);
        });

        it('should coerce string booleans to booleans', async () => {
            process.env = createValidTestEnv({
                API_LOG_SAVE: 'true',
                API_CACHE_ENABLED: 'true',
                API_RATE_LIMIT_ENABLED: 'true'
            });

            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();

            expect(envModule.env.API_LOG_SAVE).toBe(true);
            expect(envModule.env.API_CACHE_ENABLED).toBe(true);
            expect(envModule.env.API_RATE_LIMIT_ENABLED).toBe(true);
        });
    });

    describe('Required Environment Variables', () => {
        it('should require HOSPEDA_DATABASE_URL', async () => {
            process.env = createValidTestEnv({
                HOSPEDA_DATABASE_URL: 'postgresql://localhost:5432/test'
            });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_DATABASE_URL).toBe('postgresql://localhost:5432/test');
        });

        it('should require HOSPEDA_API_URL', async () => {
            process.env = createValidTestEnv({ HOSPEDA_API_URL: 'http://localhost:8080' });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_API_URL).toBe('http://localhost:8080');
        });

        it('should require Better Auth secret', async () => {
            process.env = createValidTestEnv({
                HOSPEDA_BETTER_AUTH_SECRET: 'my_custom_auth_secret_key_minimum_32!'
            });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_BETTER_AUTH_SECRET).toBe(
                'my_custom_auth_secret_key_minimum_32!'
            );
        });
    });

    describe('Validation Constraints', () => {
        it('should validate COMPRESSION_LEVEL range', async () => {
            process.env = createValidTestEnv({ API_COMPRESSION_LEVEL: '5' });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.API_COMPRESSION_LEVEL).toBe(5);
        });

        it('should validate positive numbers', async () => {
            process.env = createValidTestEnv({
                API_VALIDATION_MAX_BODY_SIZE: '1048576',
                API_VALIDATION_MAX_REQUEST_TIME: '5000'
            });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.API_VALIDATION_MAX_BODY_SIZE).toBe(1048576);
            expect(envModule.env.API_VALIDATION_MAX_REQUEST_TIME).toBe(5000);
        });
    });

    describe('HOSPEDA_MEDIA_MAX_FILE_SIZE_MB (SPEC-078-GAPS T-032 / GAP-078-106)', () => {
        it('defaults to 10 when not provided', async () => {
            // Arrange — minimal env without HOSPEDA_MEDIA_MAX_FILE_SIZE_MB
            process.env = createValidTestEnv();

            // Act
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();

            // Assert
            expect(envModule.env.HOSPEDA_MEDIA_MAX_FILE_SIZE_MB).toBe(10);
        });

        it('coerces a numeric string to a number', async () => {
            // Arrange
            process.env = createValidTestEnv({ HOSPEDA_MEDIA_MAX_FILE_SIZE_MB: '25' });

            // Act
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();

            // Assert
            expect(envModule.env.HOSPEDA_MEDIA_MAX_FILE_SIZE_MB).toBe(25);
        });

        it('fails startup on a non-numeric value', async () => {
            // Arrange
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
                throw new Error('Process exit');
            });
            process.env = createValidTestEnv({ HOSPEDA_MEDIA_MAX_FILE_SIZE_MB: 'abc' });

            // Act + Assert
            const { validateApiEnv } = await import('../../src/utils/env');
            expect(() => validateApiEnv()).toThrow('Process exit');
            expect(exitSpy).toHaveBeenCalledWith(1);

            consoleSpy.mockRestore();
            exitSpy.mockRestore();
        });

        it('rejects a non-positive value (zero / negative)', async () => {
            // Arrange
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
                throw new Error('Process exit');
            });
            process.env = createValidTestEnv({ HOSPEDA_MEDIA_MAX_FILE_SIZE_MB: '0' });

            // Act + Assert
            const { validateApiEnv } = await import('../../src/utils/env');
            expect(() => validateApiEnv()).toThrow('Process exit');
            expect(exitSpy).toHaveBeenCalledWith(1);

            consoleSpy.mockRestore();
            exitSpy.mockRestore();
        });
    });

    describe('Production Environment Requirements', () => {
        it('should require HOSPEDA_REDIS_URL in production', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
                throw new Error('Process exit');
            });

            process.env = createValidTestEnv({
                NODE_ENV: 'production',
                API_CORS_ORIGINS: 'https://hospeda.com.ar',
                API_SECURITY_CSRF_ORIGINS: 'https://hospeda.com.ar'
                // HOSPEDA_REDIS_URL intentionally missing
            });

            const { validateApiEnv } = await import('../../src/utils/env');
            expect(() => validateApiEnv()).toThrow('Process exit');

            expect(exitSpy).toHaveBeenCalledWith(1);

            consoleSpy.mockRestore();
            exitSpy.mockRestore();
        });

        it('should accept HOSPEDA_REDIS_URL in production when provided', async () => {
            process.env = createValidTestEnv({
                NODE_ENV: 'production',
                HOSPEDA_REDIS_URL: 'redis://localhost:6379',
                API_CORS_ORIGINS: 'https://hospeda.com.ar',
                API_SECURITY_CSRF_ORIGINS: 'https://hospeda.com.ar'
            });

            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_REDIS_URL).toBe('redis://localhost:6379');
        });

        it('should not require HOSPEDA_REDIS_URL in non-production environments', async () => {
            process.env = createValidTestEnv({
                NODE_ENV: 'test'
                // HOSPEDA_REDIS_URL intentionally missing
            });

            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_REDIS_URL).toBeUndefined();
        });
    });

    describe('String Transformations', () => {
        it('should transform LOG_LEVEL to lowercase', async () => {
            process.env = createValidTestEnv({ API_LOG_LEVEL: 'DEBUG' });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.API_LOG_LEVEL).toBe('debug');
        });

        it('should handle mixed case LOG_LEVEL', async () => {
            process.env = createValidTestEnv({ API_LOG_LEVEL: 'WARN' });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.API_LOG_LEVEL).toBe('warn');
        });
    });

    describe('Error Handling', () => {
        it('should exit process on validation error', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
                throw new Error('Process exit');
            });

            // Set invalid NODE_ENV but provide required variables
            process.env = createValidTestEnv({ NODE_ENV: 'invalid' });

            const { validateApiEnv } = await import('../../src/utils/env');

            expect(() => validateApiEnv()).toThrow('Process exit');

            expect(exitSpy).toHaveBeenCalledWith(1);

            consoleSpy.mockRestore();
            exitSpy.mockRestore();
        });
    });

    describe('Type Exports', () => {
        it('should export env object with correct type', async () => {
            process.env = createValidTestEnv();
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(typeof envModule.env).toBe('object');
            expect(envModule.env).toHaveProperty('NODE_ENV');
            expect(envModule.env).toHaveProperty('API_PORT');
            expect(envModule.env).toHaveProperty('API_LOG_LEVEL');
        });
    });

    describe('Optional HOSPEDA_* Variables', () => {
        it('should accept HOSPEDA_SITE_URL and HOSPEDA_ADMIN_URL', async () => {
            process.env = createValidTestEnv({
                HOSPEDA_SITE_URL: 'http://localhost:4321',
                HOSPEDA_ADMIN_URL: 'http://localhost:3000'
            });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_SITE_URL).toBe('http://localhost:4321');
            expect(envModule.env.HOSPEDA_ADMIN_URL).toBe('http://localhost:3000');
        });

        it('should accept HOSPEDA_BETTER_AUTH_URL', async () => {
            process.env = createValidTestEnv({
                HOSPEDA_BETTER_AUTH_URL: 'http://localhost:3001/api/auth'
            });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_BETTER_AUTH_URL).toBe('http://localhost:3001/api/auth');
        });

        it('should accept Sentry variables', async () => {
            process.env = createValidTestEnv({
                HOSPEDA_SENTRY_DSN: 'https://key@sentry.io/123',
                HOSPEDA_SENTRY_RELEASE: 'v1.0.0',
                HOSPEDA_SENTRY_PROJECT: 'hospeda-api'
            });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_SENTRY_DSN).toBe('https://key@sentry.io/123');
            expect(envModule.env.HOSPEDA_SENTRY_RELEASE).toBe('v1.0.0');
            expect(envModule.env.HOSPEDA_SENTRY_PROJECT).toBe('hospeda-api');
        });

        it('should accept HOSPEDA_EMAIL_API_KEY', async () => {
            process.env = createValidTestEnv({
                HOSPEDA_EMAIL_API_KEY: 're_test_key_123'
            });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_EMAIL_API_KEY).toBe('re_test_key_123');
        });

        it('should leave optional HOSPEDA_* vars undefined when not set', async () => {
            // HOSPEDA_SITE_URL and HOSPEDA_BETTER_AUTH_URL are now required (registry
            // marks them required: true). createValidTestEnv provides both.
            // Only truly optional vars are tested here.
            process.env = createValidTestEnv();
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_SITE_URL).toBe('http://localhost:4321');
            expect(envModule.env.HOSPEDA_BETTER_AUTH_URL).toBe('http://localhost:3001/api/auth');
            expect(envModule.env.HOSPEDA_ADMIN_URL).toBeUndefined();
            expect(envModule.env.HOSPEDA_SENTRY_DSN).toBeUndefined();
            expect(envModule.env.HOSPEDA_EMAIL_API_KEY).toBeUndefined();
        });
    });

    describe('CORS and CSRF Origins', () => {
        it('should use default CORS origins', async () => {
            process.env = createValidTestEnv();
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.API_CORS_ORIGINS).toBe(
                'http://localhost:3000,http://localhost:4321'
            );
        });

        it('should accept custom CORS origins', async () => {
            process.env = createValidTestEnv({
                API_CORS_ORIGINS: 'https://hospeda.com.ar,https://admin.hospeda.com.ar'
            });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.API_CORS_ORIGINS).toBe(
                'https://hospeda.com.ar,https://admin.hospeda.com.ar'
            );
        });

        it('should derive CSRF origins from CORS origins', async () => {
            process.env = createValidTestEnv({
                API_CORS_ORIGINS: 'https://hospeda.com.ar'
            });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            const { getSecurityConfig } = await import('../../src/utils/env-config-helpers');
            expect(getSecurityConfig().csrfOrigins).toEqual(['https://hospeda.com.ar']);
        });
    });

    describe('Database Pool Configuration', () => {
        it('should accept DB pool settings', async () => {
            process.env = createValidTestEnv({
                HOSPEDA_DB_POOL_MAX_CONNECTIONS: '20',
                HOSPEDA_DB_POOL_IDLE_TIMEOUT_MS: '60000',
                HOSPEDA_DB_POOL_CONNECTION_TIMEOUT_MS: '5000'
            });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_DB_POOL_MAX_CONNECTIONS).toBe(20);
            expect(envModule.env.HOSPEDA_DB_POOL_IDLE_TIMEOUT_MS).toBe(60000);
            expect(envModule.env.HOSPEDA_DB_POOL_CONNECTION_TIMEOUT_MS).toBe(5000);
        });

        it('should use defaults for DB pool when not set', async () => {
            process.env = createValidTestEnv();
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_DB_POOL_MAX_CONNECTIONS).toBe(10);
            expect(envModule.env.HOSPEDA_DB_POOL_IDLE_TIMEOUT_MS).toBe(30000);
            expect(envModule.env.HOSPEDA_DB_POOL_CONNECTION_TIMEOUT_MS).toBe(5000);
        });
    });

    describe('Metrics Configuration', () => {
        it('should accept API_METRICS_ENABLED override', async () => {
            process.env = createValidTestEnv({
                API_METRICS_ENABLED: 'true'
            });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.API_METRICS_ENABLED).toBe(true);
        });

        it('should default metrics to enabled', async () => {
            process.env = createValidTestEnv();
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.API_METRICS_ENABLED).toBe(true);
        });
    });

    describe('Platform-Injected Variables', () => {
        it('should accept CI flag', async () => {
            process.env = createValidTestEnv({ CI: 'true' });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.CI).toBe('true');
        });

        it('should leave platform vars undefined when not set', async () => {
            process.env = createValidTestEnv();
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.CI).toBeUndefined();
        });
    });

    describe('Production CORS Localhost Rejection', () => {
        it('should reject localhost in API_CORS_ORIGINS in production', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
                throw new Error('Process exit');
            });

            process.env = createValidTestEnv({
                NODE_ENV: 'production',
                HOSPEDA_REDIS_URL: 'redis://prod:6379',
                API_CORS_ORIGINS: 'http://localhost:3000',
                API_SECURITY_CSRF_ORIGINS: 'https://hospeda.com.ar'
            });

            const { validateApiEnv } = await import('../../src/utils/env');
            expect(() => validateApiEnv()).toThrow('Process exit');
            expect(exitSpy).toHaveBeenCalledWith(1);

            consoleSpy.mockRestore();
            exitSpy.mockRestore();
        });

        it('should accept valid production CORS and CSRF origins', async () => {
            process.env = createValidTestEnv({
                NODE_ENV: 'production',
                HOSPEDA_REDIS_URL: 'redis://prod:6379',
                API_CORS_ORIGINS: 'https://hospeda.com.ar',
                API_SECURITY_CSRF_ORIGINS: 'https://hospeda.com.ar'
            });

            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.API_CORS_ORIGINS).toBe('https://hospeda.com.ar');
        });
    });

    describe('Debug and Testing Variables', () => {
        it('should accept HOSPEDA_API_DEBUG_ERRORS', async () => {
            process.env = createValidTestEnv({
                HOSPEDA_API_DEBUG_ERRORS: 'true'
            });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_API_DEBUG_ERRORS).toBe(true);
        });

        it('should default HOSPEDA_API_DEBUG_ERRORS to false', async () => {
            process.env = createValidTestEnv();
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_API_DEBUG_ERRORS).toBe(false);
        });
    });

    describe('Logging Sub-Configuration', () => {
        it('should accept LOG sub-field overrides', async () => {
            process.env = createValidTestEnv({
                API_LOG_SAVE: 'true',
                API_LOG_EXPAND_OBJECTS: 'true',
                API_LOG_TRUNCATE_AT: '500',
                API_LOG_STRINGIFY: 'true'
            });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.API_LOG_SAVE).toBe(true);
            expect(envModule.env.API_LOG_EXPAND_OBJECTS).toBe(true);
            expect(envModule.env.API_LOG_TRUNCATE_AT).toBe(500);
            expect(envModule.env.API_LOG_STRINGIFY).toBe(true);
        });

        it('should use LOG sub-field defaults', async () => {
            process.env = createValidTestEnv();
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.API_LOG_INCLUDE_TIMESTAMPS).toBe(true);
            expect(envModule.env.API_LOG_INCLUDE_LEVEL).toBe(true);
            expect(envModule.env.API_LOG_USE_COLORS).toBe(true);
            expect(envModule.env.API_LOG_SAVE).toBe(false);
            expect(envModule.env.API_LOG_EXPAND_OBJECTS).toBe(false);
            expect(envModule.env.API_LOG_TRUNCATE_TEXT).toBe(true);
            expect(envModule.env.API_LOG_TRUNCATE_AT).toBe(1000);
            expect(envModule.env.API_LOG_STRINGIFY).toBe(false);
        });
    });

    describe('CSRF origins derive from CORS origins', () => {
        it('should derive CSRF origins from API_CORS_ORIGINS via getSecurityConfig', async () => {
            // Arrange
            process.env = createValidTestEnv({
                NODE_ENV: 'development',
                API_CORS_ORIGINS: 'http://localhost:3000,http://localhost:5173'
            });

            // Act
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            const { getSecurityConfig } = await import('../../src/utils/env-config-helpers');
            const security = getSecurityConfig();

            // Assert
            expect(security.csrfOrigins).toEqual([
                'http://localhost:3000',
                'http://localhost:5173'
            ]);
        });

        it('should reject localhost in API_CORS_ORIGINS in production (covers CSRF too)', async () => {
            // Arrange
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
                throw new Error('Process exit');
            });

            process.env = createValidTestEnv({
                NODE_ENV: 'production',
                HOSPEDA_REDIS_URL: 'redis://prod:6379',
                API_CORS_ORIGINS: 'http://localhost:3000'
            });

            // Act
            const { validateApiEnv } = await import('../../src/utils/env');

            // Assert
            expect(() => validateApiEnv()).toThrow('Process exit');
            expect(exitSpy).toHaveBeenCalledWith(1);

            consoleSpy.mockRestore();
            exitSpy.mockRestore();
        });
    });

    describe('OAuth Provider Cross-Validation', () => {
        it('should reject HOSPEDA_GOOGLE_CLIENT_ID without HOSPEDA_GOOGLE_CLIENT_SECRET', async () => {
            // Arrange
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
                throw new Error('Process exit');
            });

            process.env = createValidTestEnv({
                HOSPEDA_GOOGLE_CLIENT_ID: 'google-client-id-123',
                HOSPEDA_GOOGLE_CLIENT_SECRET: undefined
            });

            // Act
            const { validateApiEnv } = await import('../../src/utils/env');

            // Assert
            expect(() => validateApiEnv()).toThrow('Process exit');
            expect(exitSpy).toHaveBeenCalledWith(1);

            consoleSpy.mockRestore();
            exitSpy.mockRestore();
        });

        it('should accept HOSPEDA_GOOGLE_CLIENT_ID when HOSPEDA_GOOGLE_CLIENT_SECRET is provided', async () => {
            // Arrange
            process.env = createValidTestEnv({
                HOSPEDA_GOOGLE_CLIENT_ID: 'google-client-id-123',
                HOSPEDA_GOOGLE_CLIENT_SECRET: 'google-client-secret-456'
            });

            // Act
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();

            // Assert
            expect(envModule.env.HOSPEDA_GOOGLE_CLIENT_ID).toBe('google-client-id-123');
            expect(envModule.env.HOSPEDA_GOOGLE_CLIENT_SECRET).toBe('google-client-secret-456');
        });

        it('should reject HOSPEDA_FACEBOOK_CLIENT_ID without HOSPEDA_FACEBOOK_CLIENT_SECRET', async () => {
            // Arrange
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
                throw new Error('Process exit');
            });

            process.env = createValidTestEnv({
                HOSPEDA_FACEBOOK_CLIENT_ID: 'facebook-app-id-789',
                HOSPEDA_FACEBOOK_CLIENT_SECRET: undefined
            });

            // Act
            const { validateApiEnv } = await import('../../src/utils/env');

            // Assert
            expect(() => validateApiEnv()).toThrow('Process exit');
            expect(exitSpy).toHaveBeenCalledWith(1);

            consoleSpy.mockRestore();
            exitSpy.mockRestore();
        });

        it('should accept HOSPEDA_FACEBOOK_CLIENT_ID when HOSPEDA_FACEBOOK_CLIENT_SECRET is provided', async () => {
            // Arrange
            process.env = createValidTestEnv({
                HOSPEDA_FACEBOOK_CLIENT_ID: 'facebook-app-id-789',
                HOSPEDA_FACEBOOK_CLIENT_SECRET: 'facebook-app-secret-012'
            });

            // Act
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();

            // Assert
            expect(envModule.env.HOSPEDA_FACEBOOK_CLIENT_ID).toBe('facebook-app-id-789');
            expect(envModule.env.HOSPEDA_FACEBOOK_CLIENT_SECRET).toBe('facebook-app-secret-012');
        });

        it('should allow both Google and Facebook providers configured simultaneously', async () => {
            // Arrange
            process.env = createValidTestEnv({
                HOSPEDA_GOOGLE_CLIENT_ID: 'google-id',
                HOSPEDA_GOOGLE_CLIENT_SECRET: 'google-secret',
                HOSPEDA_FACEBOOK_CLIENT_ID: 'fb-id',
                HOSPEDA_FACEBOOK_CLIENT_SECRET: 'fb-secret'
            });

            // Act
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();

            // Assert
            expect(envModule.env.HOSPEDA_GOOGLE_CLIENT_ID).toBe('google-id');
            expect(envModule.env.HOSPEDA_FACEBOOK_CLIENT_ID).toBe('fb-id');
        });

        it('should allow omitting both OAuth providers entirely', async () => {
            // Arrange
            process.env = createValidTestEnv({
                HOSPEDA_GOOGLE_CLIENT_ID: undefined,
                HOSPEDA_GOOGLE_CLIENT_SECRET: undefined,
                HOSPEDA_FACEBOOK_CLIENT_ID: undefined,
                HOSPEDA_FACEBOOK_CLIENT_SECRET: undefined
            });

            // Act
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();

            // Assert
            expect(envModule.env.HOSPEDA_GOOGLE_CLIENT_ID).toBeUndefined();
            expect(envModule.env.HOSPEDA_GOOGLE_CLIENT_SECRET).toBeUndefined();
            expect(envModule.env.HOSPEDA_FACEBOOK_CLIENT_ID).toBeUndefined();
            expect(envModule.env.HOSPEDA_FACEBOOK_CLIENT_SECRET).toBeUndefined();
        });
    });

    // ---------------------------------------------------------------------------
    // SPEC-109 Phase 1 — HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR
    // ---------------------------------------------------------------------------

    describe('HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR', () => {
        it('defaults to "HOSPEDA" when not set', async () => {
            process.env = createValidTestEnv({
                HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: undefined
            });

            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();

            expect(envModule.env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR).toBe('HOSPEDA');
        });

        it('accepts a valid override (uppercase letters and spaces, ≤11 chars)', async () => {
            process.env = createValidTestEnv({
                HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA AR'
            });

            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();

            expect(envModule.env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR).toBe('HOSPEDA AR');
        });

        it('accepts digits within the descriptor', async () => {
            process.env = createValidTestEnv({
                HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA 24'
            });

            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();

            expect(envModule.env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR).toBe('HOSPEDA 24');
        });

        it('rejects lowercase characters', async () => {
            const { ApiEnvBaseSchema } = await import('../../src/utils/env');

            const result =
                ApiEnvBaseSchema.shape.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR.safeParse(
                    'hospeda'
                );

            expect(result.success).toBe(false);
        });

        it('rejects values longer than 11 characters', async () => {
            const { ApiEnvBaseSchema } = await import('../../src/utils/env');

            const result =
                ApiEnvBaseSchema.shape.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR.safeParse(
                    'HOSPEDAPLATFORM'
                );

            expect(result.success).toBe(false);
        });

        it('rejects non-ASCII characters', async () => {
            const { ApiEnvBaseSchema } = await import('../../src/utils/env');

            const result =
                ApiEnvBaseSchema.shape.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR.safeParse(
                    'HOSPEDÁ'
                );

            expect(result.success).toBe(false);
        });

        it('rejects empty string', async () => {
            const { ApiEnvBaseSchema } = await import('../../src/utils/env');

            const result =
                ApiEnvBaseSchema.shape.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR.safeParse('');

            expect(result.success).toBe(false);
        });

        it('accepts the boundary value of exactly 11 characters', async () => {
            const { ApiEnvBaseSchema } = await import('../../src/utils/env');

            const result =
                ApiEnvBaseSchema.shape.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR.safeParse(
                    'HOSPEDA1234' // 11 chars
                );

            expect(result.success).toBe(true);
        });
    });
});
