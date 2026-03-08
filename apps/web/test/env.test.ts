/**
 * @file Tests for Web environment variable validation.
 * @module apps/web/test/env.test
 *
 * Tests serverEnvSchema, clientEnvSchema, and validateWebEnv().
 */

import { describe, expect, it } from 'vitest';
import { clientEnvSchema, serverEnvSchema, validateWebEnv } from '../src/env';

/**
 * Creates a valid server env object with all required fields.
 */
function createValidServerEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        HOSPEDA_API_URL: 'http://localhost:3001',
        PUBLIC_API_URL: 'http://localhost:3001',
        HOSPEDA_SITE_URL: 'http://localhost:4321',
        PUBLIC_SITE_URL: 'http://localhost:4321',
        NODE_ENV: 'development',
        ...overrides
    };
}

/**
 * Creates a valid client env object with all required fields.
 */
function createValidClientEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        PUBLIC_API_URL: 'http://localhost:3001',
        PUBLIC_SITE_URL: 'http://localhost:4321',
        ...overrides
    };
}

describe('serverEnvSchema', () => {
    describe('valid configurations', () => {
        it('should parse with all URLs provided', () => {
            const result = serverEnvSchema.safeParse(createValidServerEnv());
            expect(result.success).toBe(true);
        });

        it('should parse with only HOSPEDA_* URLs (no PUBLIC_*)', () => {
            const result = serverEnvSchema.safeParse(
                createValidServerEnv({
                    PUBLIC_API_URL: undefined,
                    PUBLIC_SITE_URL: undefined
                })
            );
            expect(result.success).toBe(true);
        });

        it('should parse with only PUBLIC_* URLs (no HOSPEDA_*)', () => {
            const result = serverEnvSchema.safeParse(
                createValidServerEnv({
                    HOSPEDA_API_URL: undefined,
                    HOSPEDA_SITE_URL: undefined
                })
            );
            expect(result.success).toBe(true);
        });

        it('should default NODE_ENV to "development"', () => {
            const result = serverEnvSchema.parse(createValidServerEnv({ NODE_ENV: undefined }));
            expect(result.NODE_ENV).toBe('development');
        });
    });

    describe('refine rules - API URL required', () => {
        it('should reject when neither HOSPEDA_API_URL nor PUBLIC_API_URL is set', () => {
            const result = serverEnvSchema.safeParse(
                createValidServerEnv({
                    HOSPEDA_API_URL: undefined,
                    PUBLIC_API_URL: undefined
                })
            );
            expect(result.success).toBe(false);
            if (!result.success) {
                const apiError = result.error.issues.find((i) => i.path.includes('API_URL'));
                expect(apiError).toBeDefined();
                expect(apiError?.message).toContain('HOSPEDA_API_URL or PUBLIC_API_URL');
            }
        });
    });

    describe('refine rules - Site URL required', () => {
        it('should reject when neither HOSPEDA_SITE_URL nor PUBLIC_SITE_URL is set', () => {
            const result = serverEnvSchema.safeParse(
                createValidServerEnv({
                    HOSPEDA_SITE_URL: undefined,
                    PUBLIC_SITE_URL: undefined
                })
            );
            expect(result.success).toBe(false);
            if (!result.success) {
                const siteError = result.error.issues.find((i) => i.path.includes('SITE_URL'));
                expect(siteError).toBeDefined();
                expect(siteError?.message).toContain('HOSPEDA_SITE_URL or PUBLIC_SITE_URL');
            }
        });
    });

    describe('URL validation', () => {
        it('should reject invalid HOSPEDA_API_URL', () => {
            const result = serverEnvSchema.safeParse(
                createValidServerEnv({ HOSPEDA_API_URL: 'not-a-url' })
            );
            expect(result.success).toBe(false);
        });

        it('should reject invalid HOSPEDA_SITE_URL', () => {
            const result = serverEnvSchema.safeParse(
                createValidServerEnv({ HOSPEDA_SITE_URL: 'not-a-url' })
            );
            expect(result.success).toBe(false);
        });

        it('should reject invalid PUBLIC_API_URL', () => {
            const result = serverEnvSchema.safeParse(
                createValidServerEnv({ PUBLIC_API_URL: 'not-a-url' })
            );
            expect(result.success).toBe(false);
        });

        it('should reject invalid PUBLIC_SITE_URL', () => {
            const result = serverEnvSchema.safeParse(
                createValidServerEnv({ PUBLIC_SITE_URL: 'not-a-url' })
            );
            expect(result.success).toBe(false);
        });
    });

    describe('optional fields', () => {
        it('should accept HOSPEDA_BETTER_AUTH_URL', () => {
            const result = serverEnvSchema.parse(
                createValidServerEnv({
                    HOSPEDA_BETTER_AUTH_URL: 'http://localhost:3001/api/auth'
                })
            );
            expect(result.HOSPEDA_BETTER_AUTH_URL).toBe('http://localhost:3001/api/auth');
        });

        it('should accept PUBLIC_SENTRY_DSN', () => {
            const result = serverEnvSchema.parse(
                createValidServerEnv({
                    PUBLIC_SENTRY_DSN: 'https://key@sentry.io/123'
                })
            );
            expect(result.PUBLIC_SENTRY_DSN).toBe('https://key@sentry.io/123');
        });

        it('should accept PUBLIC_SENTRY_RELEASE', () => {
            const result = serverEnvSchema.parse(
                createValidServerEnv({ PUBLIC_SENTRY_RELEASE: 'v1.0.0' })
            );
            expect(result.PUBLIC_SENTRY_RELEASE).toBe('v1.0.0');
        });

        it('should accept PUBLIC_VERSION', () => {
            const result = serverEnvSchema.parse(createValidServerEnv({ PUBLIC_VERSION: '2.0.0' }));
            expect(result.PUBLIC_VERSION).toBe('2.0.0');
        });

        it('should leave optional fields undefined when not provided', () => {
            const result = serverEnvSchema.parse(createValidServerEnv());
            expect(result.HOSPEDA_BETTER_AUTH_URL).toBeUndefined();
            expect(result.PUBLIC_SENTRY_DSN).toBeUndefined();
            expect(result.PUBLIC_SENTRY_RELEASE).toBeUndefined();
            expect(result.PUBLIC_VERSION).toBeUndefined();
        });
    });

    describe('NODE_ENV validation', () => {
        it('should accept "development"', () => {
            const result = serverEnvSchema.safeParse(
                createValidServerEnv({ NODE_ENV: 'development' })
            );
            expect(result.success).toBe(true);
        });

        it('should accept "production"', () => {
            const result = serverEnvSchema.safeParse(
                createValidServerEnv({ NODE_ENV: 'production' })
            );
            expect(result.success).toBe(true);
        });

        it('should accept "test"', () => {
            const result = serverEnvSchema.safeParse(createValidServerEnv({ NODE_ENV: 'test' }));
            expect(result.success).toBe(true);
        });

        it('should reject invalid NODE_ENV', () => {
            const result = serverEnvSchema.safeParse(createValidServerEnv({ NODE_ENV: 'staging' }));
            expect(result.success).toBe(false);
        });
    });
});

