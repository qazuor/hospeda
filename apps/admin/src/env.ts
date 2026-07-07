/**
 * Environment configuration with validation for Admin App
 * Uses Zod for validation and import.meta.env for accessing variables
 *
 * Note: Vite automatically loads .env files, so we don't need dotenv here
 */

import { z } from 'zod';
import { adminLogger } from '@/utils/logger';
import { AdminEnvSchema } from './env-schema.js';

// `AdminEnvSchema` now lives in the pure `env-schema.ts` sibling file (no
// `@/utils/logger` / Vite-alias import) — see its module docblock for why.
// Re-exported below (near the bottom of this file) so every existing importer
// (notably the env-registry cross-validation test, which reads `.shape` and
// therefore needs the PLAIN object schema, not a `.superRefine`-wrapped one)
// keeps working unchanged.

/**
 * Admin environment schema with cross-field validation, layered on top of the
 * plain {@link AdminEnvSchema}.
 *
 * Production hardening (Sentry prod-hardening spec): `VITE_SENTRY_DSN` is
 * required when running a production BUILD. Gated on `data.PROD` — Vite's own
 * built-in production-build flag — rather than `NODE_ENV`, because Vite does
 * NOT populate `import.meta.env.NODE_ENV` automatically (unlike `PROD`/`DEV`,
 * which Vite always sets based on the build mode); relying on `NODE_ENV` here
 * would silently never fire in a real production bundle. Mirrors the
 * `PUBLIC_SENTRY_DSN` (web) / `HOSPEDA_SENTRY_DSN` (api) production-required
 * pattern.
 */
const AdminEnvValidatedSchema = AdminEnvSchema.superRefine((data, ctx) => {
    if (data.PROD === true && (!data.VITE_SENTRY_DSN || data.VITE_SENTRY_DSN.trim() === '')) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['VITE_SENTRY_DSN'],
            message: 'VITE_SENTRY_DSN is required in a production build'
        });
    }
});

/**
 * Type for validated environment variables
 */
export type AdminEnv = z.infer<typeof AdminEnvSchema>;

/**
 * Helper to safely access import.meta.env with defaults
 * For Vite apps, environment variables are available via import.meta.env
 */
const safeEnv = {
    get: (
        key: string,
        defaultValue?: string | boolean | number
    ): string | boolean | number | undefined => {
        const value = import.meta.env[key];
        return value === undefined ? defaultValue : value;
    },
    getBoolean: (key: string, defaultValue = false): boolean => {
        const value = import.meta.env[key];
        if (value === undefined) return defaultValue;
        return value === 'true' || value === true;
    },
    getNumber: (key: string, defaultValue = 0): number => {
        const value = import.meta.env[key];
        if (value === undefined) return defaultValue;
        const parsed = Number(value);
        return Number.isNaN(parsed) ? defaultValue : parsed;
    }
};

/**
 * Validate all required environment variables for the Admin App
 * Should be called at application startup
 */
export const validateAdminEnv = (): AdminEnv => {
    try {
        // Create env object from import.meta.env
        const envData = {
            VITE_API_URL: import.meta.env.VITE_API_URL,
            VITE_SITE_URL: import.meta.env.VITE_SITE_URL,
            VITE_ADMIN_URL: import.meta.env.VITE_ADMIN_URL,
            HOSPEDA_API_URL: import.meta.env.HOSPEDA_API_URL ?? process.env.HOSPEDA_API_URL,
            VITE_BETTER_AUTH_URL: import.meta.env.VITE_BETTER_AUTH_URL,
            VITE_APP_NAME: import.meta.env.VITE_APP_NAME || 'Hospeda Admin',
            VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
            VITE_APP_DESCRIPTION:
                import.meta.env.VITE_APP_DESCRIPTION || 'Admin panel for Hospeda platform',
            VITE_ENABLE_DEVTOOLS: import.meta.env.VITE_ENABLE_DEVTOOLS || 'false',
            VITE_ENABLE_QUERY_DEVTOOLS: import.meta.env.VITE_ENABLE_QUERY_DEVTOOLS || 'false',
            VITE_ENABLE_ROUTER_DEVTOOLS: import.meta.env.VITE_ENABLE_ROUTER_DEVTOOLS || 'false',
            VITE_DEFAULT_PAGE_SIZE: import.meta.env.VITE_DEFAULT_PAGE_SIZE || '25',
            VITE_MAX_PAGE_SIZE: import.meta.env.VITE_MAX_PAGE_SIZE || '100',
            VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
            VITE_SENTRY_RELEASE: import.meta.env.VITE_SENTRY_RELEASE,
            VITE_SENTRY_PROJECT: import.meta.env.VITE_SENTRY_PROJECT,
            VITE_SENTRY_ENVIRONMENT: import.meta.env.VITE_SENTRY_ENVIRONMENT,
            VITE_SENTRY_CSP_REPORT_URI: import.meta.env.VITE_SENTRY_CSP_REPORT_URI,
            VITE_TURNSTILE_SITE_KEY: import.meta.env.VITE_TURNSTILE_SITE_KEY,
            VITE_POSTHOG_KEY: import.meta.env.VITE_POSTHOG_KEY,
            VITE_POSTHOG_HOST: import.meta.env.VITE_POSTHOG_HOST,
            VITE_SUPPORTED_LOCALES: import.meta.env.VITE_SUPPORTED_LOCALES || 'es,en',
            VITE_DEFAULT_LOCALE: import.meta.env.VITE_DEFAULT_LOCALE || 'es',
            VITE_DEBUG_LAZY_SECTIONS: import.meta.env.VITE_DEBUG_LAZY_SECTIONS,
            VITE_DEBUG_ACTOR_ID: import.meta.env.VITE_DEBUG_ACTOR_ID,
            VITE_ENABLE_LOGGING: import.meta.env.VITE_ENABLE_LOGGING,
            NODE_ENV: import.meta.env.NODE_ENV || 'development',
            DEV: import.meta.env.DEV,
            PROD: import.meta.env.PROD
        };

        return AdminEnvValidatedSchema.parse(envData);
    } catch (error) {
        // Build a detailed, structured error report. We log to BOTH adminLogger
        // (dev convenience, browser console) AND console.error (guarantees the
        // message reaches stdout/stderr in containerized runtimes where the
        // adminLogger transport may be silenced). The detailed list of failing
        // fields is also embedded in the thrown Error message so it surfaces
        // in stack traces and crash reports (e.g. Coolify container logs).
        const issues =
            error instanceof z.ZodError
                ? error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
                : [`  - ${error instanceof Error ? error.message : String(error)}`];
        const detail = issues.join('\n');
        const header = '❌ Admin App environment validation FAILED';

        adminLogger.error(header);
        for (const line of issues) adminLogger.error(line);

        console.error(`${header}\n${detail}`);

        throw new Error(`Environment validation failed for Admin App:\n${detail}`);
    }
};

