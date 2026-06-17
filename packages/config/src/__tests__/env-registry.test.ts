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
 *  - HOSPEDA_*    : 45 vars (server-side platform) [+1 HOSPEDA_MAX_COLLECTIONS_PER_USER]
 *  - API_*        : 78 vars (Hono middleware configuration)
 *  - PUBLIC_*     :  6 vars (Astro web app, browser-exposed)
 *  - VITE_*       : 23 vars (TanStack admin, Vite-exposed)
 *  - Docker       :  5 vars (docker-compose services)
 *  - System       :  runtime/CI variables
 */
/**
 * Updated 2026-06-03 to 200: net +2 vs the recorded 198. SPEC-184 T-003 adds
 * `API_LOG_FORMAT` (api-config 77→78). The other +1 reconciles a drift inherited
 * at branch-off: the registry already had 199 entries on staging while this
 * constant still read 198 (a prior var bump that never updated it). Bumping to
 * 200 fixes both.
 *
 * Updated 2026-05-26 to 198: net +1 vs the previous 197. The new var is a
 * SPEC-143 billing kill-switch (`HOSPEDA_ADDON_LIFECYCLE_ENABLED` /
 * `HOSPEDA_BILLING_POLLING_ENABLED`), bumping the billing category from 8 to 9.
 * Previous 197 (2026-05-18) was net +2 vs 195 (SPEC-140 PostHog), from the
 * Sentry staging-vs-prod environment separation:
 *  - `PUBLIC_SENTRY_ENVIRONMENT` in CLIENT_WEB_ENV_VARS
 *  - `VITE_SENTRY_ENVIRONMENT` in CLIENT_ADMIN_ENV_VARS
 * Previous value 195 (2026-05-17) covered SPEC-140 (PostHog Cloud), which also
 * removed a pre-existing duplicate of PUBLIC_ENABLE_LOGGING. Previous 189
 * (2026-05-15) covered SPEC-109. When adding or removing variables, bump this
 * constant in the same commit and regenerate the snapshot below (`vitest -u`).
 *
 * 200 (2026-06-03, SPEC-182): added VITE_ADMIN_URL (admin's own origin, used to
 * build the absolute callbackUrl for the web-auth redirect). Bumped from 198 to
 * 200 (not 199) because the registry had already drifted to 199 — a prior change
 * added a variable without updating this constant; this corrects it to the real
 * count in the same pass.
 *
 * 201 (2026-06-03, SPEC-182 T-018): added HOSPEDA_DEV_COOKIE_DOMAIN (dev-only
 * session-cookie domain override for the *.hospeda.local recipe).
 *
 * 202 (2026-06-03, merge): staging's SPEC-184 (`API_LOG_FORMAT`, 200) and this
 * branch's SPEC-182 (+2, 201) were added independently off the same 199 base;
 * the merged registry holds both sets.
 *
 * 203 (2026-06-05, SPEC-159 T-005): added HOSPEDA_VIEWS_HASH_SECRET (server-side
 * HMAC secret for the cookieless visitor hash used by entity view tracking).
 *
 * 204 (2026-06-04, SPEC-173 T-003/T-021): added HOSPEDA_AI_VAULT_MASTER_KEY
 * (AES-256-GCM master key for the AI credential vault).
 *
 * 206 (2026-06-05, SPEC-173 T-035): added HOSPEDA_POSTHOG_KEY and
 * HOSPEDA_POSTHOG_HOST for server-side AI event analytics.
 *
 * 210 (2026-06-07, SPEC-195 PR1): added 4 moderation env vars
 * (HOSPEDA_MODERATION_PROVIDER, HOSPEDA_MODERATION_OPENAI_API_KEY,
 * HOSPEDA_MODERATION_CACHE_TTL_SECONDS, HOSPEDA_MODERATION_TIMEOUT_MS).
 *
 * 211 (2026-06-09, SPEC-147 T-003): added HOSPEDA_USER_CANCEL_ENABLED
 * (opt-in feature flag for user self-service subscription cancellation,
 * billing category), bumping billing from 9 to 10.
 *
 * 212 (2026-06-09, SPEC-198): added HOSPEDA_AI_MODERATION_REQUIRED
 * (fail-loud startup gate for the AI moderation credential, moderation
 * category), bumping moderation from 4 to 5.
 *
 * 221 (2026-06-16, SPEC-222): added 9 accommodation-import env vars
 * (HOSPEDA_APIFY_TOKEN, HOSPEDA_APIFY_AIRBNB_ACTOR, HOSPEDA_APIFY_BOOKING_ACTOR,
 * HOSPEDA_GOOGLE_PLACES_API_KEY, HOSPEDA_MERCADOLIBRE_TOKEN,
 * HOSPEDA_IMPORT_FETCH_TIMEOUT_MS, HOSPEDA_IMPORT_FETCH_MAX_BYTES,
 * HOSPEDA_IMPORT_RATE_LIMIT_RPH, HOSPEDA_IMPORT_AI_MAX_CHARS).
 */