describe('clientEnvSchema', () => {
    describe('required fields', () => {
        it('should parse valid client env', () => {
            const result = clientEnvSchema.safeParse(createValidClientEnv());
            expect(result.success).toBe(true);
        });

        it('should reject missing PUBLIC_API_URL', () => {
            const result = clientEnvSchema.safeParse(
                createValidClientEnv({ PUBLIC_API_URL: undefined })
            );
            expect(result.success).toBe(false);
        });

        it('should reject missing PUBLIC_SITE_URL', () => {
            const result = clientEnvSchema.safeParse(
                createValidClientEnv({ PUBLIC_SITE_URL: undefined })
            );
            expect(result.success).toBe(false);
        });

        it('should reject invalid PUBLIC_API_URL', () => {
            const result = clientEnvSchema.safeParse(
                createValidClientEnv({ PUBLIC_API_URL: 'not-a-url' })
            );
            expect(result.success).toBe(false);
        });

        it('should reject invalid PUBLIC_SITE_URL', () => {
            const result = clientEnvSchema.safeParse(
                createValidClientEnv({ PUBLIC_SITE_URL: 'not-a-url' })
            );
            expect(result.success).toBe(false);
        });
    });

    describe('optional fields', () => {
        it('should accept PUBLIC_SENTRY_DSN', () => {
            const result = clientEnvSchema.parse(
                createValidClientEnv({
                    PUBLIC_SENTRY_DSN: 'https://key@sentry.io/123'
                })
            );
            expect(result.PUBLIC_SENTRY_DSN).toBe('https://key@sentry.io/123');
        });

        it('should accept PUBLIC_SENTRY_RELEASE', () => {
            const result = clientEnvSchema.parse(
                createValidClientEnv({ PUBLIC_SENTRY_RELEASE: 'v1.0.0' })
            );
            expect(result.PUBLIC_SENTRY_RELEASE).toBe('v1.0.0');
        });

        it('should accept PUBLIC_VERSION', () => {
            const result = clientEnvSchema.parse(createValidClientEnv({ PUBLIC_VERSION: '2.0.0' }));
            expect(result.PUBLIC_VERSION).toBe('2.0.0');
        });

        it('should leave optional fields undefined when not provided', () => {
            const result = clientEnvSchema.parse(createValidClientEnv());
            expect(result.PUBLIC_SENTRY_DSN).toBeUndefined();
            expect(result.PUBLIC_SENTRY_RELEASE).toBeUndefined();
            expect(result.PUBLIC_VERSION).toBeUndefined();
        });
    });
});

describe('validateWebEnv', () => {
    it('should return validated env when process.env is valid', () => {
        const originalEnv = process.env;
        process.env = {
            ...originalEnv,
            HOSPEDA_API_URL: 'http://localhost:3001',
            HOSPEDA_SITE_URL: 'http://localhost:4321',
            PUBLIC_API_URL: 'http://localhost:3001',
            PUBLIC_SITE_URL: 'http://localhost:4321',
            NODE_ENV: 'test'
        };

        try {
            const result = validateWebEnv();
            expect(result.HOSPEDA_API_URL).toBe('http://localhost:3001');
            expect(result.NODE_ENV).toBe('test');
        } finally {
            process.env = originalEnv;
        }
    });

    it('should throw when required vars are missing', () => {
        const originalEnv = process.env;
        process.env = { NODE_ENV: 'test' };

        try {
            expect(() => validateWebEnv()).toThrow('Invalid web app environment configuration');
        } finally {
            process.env = originalEnv;
        }
    });

    it('should include field paths in error message', () => {
        const originalEnv = process.env;
        process.env = { NODE_ENV: 'test' };

        try {
            expect(() => validateWebEnv()).toThrow('API_URL');
        } finally {
            process.env = originalEnv;
        }
    });
});
