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

// Locate the app root reliably in both source (src/utils/env.ts) and bundled
// (dist/index.js) modes. Walking up via __dirname fails in the bundled case
// because tsup collapses the directory depth from two levels (src/utils → app)
// to one (dist → app).  process.cwd() is the canonical app root when executed
// via `pnpm <script>` because pnpm always cd-s into the package directory.
const appDir = (() => {
    const cwd = process.cwd();
    // Verify cwd looks like our app root (has package.json). If not — e.g. when
    // running tests that do not cd — fall back to the old dirname-based path so
    // existing test setups keep working without change.
    if (existsSync(resolve(cwd, 'package.json'))) {
        return cwd;
    }
    // Fallback: works for source layout (src/utils/env.ts → two levels up)
    return resolve(__dirname, '../..');
})();
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
 * Base shape of the API environment schema.
 *
 * Exported separately from {@link ApiEnvSchema} so consumers (notably the
 * env-registry cross-validation test) can enumerate `.shape` keys directly,
 * which is not possible on the wrapped `ZodEffects` returned by
 * `.superRefine(...)`.
 *
 * Add new env vars HERE; the `.superRefine` block in {@link ApiEnvSchema}
 * is reserved for cross-field validation.
 */
export const ApiEnvBaseSchema = z.object({
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
    HOSPEDA_BETTER_AUTH_URL: z.string().url('Must be a valid URL for Better Auth'),

    /**
     * Server-only secret used to generate deterministic, irreversible offsets for
     * accommodation location obfuscation (privacy-aware approximate coordinates).
     * Generated with `openssl rand -base64 48`. Rotating this value changes all
     * approximate locations shown to public visitors (expected behavior).
     */
    HOSPEDA_LOCATION_SALT: z
        .string()
        .min(32, 'HOSPEDA_LOCATION_SALT must be at least 32 characters'),
    /**
     * Server-only HMAC secret (pepper) for computing privacy-safe, day-scoped
     * visitor deduplication hashes used by cross-entity view tracking (SPEC-159).
     * Hash form: SHA-256(HMAC-SHA256(secret, 'yyyy-mm-dd') + truncatedIp + UA).
     * Raw IPs are never stored or logged. Min 32 chars; rotating invalidates
     * all current-day hashes (visitors are recounted as new for that day).
     */
    HOSPEDA_VIEWS_HASH_SECRET: z
        .string()
        .min(32, 'HOSPEDA_VIEWS_HASH_SECRET must be at least 32 characters'),
    /**
     * User-Agent header sent to Nominatim and Photon when geocoding addresses
     * for the admin location picker (SPEC-097, Phase 6). Nominatim's usage
     * policy requires an identifiable User-Agent; missing or generic values
     * may result in throttling or banning.
     */
    HOSPEDA_GEOCODING_USER_AGENT: z.string().min(1).default('Hospeda/1.0 (https://hospeda.com.ar)'),

    // OAuth providers
    HOSPEDA_GOOGLE_CLIENT_ID: z.string().optional(),
    HOSPEDA_GOOGLE_CLIENT_SECRET: z.string().optional(),
    HOSPEDA_FACEBOOK_CLIENT_ID: z.string().optional(),
    HOSPEDA_FACEBOOK_CLIENT_SECRET: z.string().optional(),

    // Trusted origins
    HOSPEDA_SITE_URL: z.string().url('Must be a valid URL for the web app'),
    HOSPEDA_ADMIN_URL: z.string().url().optional(),

    /**
     * Dev-only session-cookie domain override (SPEC-182). Set to
     * `.hospeda.local` (with the `/etc/hosts` recipe in
     * docs/guides/auth-local-dev.md) to share the Better Auth cookie across
     * web/admin/api dev hosts, mirroring production cross-subdomain behavior.
     * Ignored in production (the apex is pinned in auth-cookie-domain.ts).
     */
    HOSPEDA_DEV_COOKIE_DOMAIN: z.string().optional(),

    // Test / debug flags (explicit opt-in; use HOSPEDA_* names)
    // NOTE: we use string→boolean transform here instead of z.coerce.boolean()
    // because the latter has a notorious footgun: any non-empty string
    // (including the literal 'false') coerces to true. Using transform with an
    // explicit `=== 'true'` check makes 'false', '0', '', etc. all evaluate
    // to false, which matches every developer's mental model of these flags.
    /** Set true to bypass authentication in test/dev environments */
    HOSPEDA_DISABLE_AUTH: z
        .string()
        .optional()
        .transform((v) => v === 'true'),
    /** Set true to allow mock actor injection in test/dev environments */
    HOSPEDA_ALLOW_MOCK_ACTOR: z
        .string()
        .optional()
        .transform((v) => v === 'true'),
    /** Set true to show detailed error messages and stack traces in 5xx responses */
    HOSPEDA_API_DEBUG_ERRORS: z
        .string()
        .optional()
        .transform((v) => v === 'true'),
    /** Set true to enable rate limiting in test environments */
    HOSPEDA_TESTING_RATE_LIMIT: z
        .string()
        .optional()
        .transform((v) => v === 'true'),
    /** Set true to enable verbose debug output during tests */
    HOSPEDA_DEBUG_TESTS: z
        .string()
        .optional()
        .transform((v) => v === 'true'),
    /** Set true to enforce origin verification in testing */
    HOSPEDA_TESTING_ORIGIN_VERIFICATION: z
        .string()
        .optional()
        .transform((v) => v === 'true'),

    // Platform-injected (set by CI, not user-configured)
    /** Set to "true" by CI environments (GitHub Actions, etc.) */
    CI: z.string().optional(),

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
    API_LOG_FORMAT: z
        .string()
        .transform((val) => val.toLowerCase())
        .pipe(z.enum(['pretty', 'json']))
        .default('pretty'),

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
    API_CACHE_ETAG_ENABLED: z.coerce.boolean().default(true),
    API_CACHE_LAST_MODIFIED_ENABLED: z.coerce.boolean().default(true),

    // Compression
    API_COMPRESSION_ENABLED: z.coerce.boolean().default(true),
    API_COMPRESSION_LEVEL: z.coerce.number().min(1).max(9).default(6),
    API_COMPRESSION_THRESHOLD: z.coerce.number().default(1024),
    API_COMPRESSION_ALGORITHMS: z.string().default('gzip,deflate'),

    // Rate Limiting - global "general" tier (catch-all for non-auth/admin/public/billing/webhook).
    //
    // This is the tier that covers `/api/v1/protected/*` (authenticated user routes — favorites,
    // collections, preferences, profile reads, etc.). A typical /mi-cuenta visit fires 3–6 API
    // calls just to render one page (SSR + island hydration + counters), so the previous default
    // of 100 / 15 min (≈6.7 req/min average) tripped 429 well below normal interactive use.
    // Bumped to 500 / 15 min (≈33 req/min) which comfortably absorbs human navigation while
    // still leaving headroom over the public tier ceiling.
    API_RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
    API_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
    API_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(500),
    API_RATE_LIMIT_KEY_GENERATOR: z.string().default('ip'),
    /**
     * Which response classes to exclude from rate-limit counting.
     * - 'none' (default): count every response
     * - 'successful': do not count 2xx responses
     * - 'failed': do not count 4xx/5xx responses
     */
    API_RATE_LIMIT_SKIP: z.enum(['none', 'successful', 'failed']).default('none'),
    /**
     * Which rate-limit response header style to emit.
     * - 'standard' (default): IETF RateLimit-* headers
     * - 'legacy': X-RateLimit-* headers (pre-IETF)
     * - 'both': emit both header families
     * - 'none': emit no rate-limit headers
     */
    API_RATE_LIMIT_HEADERS: z.enum(['standard', 'legacy', 'both', 'none']).default('standard'),
    API_RATE_LIMIT_MESSAGE: z.string().default('Too many requests, please try again later.'),
    /** Trust x-forwarded-for / cf-connecting-ip. Default true — matches Cloudflare/Nginx/Coolify Traefik deploy targets. Set false ONLY for direct-exposed local dev runs. */
    API_RATE_LIMIT_TRUST_PROXY: z.coerce.boolean().default(true),
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
    API_SECURITY_HEADERS_ENABLED: z.coerce.boolean().default(true),
    // Default CSP for API responses. Note: security.ts middleware hardcodes its own CSP policy.
    API_SECURITY_CONTENT_SECURITY_POLICY: z
        .string()
        .default(
            "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-src 'none';"
        ),
    API_SECURITY_STRICT_TRANSPORT_SECURITY: z
        .string()
        .default('max-age=31536000; includeSubDomains'),
    API_SECURITY_X_FRAME_OPTIONS: z.string().default('SAMEORIGIN'),
    API_SECURITY_REFERRER_POLICY: z.string().default('strict-origin-when-cross-origin'),
    API_SECURITY_PERMISSIONS_POLICY: z.string().default('camera=(), microphone=(), geolocation=()'),

    // Response format
    API_RESPONSE_FORMAT_ENABLED: z.coerce.boolean().default(true),
    API_RESPONSE_INCLUDE_TIMESTAMP: z.coerce.boolean().default(true),
    /**
     * API version string injected into responses. Empty string disables version inclusion.
     * Default '1.0.0' (include version). Set to '' to omit version from response envelope and headers.
     */
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
    /**
     * Allowed-chars regex for input sanitization. The default explicitly includes
     * Spanish (á é í ó ú ü ñ + uppercase), Portuguese (ã õ ç + uppercase) and
     * common Latin diacritics (à è ì ò ù â ê î ô û + uppercase) because Hospeda
     * serves es-AR, en, and pt audiences. Stripping accents silently corrupts
     * place names like "Concepción del Uruguay" or "São Paulo" — never default
     * to a regex that excludes them.
     */
    API_VALIDATION_SANITIZE_ALLOWED_CHARS: z
        .string()
        .default('[\\w\\sáéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛçÇãõÃÕ\\-.,!?@#$%&*()+=]'),

    // Metrics
    API_METRICS_ENABLED: z.coerce.boolean().default(true),
    API_METRICS_SLOW_REQUEST_THRESHOLD_MS: z.coerce.number().default(1000),
    API_METRICS_SLOW_AUTH_THRESHOLD_MS: z.coerce.number().default(2000),

    // Database pool
    HOSPEDA_DB_POOL_MAX_CONNECTIONS: z.coerce.number().default(10),
    HOSPEDA_DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
    HOSPEDA_DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().default(5000),

    // Linear / Feedback integration
    HOSPEDA_LINEAR_API_KEY: z.string().optional(),
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
    /**
     * Cron scheduler adapter:
     * - 'node-cron': in-process scheduling (production VPS path)
     * - 'manual': no scheduler — used in dev/tests/CI
     */
    HOSPEDA_CRON_ADAPTER: z.enum(['manual', 'node-cron']).default('manual'),
    /** Shared secret for authenticating ISR revalidation requests from the API. Must be at least 32 characters. */
    HOSPEDA_REVALIDATION_SECRET: z.string().min(32).optional(),
    /** Cron schedule for automatic page revalidation (default: every hour) */
    HOSPEDA_REVALIDATION_CRON_SCHEDULE: z.string().optional().default('0 * * * *'),

    // Billing
    /** MercadoPago access token for payment processing */
    HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: z.string().optional(),
    /** MercadoPago webhook signature secret for verifying incoming IPN notifications */
    HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET: z.string().optional(),
    /**
     * MercadoPago sandbox/test mode flag. Defaults to true (safer default).
     * Set to 'false' explicitly to enable production charges.
     * Note: MP test and production access tokens both use the `APP_USR-` prefix —
     * sandbox vs prod is determined by this flag plus which credentials section
     * the token was copied from in the MP dashboard.
     */
    HOSPEDA_MERCADO_PAGO_SANDBOX: z
        .string()
        .optional()
        .default('true')
        .transform((v) => v !== 'false'),
    /**
     * Feature flag for addon lifecycle processing (cancellations, plan changes, expiry).
     * Set to 'false' to disable all addon lifecycle side-effects without deploying code.
     * Default: true (enabled).
     */
    HOSPEDA_ADDON_LIFECYCLE_ENABLED: z
        .string()
        .optional()
        .transform((v) => v !== 'false'),
    /**
     * Feature flag for the user self-service subscription cancellation route
     * (SPEC-147). Ships dark (default false) until the SPEC-203 UI lands.
     * Set to 'true' to enable. Absent or any other value keeps the route
     * disabled (opt-in: only the literal string 'true' enables it).
     */
    HOSPEDA_USER_CANCEL_ENABLED: z
        .string()
        .optional()
        .transform((v) => v === 'true'),
    /**
     * Feature flag for the MercadoPago subscription_preapproval polling
     * fallback (SPEC-143 Finding #17). When `true` (default), start-paid
     * schedules a polling job that queries MP `/preapproval/{id}` until
     * the preapproval reports `authorized`, then flips the local
     * subscription to `active`. Set to `false` as a kill-switch if the
     * polling layer misbehaves in production — the webhook handler
     * still works regardless of this flag.
     */
    HOSPEDA_BILLING_POLLING_ENABLED: z
        .string()
        .optional()
        .default('true')
        .transform((v) => v !== 'false'),
    /**
     * Statement descriptor that appears on the cardholder's bank statement
     * after a MercadoPago payment. MP rejects descriptors longer than 11
     * characters and recommends uppercase ASCII (letters, digits, spaces) so
     * the value renders consistently across issuers.
     *
     * Validated at startup. Tunable via env so the value can be adjusted
     * during MP homologation without a code deploy.
     */
    HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: z
        .string()
        .regex(
            /^[A-Z0-9 ]{1,11}$/,
            'Statement descriptor must be 1-11 ASCII uppercase letters, digits or spaces'
        )
        .default('HOSPEDA'),

    /**
     * Extra trusted origins (CSV of full URLs). Applied to BOTH the
     * Hono CORS allow-list and the Better Auth `trustedOrigins` so
     * operators don't have to keep two lists in sync.
     *
     * Used for hostname aliases beyond the canonical HOSPEDA_SITE_URL /
     * HOSPEDA_ADMIN_URL — e.g. staging.hospeda.com.ar and
     * staging-admin.hospeda.com.ar during pre-launch, where the same
     * containers serve both a prod-naming and a staging hostname.
     * Without this, sign-up and OAuth flows from those aliases get
     * rejected: CORS preflight 204 with no Access-Control-Allow-Origin
     * header (Hono), or origin-not-trusted (Better Auth).
     */
    HOSPEDA_EXTRA_TRUSTED_ORIGINS: z.string().optional(),

    // Email / Notifications (provider-agnostic; currently Brevo via @repo/email)
    HOSPEDA_EMAIL_API_KEY: z.string().optional(),
    HOSPEDA_EMAIL_FROM_EMAIL: z.string().email().optional(),
    HOSPEDA_EMAIL_FROM_NAME: z.string().optional(),
    /** Comma-separated list of admin emails for system notifications */
    HOSPEDA_ADMIN_NOTIFICATION_EMAILS: z.string().optional(),
    /**
     * Numeric Brevo Contacts list ID for PRE-LAUNCH newsletter signups
     * (the coming-soon landing form at hospeda.com.ar, POST
     * /api/v1/public/newsletter). Distinct from any post-launch newsletter
     * list so the pre-launch cohort stays separated. Reuses
     * HOSPEDA_EMAIL_API_KEY for authentication. When unset the endpoint
     * short-circuits to a logged fake-success so the form never blocks the user.
     */
    HOSPEDA_BREVO_PRELAUNCH_NEWSLETTER_LIST_ID: z.coerce.number().int().positive().optional(),

    // Newsletter (SPEC-101)
    /** HMAC-SHA256 secret for verification + unsubscribe tokens. Min 32 bytes. */
    HOSPEDA_NEWSLETTER_HMAC_SECRET: z.string().min(32).optional(),
    /** Previous HMAC secret, accepted during the rotation window. */
    HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV: z.string().min(32).optional(),
    /** Static secret Brevo echoes in X-Sib-Webhook-Token. Min 10 bytes. */
    HOSPEDA_BREVO_WEBHOOK_SECRET: z.string().min(10).optional(),
    /** Rolling window (days) for the per-subscriber send frequency soft cap. */
    HOSPEDA_NEWSLETTER_SOFTCAP_DAYS: z.coerce.number().int().min(1).max(365).default(7),
    /** Recipients per Brevo `messageVersions` batch call (Brevo limit 100). */
    HOSPEDA_NEWSLETTER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(100),
    /** BullMQ worker concurrency for the newsletter dispatch queue. */
    HOSPEDA_NEWSLETTER_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(5),
    /** WhatsApp channel invite URL. When unset, the welcome-email CTA is hidden. */
    HOSPEDA_NEWSLETTER_WA_CHANNEL_URL: z.string().url().optional(),

    // Sentry
    HOSPEDA_SENTRY_DSN: z.string().optional(),
    // PostHog (AI event analytics — optional, no-op when unset)
    /** PostHog project API key for server-side AI event analytics (e.g. 'phc_xxx'). */
    HOSPEDA_POSTHOG_KEY: z.string().optional(),
    /** PostHog API host. Defaults to 'https://us.i.posthog.com' when unset. */
    HOSPEDA_POSTHOG_HOST: z.string().url().optional(),
    HOSPEDA_SENTRY_RELEASE: z.string().optional(),
    HOSPEDA_SENTRY_PROJECT: z.string().optional(),
    /**
     * Sentry environment tag. When set, takes precedence over NODE_ENV
     * for Sentry event tagging — lets prod and staging both run with
     * NODE_ENV=production (preserving prod-like behavior like
     * tracesSampleRate>0) while still separating events in the Sentry
     * dashboard. Recommended values: `production`, `staging`.
     */
    HOSPEDA_SENTRY_ENVIRONMENT: z.string().optional(),

    // Media / Cloudinary
    /** Cloudinary cloud name (cloud_name in Cloudinary dashboard) */
    HOSPEDA_CLOUDINARY_CLOUD_NAME: z.string().optional(),
    /** Cloudinary API key */
    HOSPEDA_CLOUDINARY_API_KEY: z.string().optional(),
    /** Cloudinary API secret */
    HOSPEDA_CLOUDINARY_API_SECRET: z.string().optional(),
    /** Maximum upload file size in MB for media endpoints (default: 10) */
    HOSPEDA_MEDIA_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10),

    // Account lockout (brute-force protection)
    /** Max failed login attempts before temporary lockout (default: 5) */
    HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    /** Lockout window in milliseconds (default: 900000 = 15 min) */
    HOSPEDA_AUTH_LOCKOUT_WINDOW_MS: z.coerce.number().int().positive().default(900000),

    // Content moderation blocklists (SPEC-166)
    /**
     * Comma-separated list of word substrings to block in user-generated text
     * (messages, reviews, posts). Case-insensitive substring match.
     * Parsed at startup by @repo/content-moderation. Example: "badword,spam,forbidden"
     */
    HOSPEDA_MESSAGING_BLOCKED_WORDS: z.string().optional(),
    /**
     * Comma-separated list of domain names to block when they appear in URLs
     * inside user-generated text. Matches exact hostname and sub-domain suffixes.
     * Parsed at startup by @repo/content-moderation. Example: "spam.com,evil.org"
     */
    HOSPEDA_MESSAGING_BLOCKED_DOMAINS: z.string().optional(),

    // Content auto-moderation engine (SPEC-195)
    /** Moderation engine provider: 'openai' | 'local' | 'stub' (kill-switch). Default 'stub' preserves v1 binary behavior. */
    HOSPEDA_MODERATION_PROVIDER: z.enum(['openai', 'local', 'stub']).default('stub'),
    /** OpenAI API key for the Moderation API. Required when HOSPEDA_MODERATION_PROVIDER=openai. */
    HOSPEDA_OPENAI_API_KEY: z.string().min(1).optional(),
    /** TTL in seconds for the in-memory LRU moderation cache. */
    HOSPEDA_MODERATION_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    /** Timeout in ms for the OpenAI Moderation API call before falling back to local. */
    HOSPEDA_MODERATION_TIMEOUT_MS: z.coerce.number().int().positive().default(1500),
    /**
     * Gates the startup moderation-credential healthcheck (SPEC-198). When `true`,
     * the API refuses to start (process.exit(1)) if no resolvable OpenAI credential
     * exists in the AI vault. Default `false` so envs without AI moderation boot
     * normally. Set to `true` in production once the vault credential is provisioned.
     *
     * Uses the string→boolean transform (NOT z.coerce.boolean()) so the literal
     * 'false' evaluates to false — see the footgun note on HOSPEDA_DISABLE_AUTH.
     */
    HOSPEDA_AI_MODERATION_REQUIRED: z
        .string()
        .optional()
        .transform((v) => v === 'true'),

    // Infrastructure
    HOSPEDA_REDIS_URL: z.string().optional(),

    /**
     * Storage backend for the sliding-window per-user rate limiter (SPEC-079).
     * - 'memory': in-process Map (default, suitable for single-instance dev/staging)
     * - 'redis': Redis sorted sets via ioredis (recommended for multi-instance production)
     * Falls back to in-memory automatically when 'redis' is selected but Redis is unavailable.
     */
    HOSPEDA_RATE_LIMIT_BACKEND: z.enum(['memory', 'redis']).default('memory'),

    /**
     * Maximum number of active collections (wishlists) a user may have.
     * Soft-deleted collections are excluded from this count.
     * Used by `UserBookmarkCollectionService._canCreate` to enforce the limit.
     * Default: 10. Range: 1–10000.
     */
    HOSPEDA_MAX_COLLECTIONS_PER_USER: z.coerce.number().int().min(1).max(10000).default(10),

    // AI / Credential Vault
    // Decision (owner-approved 2026-06-04): base-optional so non-production envs
    // (local dev / test / CI) where the AI feature is not yet active do not fail
    // at boot. In PRODUCTION the key is REQUIRED — enforced by the cross-field
    // `.superRefine` below (NODE_ENV === 'production' + missing → validation
    // error). The vault crypto (T-021) still throws at runtime with a clear
    // error if the key is accessed-but-missing in a non-production env.
    HOSPEDA_AI_VAULT_MASTER_KEY: z
        .string()
        .min(32, 'HOSPEDA_AI_VAULT_MASTER_KEY must be at least 32 characters')
        .optional()
});