const EXPECTED_VAR_COUNT = 222;

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
    'newsletter',
    'cron',
    'integrations',
    'monitoring',
    'moderation',
    'testing',
    'debugging',
    'build',
    'i18n',
    'api-config',
    'client-web',
    'client-admin',
    'docker',
    'system',
    'ai'
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
            // NOTE: Sentry DSNs (HOSPEDA_SENTRY_DSN / PUBLIC_SENTRY_DSN /
            // VITE_SENTRY_DSN) are intentionally NOT in this list. Sentry DSNs
            // are write-only ingestion keys, intentionally public per Sentry
            // design (https://docs.sentry.io/concepts/key-terms/dsn-explainer/)
            // and the client variants are bundled into browser JS by design.
            // See env-registry test below for explicit non-secret assertions.
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
                'HOSPEDA_EMAIL_API_KEY',
                'HOSPEDA_SEED_SUPER_ADMIN_PASSWORD',
                'POSTGRES_PASSWORD',
                'HOSPEDA_AI_VAULT_MASTER_KEY'
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
                'HOSPEDA_EMAIL_FROM_EMAIL',
                'HOSPEDA_EMAIL_FROM_NAME',
                'HOSPEDA_COMMIT_SHA',
                'HOSPEDA_SENTRY_DSN',
                'HOSPEDA_SENTRY_ENVIRONMENT',
                'API_PORT',
                'API_CORS_ORIGINS',
                'PUBLIC_API_URL',
                'PUBLIC_SITE_URL',
                'PUBLIC_SENTRY_DSN',
                'VITE_API_URL',
                'VITE_BETTER_AUTH_URL',
                'VITE_SENTRY_DSN',
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
        it('should list only manual and node-cron as valid values', () => {
            const entry = REGISTRY.find((e) => e.name === 'HOSPEDA_CRON_ADAPTER');

            expect(entry).toBeDefined();
            expect(entry?.type).toBe('enum');
            expect(entry?.enumValues).toEqual(['manual', 'node-cron']);
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

    describe('API_LOG_FORMAT enum', () => {
        it('should list pretty and json as valid values with a pretty default', () => {
            const entry = REGISTRY.find((e) => e.name === 'API_LOG_FORMAT');

            expect(entry).toBeDefined();
            expect(entry?.type).toBe('enum');
            expect(entry?.enumValues).toContain('pretty');
            expect(entry?.enumValues).toContain('json');
            expect(entry?.defaultValue).toBe('pretty');
            expect(entry?.apps).toContain('api');
            expect(entry?.category).toBe('api-config');
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

        it('should include PUBLIC_SENTRY_DSN NOT marked as secret', () => {
            // Sentry DSNs are intentionally public by design — they ship in
            // the browser bundle and are write-only ingestion keys. See
            // https://docs.sentry.io/concepts/key-terms/dsn-explainer/.
            const entry = REGISTRY.find((e) => e.name === 'PUBLIC_SENTRY_DSN');
            expect(entry).toBeDefined();
            expect(entry?.secret).toBe(false);
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

        it('should include VITE_SENTRY_DSN NOT marked as secret', () => {
            // Sentry DSNs are intentionally public by design — they ship in
            // the admin browser bundle and are write-only ingestion keys.
            const entry = REGISTRY.find((e) => e.name === 'VITE_SENTRY_DSN');
            expect(entry).toBeDefined();
            expect(entry?.secret).toBe(false);
        });

        it('should contain all 27 VITE_* admin variables', () => {
            // Arrange
            const viteVars = REGISTRY.filter((e) => e.name.startsWith('VITE_'));

            // Assert
            expect(viteVars.length).toBe(27);
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

        it('should include CI as a system var', () => {
            const entry = REGISTRY.find((e) => e.name === 'CI');
            expect(entry, 'CI not found in registry').toBeDefined();
            expect(entry?.category).toBe('system');
            expect(entry?.secret).toBe(false);
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

    describe('HOSPEDA_AI_VAULT_MASTER_KEY (SPEC-173 T-003)', () => {
        it('should be registered, secret, optional, category ai, apps includes api', () => {
            const entry = REGISTRY.find((e) => e.name === 'HOSPEDA_AI_VAULT_MASTER_KEY');

            expect(entry, 'HOSPEDA_AI_VAULT_MASTER_KEY not found in registry').toBeDefined();
            expect(entry?.secret, 'should be marked as secret').toBe(true);
            expect(entry?.required, 'should be optional (not required)').toBe(false);
            expect(entry?.category, 'should belong to the ai category').toBe('ai');
            expect(entry?.apps, 'should list api as a consumer').toContain('api');
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
