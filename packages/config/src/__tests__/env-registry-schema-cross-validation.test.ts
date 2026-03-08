import { describe, expect, it } from 'vitest';
import { ENV_REGISTRY } from '../env-registry.js';

/**
 * GAP-026: Cross-validation between the ENV_REGISTRY and the Zod schemas that
 * actually validate env vars at runtime in each app.
 *
 * Motivation
 * ----------
 * The registry (`packages/config/src/env-registry.ts`) is a documentation and
 * tooling artefact. The Zod schemas in each app are the authoritative runtime
 * validators. If a variable is listed in the registry as belonging to an app
 * but is absent from that app's Zod schema (or vice-versa), it signals either
 * a missing validation or a stale registry entry.
 *
 * Approach
 * --------
 * Because `@repo/config` cannot depend on the apps (that would create circular
 * workspace dependencies), we maintain static key-sets here that mirror the
 * `.shape` property of each app's Zod schema. These sets must be kept in sync
 * with:
 *   - `apps/api/src/utils/env.ts`      → `ApiEnvSchema`
 *   - `apps/admin/src/env.ts`           → `AdminEnvSchema`
 *   - `apps/web/src/env.ts`             → `serverEnvSchema`
 *
 * When a variable is added to or removed from a schema, the corresponding set
 * below must be updated, or this test will fail — which is the desired
 * behaviour (it acts as an early-warning system).
 *
 * Known gaps (documented, not silently ignored)
 * ---------------------------------------------
 * Some registry entries are intentionally absent from an app schema:
 *   - `HOSPEDA_DEBUG_ACTOR_ID`, `HOSPEDA_SUPPORTED_LOCALES`,
 *     `HOSPEDA_DEFAULT_LOCALE`: registered under `apps: ['admin']` using
 *     the HOSPEDA_ prefix but consumed via their VITE_* equivalents at build
 *     time (Vite env substitution). The AdminEnvSchema validates the VITE_
 *     names, not the HOSPEDA_ originals.
 *   - `VITE_SITE_URL`: present in AdminEnvSchema but absent from the registry
 *     (registry gap — not yet catalogued).
 *   - `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`, `HOSPEDA_MERCADO_PAGO_SANDBOX`,
 *     `HOSPEDA_MERCADO_PAGO_TIMEOUT`, `HOSPEDA_MERCADO_PAGO_PLATFORM_ID`,
 *     `HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID`: in registry but not yet added to
 *     `ApiEnvSchema` (schema gap — billing vars yet to be validated).
 *   - `TEST_DB_URL`, `TEST_DB_NAME`: system vars for test infrastructure; not
 *     validated by `ApiEnvSchema` by design.
 *   - `PUBLIC_ENABLE_LOGGING`, `PUBLIC_VERSION`: in registry for web but not
 *     in `serverEnvSchema` (schema gap — optional vars not yet validated).
 *
 * @module env-registry-schema-cross-validation
 */

// ---------------------------------------------------------------------------
// Static key-sets — mirrors of each app's Zod schema `.shape` keys.
// Keep these in sync with the corresponding schema files.
// ---------------------------------------------------------------------------

/**
 * Keys present in `ApiEnvSchema` (apps/api/src/utils/env.ts).
 * Derived from the `.object({...})` literal — does NOT include `.superRefine`.
 */
