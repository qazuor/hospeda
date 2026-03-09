import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStartupValidator } from '@repo/config';
import { createLogger } from '@repo/logger';
/**
 * Environment configuration with validation.
 * Uses @repo/config for centralized environment variable management.
 *
 * Config helpers (getCacheConfig, getCorsConfig, etc.) live in
 * `env-config-helpers.ts` and are re-exported from here for backward
 * compatibility.
 */
import { config } from 'dotenv';
import { z } from 'zod';
import { apiLogger } from './logger.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envLogger = createLogger('env');

const appDir = resolve(__dirname, '../..');
const envFiles = [resolve(appDir, '.env.local')];

if (process.env.NODE_ENV === 'test') {
    envFiles.unshift(resolve(appDir, '.env.test'));
}

for (const envFile of envFiles) {
    if (!existsSync(envFile)) continue;
    try {
        const result = config({ path: envFile });
        if (result?.error) {
            envLogger.warn({
                message: 'Could not load env file',
                file: envFile,
                error: result.error.message
            });
        }
    } catch (error) {
        envLogger.warn({
            message: 'Error loading env file',
            file: envFile,
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

/**
 * API-specific environment schema.
 * All variables use the HOSPEDA_* prefix for consistency.
 */
const ApiEnvSchema = z
    .object({
        // Server
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
        API_PORT: z.coerce.number().positive().default(3001),
        API_HOST: z.string().default('localhost'),

        // Required
        HOSPEDA_API_URL: z.string().url('Must be a valid API URL'),
        HOSPEDA_DATABASE_URL: z.string().min(1, 'Database URL is required'),

        // Authentication
        HOSPEDA_BETTER_AUTH_SECRET: z
            .string()
            .min(32, 'HOSPEDA_BETTER_AUTH_SECRET must be at least 32 characters'),
        /** Better Auth base URL used in auth.ts initialization */
        HOSPEDA_BETTER_AUTH_URL: z.string().url().optional(),

        // OAuth providers
        HOSPEDA_GOOGLE_CLIENT_ID: z.string().optional(),
        HOSPEDA_GOOGLE_CLIENT_SECRET: z.string().optional(),
        HOSPEDA_FACEBOOK_CLIENT_ID: z.string().optional(),
        HOSPEDA_FACEBOOK_CLIENT_SECRET: z.string().optional(),

        // Trusted origins
        HOSPEDA_SITE_URL: z.string().url().optional(),
        HOSPEDA_ADMIN_URL: z.string().url().optional(),

        // Test / debug flags (explicit opt-in; use HOSPEDA_* names)
        /** Set true to bypass authentication in test/dev environments */
        HOSPEDA_DISABLE_AUTH: z.coerce.boolean().default(false),
        /** Set true to allow mock actor injection in test/dev environments */
        HOSPEDA_ALLOW_MOCK_ACTOR: z.coerce.boolean().default(false),
        /** Set true to show detailed error messages and stack traces in 5xx responses */
        HOSPEDA_API_DEBUG_ERRORS: z.coerce.boolean().default(false),
        /** Set true to enable rate limiting in test environments */
        HOSPEDA_TESTING_RATE_LIMIT: z.coerce.boolean().default(false),
        /** Set true to enable verbose debug output during tests */
        HOSPEDA_DEBUG_TESTS: z.coerce.boolean().default(false),
        /** Set true to enforce origin verification in testing */
        HOSPEDA_TESTING_ORIGIN_VERIFICATION: z.coerce.boolean().default(false),

        // Platform-injected (set by Vercel/CI, not user-configured)
        /** Set to "1" by Vercel when running in their platform */
        VERCEL: z.string().optional(),
        /** Set to "true" by CI environments (GitHub Actions, etc.) */
        CI: z.string().optional(),
        /** Git commit SHA injected by Vercel at deploy time */
        VERCEL_GIT_COMMIT_SHA: z.string().optional(),

        // Build metadata
        /** Git commit SHA for health endpoint and Sentry release tagging */
        HOSPEDA_COMMIT_SHA: z.string().default('unknown'),

        // Logging
        API_LOG_LEVEL: z
            .string()
            .transform((val) => val.toLowerCase())
            .pipe(z.enum(['debug', 'info', 'warn', 'error']))
            .default('info'),
        API_ENABLE_REQUEST_LOGGING: z.coerce.boolean().default(true),
        API_LOG_INCLUDE_TIMESTAMPS: z.coerce.boolean().default(true),
        API_LOG_INCLUDE_LEVEL: z.coerce.boolean().default(true),
        API_LOG_USE_COLORS: z.coerce.boolean().default(true),
        API_LOG_SAVE: z.coerce.boolean().default(false),
        API_LOG_EXPAND_OBJECTS: z.coerce.boolean().default(false),
        API_LOG_TRUNCATE_TEXT: z.coerce.boolean().default(true),
        API_LOG_TRUNCATE_AT: z.coerce.number().default(1000),
        API_LOG_STRINGIFY: z.coerce.boolean().default(false),

        // CORS
        API_CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:4321'),
        API_CORS_ALLOW_CREDENTIALS: z.coerce.boolean().default(true),
        API_CORS_MAX_AGE: z.coerce.number().default(86400),
        API_CORS_ALLOW_METHODS: z.string().default('GET,POST,PUT,DELETE,PATCH,OPTIONS'),
        API_CORS_ALLOW_HEADERS: z.string().default('Content-Type,Authorization,X-Requested-With'),
        API_CORS_EXPOSE_HEADERS: z.string().default('Content-Length,X-Request-ID'),

        // Cache
        API_CACHE_ENABLED: z.coerce.boolean().default(true),
        API_CACHE_DEFAULT_MAX_AGE: z.coerce.number().default(300),
        API_CACHE_DEFAULT_STALE_WHILE_REVALIDATE: z.coerce.number().default(60),
        API_CACHE_DEFAULT_STALE_IF_ERROR: z.coerce.number().default(86400),
        API_CACHE_PUBLIC_ENDPOINTS: z.string().default('/api/v1/public/accommodations,/health'),
        API_CACHE_PRIVATE_ENDPOINTS: z.string().default('/api/v1/public/users'),
        API_CACHE_NO_CACHE_ENDPOINTS: z.string().default('/health/db,/docs'),
        API_CACHE_ETAG_ENABLED: z.coerce.boolean().default(true),
        API_CACHE_LAST_MODIFIED_ENABLED: z.coerce.boolean().default(true),

        // Compression
        API_COMPRESSION_ENABLED: z.coerce.boolean().default(true),
        API_COMPRESSION_LEVEL: z.coerce.number().min(1).max(9).default(6),
        API_COMPRESSION_THRESHOLD: z.coerce.number().default(1024),
        API_COMPRESSION_CHUNK_SIZE: z.coerce.number().default(16384),
        API_COMPRESSION_FILTER: z
            .string()
            .default('text/*,application/json,application/xml,application/javascript'),
        API_COMPRESSION_EXCLUDE_ENDPOINTS: z.string().default('/health/db,/docs'),
        API_COMPRESSION_ALGORITHMS: z.string().default('gzip,deflate'),

        // Rate Limiting - global
        API_RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
        API_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
        API_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
        API_RATE_LIMIT_KEY_GENERATOR: z.string().default('ip'),
        API_RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: z.coerce.boolean().default(false),
        API_RATE_LIMIT_SKIP_FAILED_REQUESTS: z.coerce.boolean().default(false),
        API_RATE_LIMIT_STANDARD_HEADERS: z.coerce.boolean().default(true),
        API_RATE_LIMIT_LEGACY_HEADERS: z.coerce.boolean().default(false),
        API_RATE_LIMIT_MESSAGE: z.string().default('Too many requests, please try again later.'),
        /** Trust x-forwarded-for / cf-connecting-ip. Only enable behind a trusted proxy. */
        API_RATE_LIMIT_TRUST_PROXY: z.coerce.boolean().default(false),
        API_RATE_LIMIT_TRUSTED_PROXIES: z.string().default(''),

        // Rate Limiting - auth / public / admin tiers
        API_RATE_LIMIT_AUTH_ENABLED: z.coerce.boolean().default(true),
        API_RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().default(300000),
        API_RATE_LIMIT_AUTH_MAX_REQUESTS: z.coerce.number().default(50),
        API_RATE_LIMIT_AUTH_MESSAGE: z
            .string()
            .default('Too many authentication requests, please try again later.'),
        API_RATE_LIMIT_PUBLIC_ENABLED: z.coerce.boolean().default(true),
        API_RATE_LIMIT_PUBLIC_WINDOW_MS: z.coerce.number().default(3600000),
        API_RATE_LIMIT_PUBLIC_MAX_REQUESTS: z.coerce.number().default(1000),
        API_RATE_LIMIT_PUBLIC_MESSAGE: z
            .string()
            .default('Too many API requests, please try again later.'),
        API_RATE_LIMIT_ADMIN_ENABLED: z.coerce.boolean().default(true),
        API_RATE_LIMIT_ADMIN_WINDOW_MS: z.coerce.number().default(600000),
        API_RATE_LIMIT_ADMIN_MAX_REQUESTS: z.coerce.number().default(200),
        API_RATE_LIMIT_ADMIN_MESSAGE: z
            .string()
            .default('Too many admin requests, please try again later.'),

        // Security
        API_SECURITY_ENABLED: z.coerce.boolean().default(true),
        API_SECURITY_CSRF_ENABLED: z.coerce.boolean().default(true),
        API_SECURITY_CSRF_ORIGIN: z.string().optional(),
        API_SECURITY_CSRF_ORIGINS: z
            .string()
            .default('http://localhost:3000,http://localhost:5173'),
        API_SECURITY_HEADERS_ENABLED: z.coerce.boolean().default(true),
        API_SECURITY_CONTENT_SECURITY_POLICY: z
            .string()
            .default(
                "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
            ),
        API_SECURITY_STRICT_TRANSPORT_SECURITY: z
            .string()
            .default('max-age=31536000; includeSubDomains'),
        API_SECURITY_X_FRAME_OPTIONS: z.string().default('SAMEORIGIN'),
        API_SECURITY_X_CONTENT_TYPE_OPTIONS: z.string().default('nosniff'),
        API_SECURITY_X_XSS_PROTECTION: z.string().default('1; mode=block'),
        API_SECURITY_REFERRER_POLICY: z.string().default('strict-origin-when-cross-origin'),
        API_SECURITY_PERMISSIONS_POLICY: z
            .string()
            .default('camera=(), microphone=(), geolocation=()'),

        // Response format
        API_RESPONSE_FORMAT_ENABLED: z.coerce.boolean().default(true),
        API_RESPONSE_INCLUDE_TIMESTAMP: z.coerce.boolean().default(true),
        API_RESPONSE_INCLUDE_VERSION: z.coerce.boolean().default(true),
        API_RESPONSE_API_VERSION: z.string().default('1.0.0'),
        API_RESPONSE_INCLUDE_REQUEST_ID: z.coerce.boolean().default(true),
        API_RESPONSE_INCLUDE_METADATA: z.coerce.boolean().default(true),
        API_RESPONSE_SUCCESS_MESSAGE: z.string().default('Success'),
        API_RESPONSE_ERROR_MESSAGE: z.string().default('An error occurred'),

        // Validation
        API_VALIDATION_MAX_BODY_SIZE: z.coerce.number().default(10485760),
        API_VALIDATION_MAX_REQUEST_TIME: z.coerce.number().default(30000),
        API_VALIDATION_ALLOWED_CONTENT_TYPES: z
            .string()
            .default('application/json,multipart/form-data'),
        API_VALIDATION_REQUIRED_HEADERS: z.string().default('user-agent'),
        API_VALIDATION_AUTH_ENABLED: z.coerce.boolean().default(true),
        API_VALIDATION_AUTH_HEADERS: z.string().default('authorization'),
        API_VALIDATION_SANITIZE_ENABLED: z.coerce.boolean().default(true),
        API_VALIDATION_SANITIZE_MAX_STRING_LENGTH: z.coerce.number().default(1000),
        API_VALIDATION_SANITIZE_REMOVE_HTML_TAGS: z.coerce.boolean().default(true),
        API_VALIDATION_SANITIZE_ALLOWED_CHARS: z.string().default('[\\w\\s\\-.,!?@#$%&*()+=]'),

        // Metrics
        API_METRICS_ENABLED: z.coerce.boolean().default(true),
        API_METRICS_SLOW_REQUEST_THRESHOLD_MS: z.coerce.number().default(1000),
        API_METRICS_SLOW_AUTH_THRESHOLD_MS: z.coerce.number().default(2000),

        // Database pool
        HOSPEDA_DB_POOL_MAX_CONNECTIONS: z.coerce.number().default(10),
        HOSPEDA_DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
        HOSPEDA_DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().default(2000),

        // Linear / Feedback integration
        HOSPEDA_LINEAR_API_KEY: z.string().optional(),
        HOSPEDA_LINEAR_TEAM_ID: z.string().optional(),
        /** Kill switch for feedback system. Set to 'false' to disable. */
        HOSPEDA_FEEDBACK_ENABLED: z
            .string()
            .optional()
            .transform((v) => v !== 'false'),
        /** Override fallback email for feedback reports when Linear is down */
        HOSPEDA_FEEDBACK_FALLBACK_EMAIL: z.string().email().optional(),

        // Exchange rates
        HOSPEDA_EXCHANGE_RATE_API_KEY: z.string().default(''),
        /** DolarAPI base URL for ARS exchange rates */
        HOSPEDA_DOLAR_API_BASE_URL: z.string().url().optional(),
        /** ExchangeRate-API base URL for multi-currency rates */
        HOSPEDA_EXCHANGE_RATE_API_BASE_URL: z.string().url().optional(),

        // Cron
        /** Shared secret for authenticating cron HTTP requests. Required in production (min 32 chars). */
        HOSPEDA_CRON_SECRET: z
            .string()
            .min(32, 'HOSPEDA_CRON_SECRET must be at least 32 characters for security')
            .optional(),
        /** Cron adapter: manual (default), vercel, or node-cron */
        HOSPEDA_CRON_ADAPTER: z.enum(['manual', 'vercel', 'node-cron']).default('manual'),

        // Billing
        /** MercadoPago access token for payment processing */
        HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: z.string().optional(),

        // Email / Notifications
        HOSPEDA_RESEND_API_KEY: z.string().optional(),
        HOSPEDA_RESEND_FROM_EMAIL: z.string().optional(),
        HOSPEDA_RESEND_FROM_NAME: z.string().optional(),
        /** Comma-separated list of admin emails for system notifications */
        HOSPEDA_ADMIN_NOTIFICATION_EMAILS: z.string().optional(),

        // Sentry
        HOSPEDA_SENTRY_DSN: z.string().optional(),
        HOSPEDA_SENTRY_RELEASE: z.string().optional(),
        HOSPEDA_SENTRY_PROJECT: z.string().optional(),

        // Infrastructure
        HOSPEDA_REDIS_URL: z.string().optional()
    })
    .superRefine((data, ctx) => {
        if (
            data.NODE_ENV === 'production' &&
            (!data.HOSPEDA_CRON_SECRET || data.HOSPEDA_CRON_SECRET.trim() === '')
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['HOSPEDA_CRON_SECRET'],
                message: 'HOSPEDA_CRON_SECRET is required in production environment'
            });
        }
        if (
            data.NODE_ENV === 'production' &&
            (!data.HOSPEDA_REDIS_URL || data.HOSPEDA_REDIS_URL.trim() === '')
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['HOSPEDA_REDIS_URL'],
                message:
                    'HOSPEDA_REDIS_URL is required in production for rate limiting to work across instances'
            });
        }
        // OAuth cross-validation: require secret when client ID is set
        if (data.HOSPEDA_GOOGLE_CLIENT_ID && !data.HOSPEDA_GOOGLE_CLIENT_SECRET) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['HOSPEDA_GOOGLE_CLIENT_SECRET'],
                message:
                    'HOSPEDA_GOOGLE_CLIENT_SECRET is required when HOSPEDA_GOOGLE_CLIENT_ID is set'
            });
        }
        if (data.HOSPEDA_FACEBOOK_CLIENT_ID && !data.HOSPEDA_FACEBOOK_CLIENT_SECRET) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['HOSPEDA_FACEBOOK_CLIENT_SECRET'],
                message:
                    'HOSPEDA_FACEBOOK_CLIENT_SECRET is required when HOSPEDA_FACEBOOK_CLIENT_ID is set'
            });
        }
        // Reject localhost/127.0.0.1 in CORS and CSRF origins in production
        if (data.NODE_ENV === 'production') {
            const localhostPattern = /localhost|127\.0\.0\.1/i;
            const corsOrigins = data.API_CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? [];
            for (const origin of corsOrigins) {
                if (localhostPattern.test(origin)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['API_CORS_ORIGINS'],
                        message: `CORS origin '${origin}' contains localhost, which is not allowed in production`
                    });
                }
            }
            const csrfOrigins =
                data.API_SECURITY_CSRF_ORIGINS?.split(',').map((o) => o.trim()) ?? [];
            for (const origin of csrfOrigins) {
                if (localhostPattern.test(origin)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['API_SECURITY_CSRF_ORIGINS'],
                        message: `CSRF origin '${origin}' contains localhost, which is not allowed in production`
                    });
                }
            }
        }
    });

