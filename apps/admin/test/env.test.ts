/**
 * @file Tests for Admin environment variable validation.
 * @module apps/admin/test/env.test
 *
 * Tests AdminEnvSchema parsing, transforms, defaults, and helper functions.
 */

import { describe, expect, it, vi } from 'vitest';

// Mock the logger before importing env.ts (it imports @/utils/logger)
vi.mock('@/utils/logger', () => ({
    adminLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

import { AdminEnvSchema } from '../src/env';

/**
 * Creates a valid env object with all required fields and sensible defaults.
 */
function createValidEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        VITE_API_URL: 'http://localhost:3001',
        VITE_BETTER_AUTH_URL: 'http://localhost:3001/api/auth',
        NODE_ENV: 'development',
        ...overrides
    };
}

describe('AdminEnvSchema', () => {
    describe('required fields', () => {
        it('should parse valid minimal env', () => {
            const result = AdminEnvSchema.safeParse(createValidEnv());
            expect(result.success).toBe(true);
        });

        it('should reject missing VITE_API_URL', () => {
            const result = AdminEnvSchema.safeParse(createValidEnv({ VITE_API_URL: undefined }));
            expect(result.success).toBe(false);
        });

        it('should reject invalid VITE_API_URL (not a URL)', () => {
            const result = AdminEnvSchema.safeParse(createValidEnv({ VITE_API_URL: 'not-a-url' }));
            expect(result.success).toBe(false);
        });

        it('should reject missing VITE_BETTER_AUTH_URL', () => {
            const result = AdminEnvSchema.safeParse(
                createValidEnv({ VITE_BETTER_AUTH_URL: undefined })
            );
            expect(result.success).toBe(false);
        });

        it('should reject empty VITE_BETTER_AUTH_URL', () => {
            const result = AdminEnvSchema.safeParse(createValidEnv({ VITE_BETTER_AUTH_URL: '' }));
            expect(result.success).toBe(false);
        });
    });

    describe('optional fields', () => {
        it('should accept VITE_SITE_URL when provided', () => {
            const result = AdminEnvSchema.safeParse(
                createValidEnv({ VITE_SITE_URL: 'http://localhost:4321' })
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.VITE_SITE_URL).toBe('http://localhost:4321');
            }
        });

        it('should accept HOSPEDA_API_URL when provided', () => {
            const result = AdminEnvSchema.safeParse(
                createValidEnv({ HOSPEDA_API_URL: 'http://localhost:3001' })
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.HOSPEDA_API_URL).toBe('http://localhost:3001');
            }
        });

        it('should accept VITE_SENTRY_DSN when provided', () => {
            const result = AdminEnvSchema.safeParse(
                createValidEnv({ VITE_SENTRY_DSN: 'https://key@sentry.io/123' })
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.VITE_SENTRY_DSN).toBe('https://key@sentry.io/123');
            }
        });

        it('should accept VITE_SENTRY_RELEASE when provided', () => {
            const result = AdminEnvSchema.safeParse(
                createValidEnv({ VITE_SENTRY_RELEASE: 'v1.2.3' })
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.VITE_SENTRY_RELEASE).toBe('v1.2.3');
            }
        });

        it('should accept VITE_DEBUG_ACTOR_ID when provided', () => {
            const result = AdminEnvSchema.safeParse(
                createValidEnv({ VITE_DEBUG_ACTOR_ID: 'user-123' })
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.VITE_DEBUG_ACTOR_ID).toBe('user-123');
            }
        });
    });

    describe('default values', () => {
        it('should default VITE_APP_NAME to "Hospeda Admin"', () => {
            const result = AdminEnvSchema.parse(createValidEnv());
            expect(result.VITE_APP_NAME).toBe('Hospeda Admin');
        });

        it('should default VITE_APP_VERSION to "1.0.0"', () => {
            const result = AdminEnvSchema.parse(createValidEnv());
            expect(result.VITE_APP_VERSION).toBe('1.0.0');
        });

        it('should default VITE_APP_DESCRIPTION', () => {
            const result = AdminEnvSchema.parse(createValidEnv());
            expect(result.VITE_APP_DESCRIPTION).toBe('Admin panel for Hospeda platform');
        });

        it('should default NODE_ENV to "development"', () => {
            const result = AdminEnvSchema.parse(createValidEnv({ NODE_ENV: undefined }));
            expect(result.NODE_ENV).toBe('development');
        });

        it('should default VITE_SUPPORTED_LOCALES to "es,en"', () => {
            const result = AdminEnvSchema.parse(createValidEnv());
            expect(result.VITE_SUPPORTED_LOCALES).toBe('es,en');
        });

        it('should default VITE_DEFAULT_LOCALE to "es"', () => {
            const result = AdminEnvSchema.parse(createValidEnv());
            expect(result.VITE_DEFAULT_LOCALE).toBe('es');
        });

        it('should allow overriding defaults', () => {
            const result = AdminEnvSchema.parse(
                createValidEnv({
                    VITE_APP_NAME: 'Custom Admin',
                    VITE_APP_VERSION: '2.0.0',
                    VITE_SUPPORTED_LOCALES: 'es,en,pt',
                    VITE_DEFAULT_LOCALE: 'en'
                })
            );
            expect(result.VITE_APP_NAME).toBe('Custom Admin');
            expect(result.VITE_APP_VERSION).toBe('2.0.0');
            expect(result.VITE_SUPPORTED_LOCALES).toBe('es,en,pt');
            expect(result.VITE_DEFAULT_LOCALE).toBe('en');
        });
    });

    describe('boolean transforms', () => {
        it('should transform VITE_ENABLE_DEVTOOLS "true" to true', () => {
            const result = AdminEnvSchema.parse(createValidEnv({ VITE_ENABLE_DEVTOOLS: 'true' }));
            expect(result.VITE_ENABLE_DEVTOOLS).toBe(true);
        });

        it('should transform VITE_ENABLE_DEVTOOLS "false" to false', () => {
            const result = AdminEnvSchema.parse(createValidEnv({ VITE_ENABLE_DEVTOOLS: 'false' }));
            expect(result.VITE_ENABLE_DEVTOOLS).toBe(false);
        });

        it('should default VITE_ENABLE_DEVTOOLS to false', () => {
            const result = AdminEnvSchema.parse(createValidEnv());
            expect(result.VITE_ENABLE_DEVTOOLS).toBe(false);
        });

        it('should transform VITE_ENABLE_QUERY_DEVTOOLS correctly', () => {
            const result = AdminEnvSchema.parse(
                createValidEnv({ VITE_ENABLE_QUERY_DEVTOOLS: 'true' })
            );
            expect(result.VITE_ENABLE_QUERY_DEVTOOLS).toBe(true);
        });

        it('should transform VITE_ENABLE_ROUTER_DEVTOOLS correctly', () => {
            const result = AdminEnvSchema.parse(
                createValidEnv({ VITE_ENABLE_ROUTER_DEVTOOLS: 'true' })
            );
            expect(result.VITE_ENABLE_ROUTER_DEVTOOLS).toBe(true);
        });

        it('should default all devtools flags to false', () => {
            const result = AdminEnvSchema.parse(createValidEnv());
            expect(result.VITE_ENABLE_DEVTOOLS).toBe(false);
            expect(result.VITE_ENABLE_QUERY_DEVTOOLS).toBe(false);
            expect(result.VITE_ENABLE_ROUTER_DEVTOOLS).toBe(false);
        });

        it('should coerce VITE_DEBUG_LAZY_SECTIONS to boolean', () => {
            const result = AdminEnvSchema.parse(
                createValidEnv({ VITE_DEBUG_LAZY_SECTIONS: 'true' })
            );
            expect(result.VITE_DEBUG_LAZY_SECTIONS).toBe(true);
        });

        it('should default VITE_DEBUG_LAZY_SECTIONS to false', () => {
            const result = AdminEnvSchema.parse(createValidEnv());
            expect(result.VITE_DEBUG_LAZY_SECTIONS).toBe(false);
        });

        it('should coerce VITE_ENABLE_LOGGING to boolean', () => {
            const result = AdminEnvSchema.parse(createValidEnv({ VITE_ENABLE_LOGGING: 'true' }));
            expect(result.VITE_ENABLE_LOGGING).toBe(true);
        });

        it('should default VITE_ENABLE_LOGGING to false', () => {
            const result = AdminEnvSchema.parse(createValidEnv());
            expect(result.VITE_ENABLE_LOGGING).toBe(false);
        });
    });

    describe('numeric transforms', () => {
        it('should default VITE_DEFAULT_PAGE_SIZE to 25', () => {
            const result = AdminEnvSchema.parse(createValidEnv());
            expect(result.VITE_DEFAULT_PAGE_SIZE).toBe(25);
        });

        it('should default VITE_MAX_PAGE_SIZE to 100', () => {
            const result = AdminEnvSchema.parse(createValidEnv());
            expect(result.VITE_MAX_PAGE_SIZE).toBe(100);
        });

        it('should parse custom VITE_DEFAULT_PAGE_SIZE', () => {
            const result = AdminEnvSchema.parse(createValidEnv({ VITE_DEFAULT_PAGE_SIZE: '50' }));
            expect(result.VITE_DEFAULT_PAGE_SIZE).toBe(50);
        });

        it('should parse custom VITE_MAX_PAGE_SIZE', () => {
            const result = AdminEnvSchema.parse(createValidEnv({ VITE_MAX_PAGE_SIZE: '200' }));
            expect(result.VITE_MAX_PAGE_SIZE).toBe(200);
        });
    });

    describe('NODE_ENV validation', () => {
        it('should accept "development"', () => {
            const result = AdminEnvSchema.safeParse(createValidEnv({ NODE_ENV: 'development' }));
            expect(result.success).toBe(true);
        });

        it('should accept "production"', () => {
            const result = AdminEnvSchema.safeParse(createValidEnv({ NODE_ENV: 'production' }));
            expect(result.success).toBe(true);
        });

        it('should accept "test"', () => {
            const result = AdminEnvSchema.safeParse(createValidEnv({ NODE_ENV: 'test' }));
            expect(result.success).toBe(true);
        });

        it('should reject invalid NODE_ENV', () => {
            const result = AdminEnvSchema.safeParse(createValidEnv({ NODE_ENV: 'staging' }));
            expect(result.success).toBe(false);
        });
    });

    describe('Vite platform flags', () => {
        it('should accept DEV boolean', () => {
            const result = AdminEnvSchema.safeParse(createValidEnv({ DEV: true }));
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.DEV).toBe(true);
            }
        });

        it('should accept PROD boolean', () => {
            const result = AdminEnvSchema.safeParse(createValidEnv({ PROD: true }));
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.PROD).toBe(true);
            }
        });

        it('should default DEV and PROD to undefined', () => {
            const result = AdminEnvSchema.parse(createValidEnv());
            expect(result.DEV).toBeUndefined();
            expect(result.PROD).toBeUndefined();
        });
    });

    describe('full configuration', () => {
        it('should parse a fully populated env', () => {
            const result = AdminEnvSchema.safeParse({
                VITE_API_URL: 'https://api.hospeda.com.ar',
                VITE_SITE_URL: 'https://hospeda.com.ar',
                HOSPEDA_API_URL: 'https://api.hospeda.com.ar',
                VITE_BETTER_AUTH_URL: 'https://api.hospeda.com.ar/api/auth',
                VITE_APP_NAME: 'Hospeda Admin',
                VITE_APP_VERSION: '2.1.0',
                VITE_APP_DESCRIPTION: 'Admin panel for Hospeda',
                VITE_ENABLE_DEVTOOLS: 'false',
                VITE_ENABLE_QUERY_DEVTOOLS: 'false',
                VITE_ENABLE_ROUTER_DEVTOOLS: 'false',
                VITE_DEFAULT_PAGE_SIZE: '25',
                VITE_MAX_PAGE_SIZE: '100',
                VITE_SENTRY_DSN: 'https://abc@sentry.io/1',
                VITE_SENTRY_RELEASE: 'v2.1.0',
                VITE_SENTRY_PROJECT: 'hospeda-admin',
                VITE_SUPPORTED_LOCALES: 'es,en,pt',
                VITE_DEFAULT_LOCALE: 'es',
                VITE_DEBUG_LAZY_SECTIONS: 'false',
                VITE_DEBUG_ACTOR_ID: 'debug-user',
                VITE_ENABLE_LOGGING: 'true',
                NODE_ENV: 'production',
                DEV: false,
                PROD: true
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.VITE_ENABLE_LOGGING).toBe(true);
                expect(result.data.VITE_DEFAULT_PAGE_SIZE).toBe(25);
                expect(result.data.PROD).toBe(true);
            }
        });
    });
});