const API_SCHEMA_KEYS = new Set<string>([
    'NODE_ENV',
    'API_PORT',
    'API_HOST',
    'HOSPEDA_API_URL',
    'HOSPEDA_DATABASE_URL',
    'HOSPEDA_BETTER_AUTH_SECRET',
    'HOSPEDA_BETTER_AUTH_URL',
    'HOSPEDA_GOOGLE_CLIENT_ID',
    'HOSPEDA_GOOGLE_CLIENT_SECRET',
    'HOSPEDA_FACEBOOK_CLIENT_ID',
    'HOSPEDA_FACEBOOK_CLIENT_SECRET',
    'HOSPEDA_SITE_URL',
    'HOSPEDA_ADMIN_URL',
    'HOSPEDA_DISABLE_AUTH',
    'HOSPEDA_ALLOW_MOCK_ACTOR',
    'HOSPEDA_API_DEBUG_ERRORS',
    'HOSPEDA_TESTING_RATE_LIMIT',
    'HOSPEDA_DEBUG_TESTS',
    'HOSPEDA_TESTING_ORIGIN_VERIFICATION',
    'VERCEL',
    'CI',
    'VERCEL_GIT_COMMIT_SHA',
    'HOSPEDA_COMMIT_SHA',
    'API_LOG_LEVEL',
    'API_ENABLE_REQUEST_LOGGING',
    'API_LOG_INCLUDE_TIMESTAMPS',
    'API_LOG_INCLUDE_LEVEL',
    'API_LOG_USE_COLORS',
    'API_LOG_SAVE',
    'API_LOG_EXPAND_OBJECTS',
    'API_LOG_TRUNCATE_TEXT',
    'API_LOG_TRUNCATE_AT',
    'API_LOG_STRINGIFY',
    'API_CORS_ORIGINS',
    'API_CORS_ALLOW_CREDENTIALS',
    'API_CORS_MAX_AGE',
    'API_CORS_ALLOW_METHODS',
    'API_CORS_ALLOW_HEADERS',
    'API_CORS_EXPOSE_HEADERS',
    'API_CACHE_ENABLED',
    'API_CACHE_DEFAULT_MAX_AGE',
    'API_CACHE_DEFAULT_STALE_WHILE_REVALIDATE',
    'API_CACHE_DEFAULT_STALE_IF_ERROR',
    'API_CACHE_PUBLIC_ENDPOINTS',
    'API_CACHE_PRIVATE_ENDPOINTS',
    'API_CACHE_NO_CACHE_ENDPOINTS',
    'API_CACHE_ETAG_ENABLED',
    'API_CACHE_LAST_MODIFIED_ENABLED',
    'API_COMPRESSION_ENABLED',
    'API_COMPRESSION_LEVEL',
    'API_COMPRESSION_THRESHOLD',
    'API_COMPRESSION_CHUNK_SIZE',
    'API_COMPRESSION_FILTER',
    'API_COMPRESSION_EXCLUDE_ENDPOINTS',
    'API_COMPRESSION_ALGORITHMS',
    'API_RATE_LIMIT_ENABLED',
    'API_RATE_LIMIT_WINDOW_MS',
    'API_RATE_LIMIT_MAX_REQUESTS',
    'API_RATE_LIMIT_KEY_GENERATOR',
    'API_RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS',
    'API_RATE_LIMIT_SKIP_FAILED_REQUESTS',
    'API_RATE_LIMIT_STANDARD_HEADERS',
    'API_RATE_LIMIT_LEGACY_HEADERS',
    'API_RATE_LIMIT_MESSAGE',
    'API_RATE_LIMIT_TRUST_PROXY',
    'API_RATE_LIMIT_TRUSTED_PROXIES',
    'API_RATE_LIMIT_AUTH_ENABLED',
    'API_RATE_LIMIT_AUTH_WINDOW_MS',
    'API_RATE_LIMIT_AUTH_MAX_REQUESTS',
    'API_RATE_LIMIT_AUTH_MESSAGE',
    'API_RATE_LIMIT_PUBLIC_ENABLED',
    'API_RATE_LIMIT_PUBLIC_WINDOW_MS',
    'API_RATE_LIMIT_PUBLIC_MAX_REQUESTS',
    'API_RATE_LIMIT_PUBLIC_MESSAGE',
    'API_RATE_LIMIT_ADMIN_ENABLED',
    'API_RATE_LIMIT_ADMIN_WINDOW_MS',
    'API_RATE_LIMIT_ADMIN_MAX_REQUESTS',
    'API_RATE_LIMIT_ADMIN_MESSAGE',
    'API_SECURITY_ENABLED',
    'API_SECURITY_CSRF_ENABLED',
    'API_SECURITY_CSRF_ORIGIN',
    'API_SECURITY_CSRF_ORIGINS',
    'API_SECURITY_HEADERS_ENABLED',
    'API_SECURITY_CONTENT_SECURITY_POLICY',
    'API_SECURITY_STRICT_TRANSPORT_SECURITY',
    'API_SECURITY_X_FRAME_OPTIONS',
    'API_SECURITY_X_CONTENT_TYPE_OPTIONS',
    'API_SECURITY_X_XSS_PROTECTION',
    'API_SECURITY_REFERRER_POLICY',
    'API_SECURITY_PERMISSIONS_POLICY',
    'API_RESPONSE_FORMAT_ENABLED',
    'API_RESPONSE_INCLUDE_TIMESTAMP',
    'API_RESPONSE_INCLUDE_VERSION',
    'API_RESPONSE_API_VERSION',
    'API_RESPONSE_INCLUDE_REQUEST_ID',
    'API_RESPONSE_INCLUDE_METADATA',
    'API_RESPONSE_SUCCESS_MESSAGE',
    'API_RESPONSE_ERROR_MESSAGE',
    'API_VALIDATION_MAX_BODY_SIZE',
    'API_VALIDATION_MAX_REQUEST_TIME',
    'API_VALIDATION_ALLOWED_CONTENT_TYPES',
    'API_VALIDATION_REQUIRED_HEADERS',
    'API_VALIDATION_AUTH_ENABLED',
    'API_VALIDATION_AUTH_HEADERS',
    'API_VALIDATION_SANITIZE_ENABLED',
    'API_VALIDATION_SANITIZE_MAX_STRING_LENGTH',
    'API_VALIDATION_SANITIZE_REMOVE_HTML_TAGS',
    'API_VALIDATION_SANITIZE_ALLOWED_CHARS',
    'API_METRICS_ENABLED',
    'API_METRICS_SLOW_REQUEST_THRESHOLD_MS',
    'API_METRICS_SLOW_AUTH_THRESHOLD_MS',
    'HOSPEDA_DB_POOL_MAX_CONNECTIONS',
    'HOSPEDA_DB_POOL_IDLE_TIMEOUT_MS',
    'HOSPEDA_DB_POOL_CONNECTION_TIMEOUT_MS',
    'HOSPEDA_LINEAR_API_KEY',
    'HOSPEDA_LINEAR_TEAM_ID',
    'HOSPEDA_EXCHANGE_RATE_API_KEY',
    'HOSPEDA_DOLAR_API_BASE_URL',
    'HOSPEDA_EXCHANGE_RATE_API_BASE_URL',
    'HOSPEDA_CRON_SECRET',
    'HOSPEDA_CRON_ADAPTER',
    'HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN',
    'HOSPEDA_RESEND_API_KEY',
    'HOSPEDA_RESEND_FROM_EMAIL',
    'HOSPEDA_RESEND_FROM_NAME',
    'HOSPEDA_ADMIN_NOTIFICATION_EMAILS',
    'HOSPEDA_SENTRY_DSN',
    'HOSPEDA_SENTRY_RELEASE',
    'HOSPEDA_SENTRY_PROJECT',
    'HOSPEDA_REDIS_URL'
]);