/**
 * Creates the API environment validation function.
 * @remarks
 * `ApiEnvSchema` uses `.superRefine()` which produces a `ZodEffects` type.
 * `ZodEffects` extends `ZodType` but TypeScript does not infer the constraint
 * automatically across Zod v4 type boundaries.
 * @see createStartupValidator
 */
const _validateApiEnv = createStartupValidator(
    // biome-ignore lint/suspicious/noExplicitAny: ZodEffects from .superRefine() is not assignable to ZodSchema<T> in Zod v4
    ApiEnvSchema as any,
    'API'
);

/**
 * The validated API environment object.
 * Populated after calling {@link validateApiEnv}.
 */
export let env: z.infer<typeof ApiEnvSchema>;

/**
 * Validate and populate the environment object.
 * Must be called before accessing {@link env}.
 */
export const validateApiEnv = (): void => {
    env = _validateApiEnv() as z.infer<typeof ApiEnvSchema>;
    apiLogger.log(env, 'validateApiEnv');
};

// Export the schema for testing
export { ApiEnvSchema };

// Re-export config helpers for backward compatibility
export {
    parseCommaSeparated,
    parseCorsOrigins,
    getCacheConfig,
    getCorsConfig,
    getCompressionConfig,
    getRateLimitConfig,
    getSecurityConfig,
    getValidationConfig,
    getResponseConfig,
    getDatabasePoolConfig
} from './env-config-helpers.js';
