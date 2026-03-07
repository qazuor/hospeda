import { describe, expect, it } from 'vitest';
import type { EnvVarDefinition } from '../env-registry.js';
import { ENV_REGISTRY } from '../env-registry.js';

/**
 * Typed view of the registry using the widened `EnvVarDefinition` interface.
 * This gives us access to optional fields like `enumValues` without TypeScript
 * complaining that non-enum entries don't have that property.
 */
const REGISTRY: readonly EnvVarDefinition[] = ENV_REGISTRY;

/**
 * Total number of environment variable definitions across all categories.
 * Breakdown:
 *  - HOSPEDA_*    : 37 vars (server-side platform)
 *  - API_*        : 91 vars (Hono middleware configuration)
 *  - PUBLIC_*     :  4 vars (Astro web app, browser-exposed)
 *  - VITE_*       : 18 vars (TanStack admin, Vite-exposed)
 *  - Docker       :  5 vars (docker-compose services)
 *  - System       :  5 vars (runtime/CI/Vercel)
 */
const EXPECTED_VAR_COUNT = 170;

/** Valid type values for an EnvVarDefinition. */
const VALID_TYPES = ['string', 'url', 'number', 'boolean', 'enum'] as const;

/** All expected category identifiers represented in the registry. */
const EXPECTED_CATEGORIES = [
    'core',
    'database',
    'auth',
    'cache',
    'billing',
    'email',
    'cron',
    'integrations',
    'monitoring',
    'testing',
    'debugging',
    'build',
    'i18n',
    'api-config',
    'client-web',
    'client-admin',
    'docker',
    'system'
] as const;