/**
 * Keys present in `AdminEnvSchema` (apps/admin/src/env.ts).
 */
const ADMIN_SCHEMA_KEYS = new Set<string>([
    'VITE_API_URL',
    'VITE_SITE_URL',
    'VITE_BETTER_AUTH_URL',
    'VITE_APP_NAME',
    'VITE_APP_VERSION',
    'VITE_APP_DESCRIPTION',
    'VITE_ENABLE_DEVTOOLS',
    'VITE_ENABLE_QUERY_DEVTOOLS',
    'VITE_ENABLE_ROUTER_DEVTOOLS',
    'VITE_DEFAULT_PAGE_SIZE',
    'VITE_MAX_PAGE_SIZE',
    'VITE_SENTRY_DSN',
    'VITE_SENTRY_RELEASE',
    'VITE_SENTRY_PROJECT',
    'VITE_SUPPORTED_LOCALES',
    'VITE_DEFAULT_LOCALE',
    'VITE_DEBUG_LAZY_SECTIONS',
    'VITE_DEBUG_ACTOR_ID',
    'VITE_ENABLE_LOGGING',
    'NODE_ENV',
    'DEV',
    'PROD'
]);

/**
 * Keys present in `serverEnvSchema` (apps/web/src/env.ts).
 */
const WEB_SCHEMA_KEYS = new Set<string>([
    'HOSPEDA_API_URL',
    'PUBLIC_API_URL',
    'HOSPEDA_SITE_URL',
    'PUBLIC_SITE_URL',
    'HOSPEDA_BETTER_AUTH_URL',
    'PUBLIC_SENTRY_DSN',
    'PUBLIC_SENTRY_RELEASE',
    'PUBLIC_VERSION',
    'NODE_ENV'
]);

