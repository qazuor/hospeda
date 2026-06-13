/**
 * Environment configuration with validation for Admin App
 * Uses Zod for validation and import.meta.env for accessing variables
 *
 * Note: Vite automatically loads .env files, so we don't need dotenv here
 */
import { adminLogger } from '@/utils/logger';
import { z } from 'zod';

/**
 * Detects the CI build placeholder URL.
 *
 * CI runs without repository secrets (most visibly Dependabot PRs), so the
 * workflow falls back to `https://example.invalid` for the URL env vars to let
 * the admin build's URL validation pass — see `.github/workflows/ci.yml` and
 * SPEC-219. The `.invalid` TLD is reserved by RFC 2606 and never resolves, so
 * it is a safe, recognizable marker that must NEVER reach a real/deploy build.
 *
 * @param value - The candidate URL string.
 * @returns `true` when the URL host is under the reserved `.invalid` TLD.
 */
const isPlaceholderUrl = (value: string): boolean => {
    try {
        const { hostname } = new URL(value);
        return hostname === 'invalid' || hostname.endsWith('.invalid');
    } catch {
        return false;
    }
};

/**
 * A required, syntactically-valid URL that additionally rejects the CI
 * placeholder (`*.invalid`) unless `ALLOW_PLACEHOLDER_ENV_URLS` is explicitly
 * set to `'true'`. Only the CI Build step sets that flag (SPEC-219 T-002), so a
 * production/deploy build that is misconfigured with a placeholder URL fails
 * loudly instead of silently shipping a non-functional value (SPEC-219 T-006).
 *
 * The flag is read inside the refinement (not at module scope) so it reflects
 * the environment at validation time.
 *
 * NOTE: `process.env` is only meaningful in Node contexts (build / SSR). Vite
 * replaces `process.env` with `{}` in the browser bundle, so in a hydrated
 * client this guard always sees the flag as absent and therefore always rejects
 * a placeholder — which is the intended behavior: `ALLOW_PLACEHOLDER_ENV_URLS`
 * is a build-time-only CI signal and must never relax the guard in a running
 * browser. The build-time counterpart of this guard lives in `vite.config.ts`.
 *
 * @param label - Field name, used in the rejection message.
 * @returns A Zod string schema enforcing the rules above.
 */
const requiredUrl = (label: string) =>
    z
        .string()
        .url()
        .refine(
            (value) =>
                process.env.ALLOW_PLACEHOLDER_ENV_URLS === 'true' || !isPlaceholderUrl(value),
            {
                message: `${label} is a placeholder (.invalid) URL; a real URL is required outside CI builds`
            }
        );

/**
 * Schema for Admin App environment variables
 * Validates VITE_ prefixed variables that are available in the browser
 */
const AdminEnvSchema = z.object({
    // API Configuration
    VITE_API_URL: requiredUrl('VITE_API_URL').describe('API base URL'),
    VITE_SITE_URL: requiredUrl('VITE_SITE_URL').describe('Public web app URL'),
    // Admin's own public URL. Used to build the absolute callbackUrl when the
    // _authed guard redirects unauthenticated users to the web signin (SPEC-182).
    VITE_ADMIN_URL: requiredUrl('VITE_ADMIN_URL').describe('Admin dashboard own public URL'),

    // Server-side API URL used by TanStack Start server functions (e.g. auth-session.ts).
    // Must be set as a plain process.env variable (no VITE_ prefix) since it is never
    // exposed to the browser bundle.
    HOSPEDA_API_URL: requiredUrl('HOSPEDA_API_URL').describe(
        'API base URL for server-side requests (server functions)'
    ),

    // Authentication
    VITE_BETTER_AUTH_URL: z.string().min(1).describe('Better Auth URL for authentication'),

    // App Configuration
    VITE_APP_NAME: z.string().default('Hospeda Admin').describe('Application name'),
    VITE_APP_VERSION: z.string().default('1.0.0').describe('Application version'),
    VITE_APP_DESCRIPTION: z
        .string()
        .default('Admin panel for Hospeda platform')
        .describe('Application description'),

    // Feature Flags
    VITE_ENABLE_DEVTOOLS: z
        .string()
        .default('false')
        .transform((val) => val === 'true')
        .describe('Enable React DevTools'),
    VITE_ENABLE_QUERY_DEVTOOLS: z
        .string()
        .default('false')
        .transform((val) => val === 'true')
        .describe('Enable TanStack Query DevTools'),
    VITE_ENABLE_ROUTER_DEVTOOLS: z
        .string()
        .default('false')
        .transform((val) => val === 'true')
        .describe('Enable TanStack Router DevTools'),

    // UI Configuration
    VITE_DEFAULT_PAGE_SIZE: z
        .string()
        .default('25')
        .transform((val) => Number.parseInt(val, 10))
        .describe('Default pagination size'),
    VITE_MAX_PAGE_SIZE: z
        .string()
        .default('100')
        .transform((val) => Number.parseInt(val, 10))
        .describe('Maximum pagination size'),

    // Monitoring
    VITE_SENTRY_DSN: z
        .string()
        .url()
        .optional()
        .describe('Sentry DSN for error tracking (production only)'),
    VITE_SENTRY_RELEASE: z.string().optional().describe('Sentry release identifier'),
    VITE_SENTRY_PROJECT: z.string().optional().describe('Sentry project slug'),
    VITE_SENTRY_ENVIRONMENT: z
        .string()
        .optional()
        .describe(
            'Sentry environment tag (production | staging | development). Overrides import.meta.env.MODE so staging and prod (both MODE=production) end up in separate Sentry environments.'
        ),

    // Analytics — PostHog Cloud (SPEC-140). Public by design; ship in bundle.
    // Leave unset to disable PostHog init in posthog-client.ts (T-140-17).
    // Per-env values come from Coolify; keys live in 1Password.
    VITE_POSTHOG_KEY: z
        .string()
        .optional()
        .describe('PostHog Cloud project API key (phc_...) for the admin app'),
    VITE_POSTHOG_HOST: z
        .string()
        .url()
        .optional()
        .describe('PostHog Cloud ingestion endpoint (defaults to https://us.i.posthog.com)'),

    // Locale Configuration
    VITE_SUPPORTED_LOCALES: z
        .string()
        .default('es,en')
        .describe('Comma-separated list of supported locales'),
    VITE_DEFAULT_LOCALE: z.string().default('es').describe('Default locale for the admin app'),

    // Debug / Developer Flags
    VITE_DEBUG_LAZY_SECTIONS: z.coerce
        .boolean()
        .default(false)
        .describe('Enable debug logging for lazy-loaded sections'),
    VITE_DEBUG_ACTOR_ID: z.string().optional().describe('Override actor ID for debugging purposes'),
    VITE_ENABLE_LOGGING: z.coerce
        .boolean()
        .default(false)
        .describe('Enable verbose client-side logging'),

    // Development
    NODE_ENV: z
        .string()
        .default('development')
        .refine((val) => ['development', 'production', 'test'].includes(val), {
            message: 'NODE_ENV must be development, production, or test'
        })
        .describe('Node environment'),
    DEV: z.boolean().optional().describe('Vite development mode flag'),
    PROD: z.boolean().optional().describe('Vite production mode flag')
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
        return value !== undefined ? value : defaultValue;
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

        return AdminEnvSchema.parse(envData);
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

// Export the schema for testing
export { AdminEnvSchema };