/**
 * API-specific environment schema with cross-field validation.
 * All variables use the HOSPEDA_* prefix for consistency.
 *
 * The `.superRefine` block enforces production constraints (CRON_SECRET,
 * REDIS_URL), OAuth secret/ID pairing, and localhost rejection in CORS/CSRF
 * origins. The plain key set lives in {@link ApiEnvBaseSchema}.
 */
const ApiEnvSchema = ApiEnvBaseSchema.superRefine((data, ctx) => {
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
    // AI credential vault master key is REQUIRED in production: the vault crypto
    // cannot decrypt provider credentials without it, so a missing key would let
    // the API boot but fail every AI call at runtime. Fail fast at startup instead.
    if (
        data.NODE_ENV === 'production' &&
        (!data.HOSPEDA_AI_VAULT_MASTER_KEY || data.HOSPEDA_AI_VAULT_MASTER_KEY.trim() === '')
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['HOSPEDA_AI_VAULT_MASTER_KEY'],
            message:
                'HOSPEDA_AI_VAULT_MASTER_KEY is required in production (vault crypto cannot decrypt AI provider credentials without it)'
        });
    }
    // OAuth cross-validation: require secret when client ID is set
    if (data.HOSPEDA_GOOGLE_CLIENT_ID && !data.HOSPEDA_GOOGLE_CLIENT_SECRET) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['HOSPEDA_GOOGLE_CLIENT_SECRET'],
            message: 'HOSPEDA_GOOGLE_CLIENT_SECRET is required when HOSPEDA_GOOGLE_CLIENT_ID is set'
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
    // Production safety: reject test/debug flags that would weaken security if accidentally set.
    // These have use-site gates today, but a future refactor could drop them silently. The
    // schema-level guard ensures the deploy fails fast at startup.
    if (data.NODE_ENV === 'production') {
        if (data.HOSPEDA_API_DEBUG_ERRORS === true) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['HOSPEDA_API_DEBUG_ERRORS'],
                message:
                    'HOSPEDA_API_DEBUG_ERRORS must not be true in production (would leak stack traces)'
            });
        }
        if (data.HOSPEDA_DISABLE_AUTH === true) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['HOSPEDA_DISABLE_AUTH'],
                message: 'HOSPEDA_DISABLE_AUTH must not be true in production (auth bypass)'
            });
        }
        if (data.HOSPEDA_ALLOW_MOCK_ACTOR === true) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['HOSPEDA_ALLOW_MOCK_ACTOR'],
                message:
                    'HOSPEDA_ALLOW_MOCK_ACTOR must not be true in production (impersonation vector)'
            });
        }
        if (data.HOSPEDA_DEBUG_TESTS === true) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['HOSPEDA_DEBUG_TESTS'],
                message: 'HOSPEDA_DEBUG_TESTS must not be true in production (log spam)'
            });
        }
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
    // Guard against test environments where apiLogger may be a partial mock
    if (typeof apiLogger.log === 'function') {
        apiLogger.log(env, 'validateApiEnv');
    }
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