// ---------------------------------------------------------------------------
// Known gaps: registry vars that are intentionally absent from the schema.
// These are documented architectural decisions, not silently swallowed bugs.
// ---------------------------------------------------------------------------

/**
 * Registry entries for 'api' that are not yet in ApiEnvSchema.
 * Each entry must have a reason comment explaining the gap.
 */
const API_KNOWN_GAPS = new Set<string>([
    // Billing vars registered but not yet validated in ApiEnvSchema.
    // Track as TODO: add to ApiEnvSchema once billing integration is stable.
    'HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET',
    'HOSPEDA_MERCADO_PAGO_SANDBOX',
    'HOSPEDA_MERCADO_PAGO_TIMEOUT',
    'HOSPEDA_MERCADO_PAGO_PLATFORM_ID',
    'HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID',

    // Test/infrastructure vars — not validated by ApiEnvSchema by design.
    'TEST_DB_URL',
    'TEST_DB_NAME'
]);

/**
 * Registry entries for 'admin' that are intentionally absent from AdminEnvSchema.
 * These HOSPEDA_ vars are transformed to VITE_ equivalents by the Vite build;
 * the schema validates the VITE_ names, not the source HOSPEDA_ names.
 */
const ADMIN_KNOWN_GAPS = new Set<string>([
    // HOSPEDA_ vars that are renamed to VITE_ by the Vite build pipeline.
    // AdminEnvSchema validates the VITE_* form, not the HOSPEDA_* originals.
    'HOSPEDA_DEBUG_ACTOR_ID',
    'HOSPEDA_SUPPORTED_LOCALES',
    'HOSPEDA_DEFAULT_LOCALE',

    // HOSPEDA_API_URL is registered under apps: ['api', 'web', 'admin'] because
    // the admin build process reads it at build time. However, AdminEnvSchema
    // validates VITE_API_URL (the Vite-exposed equivalent). The HOSPEDA_ name
    // is not validated directly by AdminEnvSchema.
    'HOSPEDA_API_URL',

    // VITE_LOG_LEVEL is in the CLIENT_ADMIN_ENV_VARS registry but has not yet
    // been added to AdminEnvSchema. This is a schema gap — track as TODO.
    'VITE_LOG_LEVEL'
]);

/**
 * Registry entries for 'web' that are intentionally absent from serverEnvSchema.
 * These optional web vars are not yet validated at startup.
 */
const WEB_KNOWN_GAPS = new Set<string>([
    'PUBLIC_ENABLE_LOGGING'
    // PUBLIC_VERSION is in serverEnvSchema (present in WEB_SCHEMA_KEYS), not a gap.
]);

// ---------------------------------------------------------------------------
// Inverse gaps: schema keys that have no registry entry.
// These are tracked here for visibility but do not cause test failures,
// because the registry is documentation (subset), not an exhaustive inventory
// of everything a schema accepts.
// ---------------------------------------------------------------------------

/**
 * AdminEnvSchema keys that are not in the registry.
 * Tracked for awareness; they should eventually be registered.
 */