describe('ENV_REGISTRY', () => {
    describe('count', () => {
        it(`should contain exactly ${EXPECTED_VAR_COUNT} variable definitions`, () => {
            // Arrange / Act
            const count = REGISTRY.length;

            // Assert
            expect(count).toBe(EXPECTED_VAR_COUNT);
        });
    });

    describe('uniqueness', () => {
        it('should not contain duplicate variable names', () => {
            // Arrange
            const names = REGISTRY.map((entry) => entry.name);

            // Act
            const uniqueNames = new Set(names);

            // Assert
            expect(uniqueNames.size).toBe(names.length);
        });
    });

    describe('descriptions', () => {
        it('should have a non-empty description for every entry', () => {
            for (const entry of REGISTRY) {
                expect(
                    entry.description.trim().length,
                    `${entry.name} has empty description`
                ).toBeGreaterThan(0);
            }
        });
    });

    describe('types', () => {
        it('should have a valid type for every entry', () => {
            for (const entry of REGISTRY) {
                expect(
                    VALID_TYPES.includes(entry.type as (typeof VALID_TYPES)[number]),
                    `${entry.name} has invalid type: ${entry.type}`
                ).toBe(true);
            }
        });

        it('should have non-empty enumValues for every entry with type "enum"', () => {
            const enumEntries = REGISTRY.filter((entry) => entry.type === 'enum');

            for (const entry of enumEntries) {
                expect(
                    entry.enumValues,
                    `${entry.name} has type "enum" but no enumValues`
                ).toBeDefined();

                expect(
                    (entry.enumValues as readonly string[]).length,
                    `${entry.name} has empty enumValues array`
                ).toBeGreaterThan(0);
            }
        });

        it('should not have enumValues on non-enum entries', () => {
            const nonEnumEntries = REGISTRY.filter((entry) => entry.type !== 'enum');

            for (const entry of nonEnumEntries) {
                expect(
                    entry.enumValues,
                    `${entry.name} has enumValues but type is not "enum"`
                ).toBeUndefined();
            }
        });
    });

    describe('apps', () => {
        it('should have at least one app listed for every entry', () => {
            for (const entry of REGISTRY) {
                expect(entry.apps.length, `${entry.name} has no apps listed`).toBeGreaterThan(0);
            }
        });

        it('should only reference valid app identifiers', () => {
            const validApps = new Set(['api', 'web', 'admin', 'docker', 'seed']);

            for (const entry of REGISTRY) {
                for (const app of entry.apps) {
                    expect(validApps.has(app), `${entry.name} references unknown app: ${app}`).toBe(
                        true
                    );
                }
            }
        });
    });

    describe('exampleValue', () => {
        it('should have a non-empty exampleValue for every entry', () => {
            for (const entry of REGISTRY) {
                expect(
                    entry.exampleValue.trim().length,
                    `${entry.name} has empty exampleValue`
                ).toBeGreaterThan(0);
            }
        });
    });

    describe('category', () => {
        it('should have a non-empty category for every entry', () => {
            for (const entry of REGISTRY) {
                expect(
                    entry.category.trim().length,
                    `${entry.name} has empty category`
                ).toBeGreaterThan(0);
            }
        });

        it('should represent all expected categories', () => {
            // Arrange
            const categoriesInRegistry = new Set(REGISTRY.map((entry) => entry.category));

            // Act / Assert
            for (const expected of EXPECTED_CATEGORIES) {
                expect(
                    categoriesInRegistry.has(expected),
                    `Category "${expected}" is not represented in the registry`
                ).toBe(true);
            }
        });
    });

    describe('secret flag', () => {
        it('should mark credential/token variables as secret', () => {
            const expectedSecrets = [
                'HOSPEDA_DATABASE_URL',
                'HOSPEDA_BETTER_AUTH_SECRET',
                'HOSPEDA_REDIS_URL',
                'HOSPEDA_GOOGLE_CLIENT_ID',
                'HOSPEDA_GOOGLE_CLIENT_SECRET',
                'HOSPEDA_FACEBOOK_CLIENT_ID',
                'HOSPEDA_FACEBOOK_CLIENT_SECRET',
                'HOSPEDA_LINEAR_API_KEY',
                'HOSPEDA_EXCHANGE_RATE_API_KEY',
                'HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN',
                'HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET',
                'HOSPEDA_RESEND_API_KEY',
                'HOSPEDA_CRON_SECRET',
                'HOSPEDA_SENTRY_DSN',
                'HOSPEDA_SEED_SUPER_ADMIN_PASSWORD',
                'POSTGRES_PASSWORD',
                'PUBLIC_SENTRY_DSN',
                'VITE_SENTRY_DSN'
            ];

            for (const name of expectedSecrets) {
                const entry = REGISTRY.find((e) => e.name === name);
                expect(entry, `${name} not found in registry`).toBeDefined();
                expect(entry?.secret, `${name} should be marked as secret`).toBe(true);
            }
        });

        it('should not mark non-sensitive variables as secret', () => {
            const expectedNonSecrets = [
                'HOSPEDA_API_URL',
                'HOSPEDA_SITE_URL',
                'HOSPEDA_BETTER_AUTH_URL',
                'HOSPEDA_CRON_ADAPTER',
                'HOSPEDA_DISABLE_AUTH',
                'HOSPEDA_RESEND_FROM_EMAIL',
                'HOSPEDA_RESEND_FROM_NAME',
                'HOSPEDA_COMMIT_SHA',
                'API_PORT',
                'API_CORS_ORIGINS',
                'PUBLIC_API_URL',
                'PUBLIC_SITE_URL',
                'VITE_API_URL',
                'VITE_BETTER_AUTH_URL',
                'POSTGRES_USER',
                'POSTGRES_DB',
                'NODE_ENV'
            ];

            for (const name of expectedNonSecrets) {
                const entry = REGISTRY.find((e) => e.name === name);
                expect(entry, `${name} not found in registry`).toBeDefined();
                expect(entry?.secret, `${name} should not be marked as secret`).toBe(false);
            }
        });
    });

    describe('required flag', () => {
        it('should mark core vars as required', () => {
            const expectedRequired = [
                'HOSPEDA_DATABASE_URL',
                'HOSPEDA_BETTER_AUTH_SECRET',
                'HOSPEDA_BETTER_AUTH_URL',
                'HOSPEDA_API_URL',
                'HOSPEDA_SITE_URL',
                'PUBLIC_API_URL',
                'PUBLIC_SITE_URL',
                'VITE_API_URL',
                'VITE_BETTER_AUTH_URL',
                'POSTGRES_USER',
                'POSTGRES_PASSWORD',
                'POSTGRES_DB'
            ];

            for (const name of expectedRequired) {
                const entry = REGISTRY.find((e) => e.name === name);
                expect(entry, `${name} not found in registry`).toBeDefined();
                expect(entry?.required, `${name} should be required`).toBe(true);
            }
        });
    });

    describe('HOSPEDA_CRON_ADAPTER enum', () => {
        it('should list manual, vercel, and node-cron as valid values', () => {
            const entry = REGISTRY.find((e) => e.name === 'HOSPEDA_CRON_ADAPTER');

            expect(entry).toBeDefined();
            expect(entry?.type).toBe('enum');
            expect(entry?.enumValues).toContain('manual');
            expect(entry?.enumValues).toContain('vercel');
            expect(entry?.enumValues).toContain('node-cron');
        });
    });

    describe('NODE_ENV enum', () => {
        it('should list development, production, and test as valid values', () => {
            const entry = REGISTRY.find((e) => e.name === 'NODE_ENV');

            expect(entry).toBeDefined();
            expect(entry?.type).toBe('enum');
            expect(entry?.enumValues).toContain('development');
            expect(entry?.enumValues).toContain('production');
            expect(entry?.enumValues).toContain('test');
        });
    });

    describe('API_LOG_LEVEL enum', () => {
        it('should list debug, info, warn, and error as valid values', () => {
            const entry = REGISTRY.find((e) => e.name === 'API_LOG_LEVEL');

            expect(entry).toBeDefined();
            expect(entry?.type).toBe('enum');
            expect(entry?.enumValues).toContain('debug');
            expect(entry?.enumValues).toContain('info');
            expect(entry?.enumValues).toContain('warn');
            expect(entry?.enumValues).toContain('error');
        });
    });

    describe('PUBLIC_* variables (client-web category)', () => {
        it('should include PUBLIC_API_URL for the web app', () => {
            const entry = REGISTRY.find((e) => e.name === 'PUBLIC_API_URL');
            expect(entry).toBeDefined();
            expect(entry?.apps).toContain('web');
            expect(entry?.category).toBe('client-web');
        });

        it('should include PUBLIC_SITE_URL for the web app', () => {
            const entry = REGISTRY.find((e) => e.name === 'PUBLIC_SITE_URL');
            expect(entry).toBeDefined();
            expect(entry?.apps).toContain('web');
            expect(entry?.category).toBe('client-web');
        });

        it('should include PUBLIC_SENTRY_DSN marked as secret', () => {
            const entry = REGISTRY.find((e) => e.name === 'PUBLIC_SENTRY_DSN');
            expect(entry).toBeDefined();
            expect(entry?.secret).toBe(true);
        });

        it('should include PUBLIC_SENTRY_RELEASE not marked as secret', () => {
            const entry = REGISTRY.find((e) => e.name === 'PUBLIC_SENTRY_RELEASE');
            expect(entry).toBeDefined();
            expect(entry?.secret).toBe(false);
        });
    });

    describe('VITE_* variables (client-admin category)', () => {
        it('should include VITE_API_URL for the admin app', () => {
            const entry = REGISTRY.find((e) => e.name === 'VITE_API_URL');
            expect(entry).toBeDefined();
            expect(entry?.apps).toContain('admin');
            expect(entry?.category).toBe('client-admin');
        });

        it('should include VITE_BETTER_AUTH_URL marked as required', () => {
            const entry = REGISTRY.find((e) => e.name === 'VITE_BETTER_AUTH_URL');
            expect(entry).toBeDefined();
            expect(entry?.required).toBe(true);
        });

        it('should include VITE_SENTRY_DSN marked as secret', () => {
            const entry = REGISTRY.find((e) => e.name === 'VITE_SENTRY_DSN');
            expect(entry).toBeDefined();
            expect(entry?.secret).toBe(true);
        });

        it('should contain all 18 VITE_* admin variables', () => {
            // Arrange
            const viteVars = REGISTRY.filter((e) => e.name.startsWith('VITE_'));

            // Assert
            expect(viteVars.length).toBe(18);
        });
    });

    describe('Docker variables', () => {
        it('should include POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB as required', () => {
            const requiredDockerVars = ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'];
            for (const name of requiredDockerVars) {
                const entry = REGISTRY.find((e) => e.name === name);
                expect(entry, `${name} not found in registry`).toBeDefined();
                expect(entry?.required, `${name} should be required`).toBe(true);
                expect(entry?.apps).toContain('docker');
                expect(entry?.category).toBe('docker');
            }
        });

        it('should include POSTGRES_PORT and REDIS_PORT as optional', () => {
            const optionalDockerVars = ['POSTGRES_PORT', 'REDIS_PORT'];
            for (const name of optionalDockerVars) {
                const entry = REGISTRY.find((e) => e.name === name);
                expect(entry, `${name} not found in registry`).toBeDefined();
                expect(entry?.required, `${name} should be optional`).toBe(false);
            }
        });

        it('should mark POSTGRES_PASSWORD as secret', () => {
            const entry = REGISTRY.find((e) => e.name === 'POSTGRES_PASSWORD');
            expect(entry?.secret).toBe(true);
        });
    });

    describe('System variables', () => {
        it('should include NODE_ENV available to api, web, and admin', () => {
            const entry = REGISTRY.find((e) => e.name === 'NODE_ENV');
            expect(entry).toBeDefined();
            expect(entry?.apps).toContain('api');
            expect(entry?.apps).toContain('web');
            expect(entry?.apps).toContain('admin');
            expect(entry?.category).toBe('system');
        });

        it('should include CI, VERCEL, and VERCEL_GIT_COMMIT_SHA', () => {
            const systemVarNames = ['CI', 'VERCEL', 'VERCEL_GIT_COMMIT_SHA'];
            for (const name of systemVarNames) {
                const entry = REGISTRY.find((e) => e.name === name);
                expect(entry, `${name} not found in registry`).toBeDefined();
                expect(entry?.category).toBe('system');
                expect(entry?.secret).toBe(false);
            }
        });
    });

    describe('var count per category', () => {
        it('should match expected distribution across categories', () => {
            // Arrange
            const countByCategory: Record<string, number> = {};
            for (const entry of REGISTRY) {
                countByCategory[entry.category] = (countByCategory[entry.category] ?? 0) + 1;
            }

            // Assert - snapshot of var counts per category
            expect(countByCategory).toMatchSnapshot();
        });
    });

    describe('prefix coverage', () => {
        it('should contain HOSPEDA_*, API_*, PUBLIC_*, VITE_* prefixes and unprefixed vars', () => {
            // Arrange
            const names = REGISTRY.map((e) => e.name);

            // Act / Assert — at least one entry per expected prefix group
            expect(names.some((n) => n.startsWith('HOSPEDA_'))).toBe(true);
            expect(names.some((n) => n.startsWith('API_'))).toBe(true);
            expect(names.some((n) => n.startsWith('PUBLIC_'))).toBe(true);
            expect(names.some((n) => n.startsWith('VITE_'))).toBe(true);
            // Unprefixed (Docker/System vars like NODE_ENV, POSTGRES_USER, etc.)
            expect(
                names.some(
                    (n) =>
                        !n.startsWith('HOSPEDA_') &&
                        !n.startsWith('API_') &&
                        !n.startsWith('PUBLIC_') &&
                        !n.startsWith('VITE_')
                )
            ).toBe(true);
        });
    });
});
