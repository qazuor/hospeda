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

// Helper to create minimal valid environment
const createValidTestEnv = (overrides: Record<string, string | undefined> = {}) => ({
    NODE_ENV: 'test' as string | undefined,
    HOSPEDA_API_URL: 'http://localhost:3001',
    HOSPEDA_DATABASE_URL: 'postgresql://localhost:5432/hospeda_test',
    HOSPEDA_CLERK_SECRET_KEY: 'sk_test_Y2xlcmstdGVzdC1zZWNyZXQta2V5',
    HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_Y2xlcmstdGVzdC1wdWJsaXNoYWJsZS1rZXk',
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
            expect(envModule.env.API_CACHE_PUBLIC_ENDPOINTS).toBe(
                '/api/v1/public/accommodations,/health'
            );
            expect(envModule.env.API_CACHE_PRIVATE_ENDPOINTS).toBe('/api/v1/public/users');
            expect(envModule.env.API_CACHE_NO_CACHE_ENDPOINTS).toBe('/health/db,/docs');

            // Compression Configuration
            expect(envModule.env.API_COMPRESSION_ENABLED).toBe(true);
            expect(envModule.env.API_COMPRESSION_LEVEL).toBe(5);
            expect(envModule.env.API_COMPRESSION_THRESHOLD).toBe(1024);
            expect(envModule.env.API_COMPRESSION_CHUNK_SIZE).toBe(16384);
            expect(envModule.env.API_COMPRESSION_FILTER).toBe(
                'text/*,application/json,application/xml,application/javascript'
            );
            expect(envModule.env.API_COMPRESSION_EXCLUDE_ENDPOINTS).toBe('/health/db,/docs');
            expect(envModule.env.API_COMPRESSION_ALGORITHMS).toBe('gzip,deflate');

            // Rate Limiting Configuration
            expect(envModule.env.API_RATE_LIMIT_ENABLED).toBe(true); // Default value (middleware ignores in tests)
            expect(envModule.env.API_RATE_LIMIT_WINDOW_MS).toBe(900000);
            expect(envModule.env.API_RATE_LIMIT_MAX_REQUESTS).toBe(100);
            expect(envModule.env.API_RATE_LIMIT_KEY_GENERATOR).toBe('user');
            expect(envModule.env.API_RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS).toBe(false);
            expect(envModule.env.API_RATE_LIMIT_SKIP_FAILED_REQUESTS).toBe(false);
            expect(envModule.env.API_RATE_LIMIT_STANDARD_HEADERS).toBe(true);
            expect(envModule.env.API_RATE_LIMIT_LEGACY_HEADERS).toBe(false);
            expect(envModule.env.API_RATE_LIMIT_MESSAGE).toBe(
                'Too many requests, please try again later.'
            );

            // Security Configuration
            expect(envModule.env.API_SECURITY_ENABLED).toBe(true);
            expect(envModule.env.API_SECURITY_HEADERS_ENABLED).toBe(true);
            expect(envModule.env.API_SECURITY_CONTENT_SECURITY_POLICY).toBe(
                "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
            );
            expect(envModule.env.API_SECURITY_STRICT_TRANSPORT_SECURITY).toBe(
                'max-age=31536000; includeSubDomains'
            );
            expect(envModule.env.API_SECURITY_X_FRAME_OPTIONS).toBe('DENY');
            expect(envModule.env.API_SECURITY_X_CONTENT_TYPE_OPTIONS).toBe('nosniff');
            expect(envModule.env.API_SECURITY_X_XSS_PROTECTION).toBe('1; mode=block');
            expect(envModule.env.API_SECURITY_REFERRER_POLICY).toBe(
                'strict-origin-when-cross-origin'
            );
            expect(envModule.env.API_SECURITY_PERMISSIONS_POLICY).toBe(
                'camera=(), microphone=(), geolocation=()'
            );

            // Response Formatting Configuration
            expect(envModule.env.API_RESPONSE_FORMAT_ENABLED).toBe(true);
            expect(envModule.env.API_RESPONSE_INCLUDE_TIMESTAMP).toBe(true);
            expect(envModule.env.API_RESPONSE_INCLUDE_VERSION).toBe(true);
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
            expect(envModule.env.API_VALIDATION_CLERK_AUTH_ENABLED).toBe(true);
            expect(envModule.env.API_VALIDATION_CLERK_AUTH_HEADERS).toBe('authorization');
            expect(envModule.env.API_VALIDATION_SANITIZE_ENABLED).toBe(true);
            expect(envModule.env.API_VALIDATION_SANITIZE_MAX_STRING_LENGTH).toBe(1000);
            expect(envModule.env.API_VALIDATION_SANITIZE_REMOVE_HTML_TAGS).toBe(true);
            expect(envModule.env.API_VALIDATION_SANITIZE_ALLOWED_CHARS).toBe(
                '[\\w\\s\\-.,!?@#$%&*()+=]'
            );

            // Internationalization Configuration - handled by client apps, not API
        });
    });

    describe('Environment Variable Validation', () => {
        it('should validate NODE_ENV enum values', async () => {
            const validEnvs = ['development', 'production', 'test'];

            for (const envValue of validEnvs) {
                process.env = createValidTestEnv({ NODE_ENV: envValue });
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
                API_RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: 'true'
            });

            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();

            expect(envModule.env.API_LOG_SAVE).toBe(true);
            expect(envModule.env.API_CACHE_ENABLED).toBe(true);
            expect(envModule.env.API_RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS).toBe(true);
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

        it('should require CLERK keys', async () => {
            process.env = createValidTestEnv({
                HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_key',
                HOSPEDA_CLERK_SECRET_KEY: 'sk_test_key'
            });
            const envModule = await import('../../src/utils/env');
            envModule.validateApiEnv();
            expect(envModule.env.HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY).toBe('pk_test_key');
            expect(envModule.env.HOSPEDA_CLERK_SECRET_KEY).toBe('sk_test_key');
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
});