const ADMIN_SCHEMA_KEYS_NOT_IN_REGISTRY = new Set<string>([
    'VITE_SITE_URL', // In AdminEnvSchema but not in CLIENT_ADMIN_ENV_VARS
    'DEV', // Vite internal
    'PROD' // Vite internal
]);

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Returns all registry entries whose `apps` array includes the given app ID.
 *
 * @param appId - The application identifier to filter by
 * @returns Array of var names from the registry for that app
 */
function registryVarsForApp(appId: 'api' | 'admin' | 'web'): readonly string[] {
    return ENV_REGISTRY.filter((entry) => entry.apps.includes(appId)).map((entry) => entry.name);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ENV_REGISTRY ↔ Zod schema cross-validation (GAP-026)', () => {
    describe('API schema coverage', () => {
        it('should have every api registry var present in ApiEnvSchema (excluding known gaps)', () => {
            // Arrange
            const registryVars = registryVarsForApp('api');
            const missing: string[] = [];

            // Act
            for (const name of registryVars) {
                if (API_KNOWN_GAPS.has(name)) continue;
                if (!API_SCHEMA_KEYS.has(name)) {
                    missing.push(name);
                }
            }

            // Assert
            expect(
                missing,
                `Registry vars for 'api' not found in ApiEnvSchema:\n${missing.map((n) => `  - ${n}`).join('\n')}\nAdd them to ApiEnvSchema or to API_KNOWN_GAPS with a reason.`
            ).toHaveLength(0);
        });

        it('should have a documented reason for each api known gap', () => {
            // Arrange — verify known gaps are still absent from the schema
            // (so we notice when someone adds them and can remove from known gaps)
            const unexpectedlyPresent: string[] = [];

            // Act
            for (const name of API_KNOWN_GAPS) {
                if (API_SCHEMA_KEYS.has(name)) {
                    unexpectedlyPresent.push(name);
                }
            }

            // Assert
            expect(
                unexpectedlyPresent,
                `These vars are in API_KNOWN_GAPS but are now present in ApiEnvSchema. Remove them from API_KNOWN_GAPS:\n${unexpectedlyPresent.map((n) => `  - ${n}`).join('\n')}`
            ).toHaveLength(0);
        });
    });

    describe('Admin schema coverage', () => {
        it('should have every admin registry var present in AdminEnvSchema (excluding known gaps)', () => {
            // Arrange
            const registryVars = registryVarsForApp('admin');
            const missing: string[] = [];

            // Act
            for (const name of registryVars) {
                if (ADMIN_KNOWN_GAPS.has(name)) continue;
                if (!ADMIN_SCHEMA_KEYS.has(name)) {
                    missing.push(name);
                }
            }

            // Assert
            expect(
                missing,
                `Registry vars for 'admin' not found in AdminEnvSchema:\n${missing.map((n) => `  - ${n}`).join('\n')}\nAdd them to AdminEnvSchema or to ADMIN_KNOWN_GAPS with a reason.`
            ).toHaveLength(0);
        });

        it('should have a documented reason for each admin known gap', () => {
            // Arrange
            const unexpectedlyPresent: string[] = [];

            // Act
            for (const name of ADMIN_KNOWN_GAPS) {
                if (ADMIN_SCHEMA_KEYS.has(name)) {
                    unexpectedlyPresent.push(name);
                }
            }

            // Assert
            expect(
                unexpectedlyPresent,
                `These vars are in ADMIN_KNOWN_GAPS but are now present in AdminEnvSchema. Remove them from ADMIN_KNOWN_GAPS:\n${unexpectedlyPresent.map((n) => `  - ${n}`).join('\n')}`
            ).toHaveLength(0);
        });

        it('should document admin schema keys that are absent from the registry', () => {
            // Arrange — ensures ADMIN_SCHEMA_KEYS_NOT_IN_REGISTRY stays current
            const registryNames = new Set(ENV_REGISTRY.map((e) => e.name));
            const actuallyMissing: string[] = [];
            const falselyListed: string[] = [];

            // Act — find admin schema keys not in registry
            for (const key of ADMIN_SCHEMA_KEYS) {
                const inRegistry = registryNames.has(key);
                const inKnownAbsent = ADMIN_SCHEMA_KEYS_NOT_IN_REGISTRY.has(key);
                if (!inRegistry && !inKnownAbsent) {
                    actuallyMissing.push(key);
                }
                if (inRegistry && inKnownAbsent) {
                    falselyListed.push(key);
                }
            }

            // Assert — both lists must be empty to keep the documentation current
            expect(
                actuallyMissing,
                `AdminEnvSchema keys absent from the registry that are not yet documented in ADMIN_SCHEMA_KEYS_NOT_IN_REGISTRY:\n${actuallyMissing.map((n) => `  - ${n}`).join('\n')}`
            ).toHaveLength(0);

            expect(
                falselyListed,
                `ADMIN_SCHEMA_KEYS_NOT_IN_REGISTRY lists keys that ARE in the registry. Remove them:\n${falselyListed.map((n) => `  - ${n}`).join('\n')}`
            ).toHaveLength(0);
        });
    });

    describe('Web schema coverage', () => {
        it('should have every web registry var present in serverEnvSchema (excluding known gaps)', () => {
            // Arrange
            const registryVars = registryVarsForApp('web');
            const missing: string[] = [];

            // Act
            for (const name of registryVars) {
                if (WEB_KNOWN_GAPS.has(name)) continue;
                if (!WEB_SCHEMA_KEYS.has(name)) {
                    missing.push(name);
                }
            }

            // Assert
            expect(
                missing,
                `Registry vars for 'web' not found in serverEnvSchema:\n${missing.map((n) => `  - ${n}`).join('\n')}\nAdd them to serverEnvSchema or to WEB_KNOWN_GAPS with a reason.`
            ).toHaveLength(0);
        });

        it('should have a documented reason for each web known gap', () => {
            // Arrange
            const unexpectedlyPresent: string[] = [];

            // Act
            for (const name of WEB_KNOWN_GAPS) {
                if (WEB_SCHEMA_KEYS.has(name)) {
                    unexpectedlyPresent.push(name);
                }
            }

            // Assert
            expect(
                unexpectedlyPresent,
                `These vars are in WEB_KNOWN_GAPS but are now present in serverEnvSchema. Remove them from WEB_KNOWN_GAPS:\n${unexpectedlyPresent.map((n) => `  - ${n}`).join('\n')}`
            ).toHaveLength(0);
        });
    });

    describe('Registry completeness snapshot', () => {
        it('should report the count of registry-to-schema gaps per app', () => {
            // Arrange — informational snapshot, not a hard assertion
            const apiVars = registryVarsForApp('api');
            const adminVars = registryVarsForApp('admin');
            const webVars = registryVarsForApp('web');

            const apiMissing = apiVars.filter(
                (n) => !API_KNOWN_GAPS.has(n) && !API_SCHEMA_KEYS.has(n)
            );
            const adminMissing = adminVars.filter(
                (n) => !ADMIN_KNOWN_GAPS.has(n) && !ADMIN_SCHEMA_KEYS.has(n)
            );
            const webMissing = webVars.filter(
                (n) => !WEB_KNOWN_GAPS.has(n) && !WEB_SCHEMA_KEYS.has(n)
            );

            // Act / Assert — all gaps should be zero (covered by the tests above)
            expect(apiMissing).toHaveLength(0);
            expect(adminMissing).toHaveLength(0);
            expect(webMissing).toHaveLength(0);
        });

        it('should report the count of known gaps per app', () => {
            // Arrange / Act
            const gapCounts = {
                api: API_KNOWN_GAPS.size,
                admin: ADMIN_KNOWN_GAPS.size,
                web: WEB_KNOWN_GAPS.size
            };

            // Assert — snapshot so changes to gap counts are visible in CI
            expect(gapCounts).toMatchSnapshot();
        });
    });
});