/**
 * Get the API base URL
 */
export const getApiUrl = (): string => {
    return safeEnv.get('VITE_API_URL') as string;
};

/**
 * Get Better Auth URL for authentication
 */
export const getBetterAuthUrl = (): string => {
    return safeEnv.get('VITE_BETTER_AUTH_URL') as string;
};

/**
 * Get admin app configuration
 */
export const getAdminConfig = () => {
    return {
        name: safeEnv.get('VITE_APP_NAME', 'Hospeda Admin'),
        version: safeEnv.get('VITE_APP_VERSION', '1.0.0'),
        description: safeEnv.get('VITE_APP_DESCRIPTION', 'Admin panel for Hospeda platform')
    };
};

/**
 * Get feature flags configuration
 */
export const getFeatureFlags = () => {
    return {
        enableDevtools: safeEnv.get('VITE_ENABLE_DEVTOOLS', false),
        enableQueryDevtools: safeEnv.get('VITE_ENABLE_QUERY_DEVTOOLS', false),
        enableRouterDevtools: safeEnv.get('VITE_ENABLE_ROUTER_DEVTOOLS', false)
    };
};

/**
 * Get pagination configuration
 */
export const getPaginationConfig = () => {
    return {
        defaultPageSize: safeEnv.get('VITE_DEFAULT_PAGE_SIZE', 25),
        maxPageSize: safeEnv.get('VITE_MAX_PAGE_SIZE', 100)
    };
};

/**
 * Check if running in development mode
 */
export const isDevelopment = (): boolean => {
    return safeEnv.get('NODE_ENV', 'development') === 'development';
};

/**
 * Check if running in production mode
 */
export const isProduction = (): boolean => {
    return safeEnv.get('NODE_ENV', 'development') === 'production';
};

/**
 * Check if running in test mode
 */
export const isTest = (): boolean => {
    return safeEnv.get('NODE_ENV', 'development') === 'test';
};

/**
 * Get Sentry DSN for error tracking (optional, only used in production)
 */
export const getSentryDsn = (): string | undefined => {
    return safeEnv.get('VITE_SENTRY_DSN') as string | undefined;
};

/**
 * Lazy singleton for validated environment variables.
 *
 * This is the SINGLE SOURCE OF TRUTH for env vars in the admin app.
 * All other modules must import `env` from here instead of reading
 * `import.meta.env.*` directly.
 *
 * The singleton is evaluated lazily on first property access so that
 * test files that only import `AdminEnvSchema` (for unit-testing the schema)
 * do NOT trigger validation against real `import.meta.env` values.
 *
 * NOTE: `logger.ts` is the one deliberate exception. `env.ts` imports
 * `adminLogger` (to report validation errors), which would create a circular
 * dependency if `logger.ts` imported `env` in turn. Therefore `logger.ts`
 * reads `import.meta.env.DEV` and `import.meta.env.VITE_ENABLE_LOGGING`
 * directly.
 *
 * @example
 * ```ts
 * import { env } from '@/env';
 * const apiUrl = env.VITE_API_URL;
 * ```
 */
let _env: AdminEnv | undefined;

export const env = new Proxy({} as AdminEnv, {
    get(_target, prop: string) {
        if (!_env) {
            _env = validateAdminEnv();
        }
        return (_env as Record<string, unknown>)[prop];
    }
});

// Export the schemas for testing
export { AdminEnvSchema, AdminEnvValidatedSchema };
