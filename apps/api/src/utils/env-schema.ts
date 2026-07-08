/**
 * @file env-schema.ts
 * @description Pure, zero-side-effect Zod schema for the API environment.
 *
 * This file MUST import ONLY from `zod`. No `dotenv`, no `@repo/logger`, no
 * Node `fs`/`path` helpers, no other app or package imports. That purity is
 * what lets a plain root-level script (`tsx`, no Vite/bundler, no dotenv
 * bootstrap) safely `import` the real API env schema for introspection
 * (HOS-79 — Env Var Management Hardening).
 *
 * `env.ts` re-exports {@link ApiEnvBaseSchema} from here and is responsible
 * for everything with side effects: loading `.env.local`/`.env.test` via
 * `dotenv`, logging via `@repo/logger`, and cross-field validation via
 * `.superRefine`.
 *
 * A guard test (`test/utils/env-schema-purity.guard.test.ts`) asserts this
 * file never re-acquires a non-zod import.
 */
import { z } from 'zod';

/**
 * String→boolean env parser.
 *
 * `z.coerce.boolean()` runs `Boolean(string)`, so ANY non-empty string —
 * including the literal `'false'` — coerces to `true`; the only way to get
 * `false` is an empty string. That footgun silently defeats every
 * `SOMEVAR=false` an operator sets in Coolify.
 *
 * This helper instead treats only the literal `'true'` (case-insensitive) as
 * `true`, everything else (`'false'`, `'0'`, `''`) as `false`, and an unset var
 * as the provided default — matching every operator's mental model. Mirrors the
 * transform already used for `HOSPEDA_DISABLE_AUTH` et al. Kept zod-only so this
 * module stays import-pure (see the file header).
 *
 * @param defaultValue - Value used when the env var is unset.
 */
export const boolEnv = (defaultValue: boolean) =>
    z
        .string()
        .optional()
        .transform((v) => (v === undefined ? defaultValue : v.toLowerCase() === 'true'));

/**
 * Base shape of the API environment schema.
 *
 * Exported separately from the `.superRefine`-wrapped `ApiEnvSchema` (defined
 * in `env.ts`) so consumers (notably the env-registry cross-validation test
 * and the HOS-79 registry-JSON generator) can enumerate `.shape` keys
 * directly, which is not possible on the wrapped `ZodEffects` returned by
 * `.superRefine(...)`.
 *
 * Add new env vars HERE; the `.superRefine` block in `ApiEnvSchema`
 * (`env.ts`) is reserved for cross-field validation.
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
    HOSPEDA_ADMIN_URL: z.string().url(),

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
    API_ENABLE_REQUEST_LOGGING: boolEnv(true),
    API_LOG_INCLUDE_TIMESTAMPS: boolEnv(true),
    API_LOG_INCLUDE_LEVEL: boolEnv(true),
    API_LOG_USE_COLORS: boolEnv(true),
    API_LOG_SAVE: boolEnv(false),
    API_LOG_EXPAND_OBJECTS: boolEnv(false),
    API_LOG_TRUNCATE_TEXT: boolEnv(true),
    API_LOG_TRUNCATE_AT: z.coerce.number().default(1000),
    API_LOG_STRINGIFY: boolEnv(false),
    // Console output format. Left OPTIONAL (no static default) on purpose: the
    // effective default is env-aware and resolved at bootstrap in index.ts —
    // unset → `json` in production (clean Coolify console parsing), `pretty` in
    // development. An explicit value always wins. This only affects the CONSOLE;
    // the app_log_entries DB sink is a separate structured hook, unaffected.
    API_LOG_FORMAT: z
        .string()
        .transform((val) => val.toLowerCase())
        .pipe(z.enum(['pretty', 'json']))
        .optional(),

    // CORS
    API_CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:4321'),
    API_CORS_ALLOW_CREDENTIALS: boolEnv(true),
    API_CORS_MAX_AGE: z.coerce.number().default(86400),
    API_CORS_ALLOW_METHODS: z.string().default('GET,POST,PUT,DELETE,PATCH,OPTIONS'),
    API_CORS_ALLOW_HEADERS: z.string().default('Content-Type,Authorization,X-Requested-With'),
    API_CORS_EXPOSE_HEADERS: z.string().default('Content-Length,X-Request-ID'),

    // Cache
    API_CACHE_ENABLED: boolEnv(true),
    API_CACHE_DEFAULT_MAX_AGE: z.coerce.number().default(300),
    API_CACHE_DEFAULT_STALE_WHILE_REVALIDATE: z.coerce.number().default(60),
    API_CACHE_DEFAULT_STALE_IF_ERROR: z.coerce.number().default(86400),
    API_CACHE_ETAG_ENABLED: boolEnv(true),
    API_CACHE_LAST_MODIFIED_ENABLED: boolEnv(true),

    // Compression
    API_COMPRESSION_ENABLED: boolEnv(true),
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
    API_RATE_LIMIT_ENABLED: boolEnv(true),
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
    API_RATE_LIMIT_TRUST_PROXY: boolEnv(true),
    API_RATE_LIMIT_TRUSTED_PROXIES: z.string().default(''),
    /**
     * Shared secret that exempts internal server-to-server SSR traffic from the
     * public rate limit (HOS-103). The web app sends it as the `X-Internal-Request`
     * header on SSR fetches; a request whose header matches this value bypasses
     * `rateLimitMiddleware` entirely. MUST equal the web app's
     * `HOSPEDA_INTERNAL_REQUEST_SECRET`. Fails safe: when unset (default empty),
     * NO request is ever exempted — the header is ignored — so a misconfiguration
     * degrades to normal rate limiting, never to an open bypass. Compared in
     * constant time to avoid leaking it via timing.
     */
    HOSPEDA_INTERNAL_REQUEST_SECRET: z.string().default(''),

    // Rate Limiting - auth / public / admin tiers
    API_RATE_LIMIT_AUTH_ENABLED: boolEnv(true),
    API_RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().default(300000),
    API_RATE_LIMIT_AUTH_MAX_REQUESTS: z.coerce.number().default(50),
    API_RATE_LIMIT_AUTH_MESSAGE: z
        .string()
        .default('Too many authentication requests, please try again later.'),
    API_RATE_LIMIT_PUBLIC_ENABLED: boolEnv(true),
    API_RATE_LIMIT_PUBLIC_WINDOW_MS: z.coerce.number().default(3600000),
    API_RATE_LIMIT_PUBLIC_MAX_REQUESTS: z.coerce.number().default(1000),
    API_RATE_LIMIT_PUBLIC_MESSAGE: z
        .string()
        .default('Too many API requests, please try again later.'),
    API_RATE_LIMIT_ADMIN_ENABLED: boolEnv(true),
    API_RATE_LIMIT_ADMIN_WINDOW_MS: z.coerce.number().default(600000),
    API_RATE_LIMIT_ADMIN_MAX_REQUESTS: z.coerce.number().default(200),
    API_RATE_LIMIT_ADMIN_MESSAGE: z
        .string()
        .default('Too many admin requests, please try again later.'),

    // Security
    API_SECURITY_ENABLED: boolEnv(true),
    API_SECURITY_CSRF_ENABLED: boolEnv(true),
    API_SECURITY_HEADERS_ENABLED: boolEnv(true),
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
    API_RESPONSE_FORMAT_ENABLED: boolEnv(true),
    API_RESPONSE_INCLUDE_TIMESTAMP: boolEnv(true),
    /**
     * API version string injected into responses. Empty string disables version inclusion.
     * Default '1.0.0' (include version). Set to '' to omit version from response envelope and headers.
     */
    API_RESPONSE_API_VERSION: z.string().default('1.0.0'),
    API_RESPONSE_INCLUDE_REQUEST_ID: boolEnv(true),
    API_RESPONSE_INCLUDE_METADATA: boolEnv(true),
    API_RESPONSE_SUCCESS_MESSAGE: z.string().default('Success'),
    API_RESPONSE_ERROR_MESSAGE: z.string().default('An error occurred'),

    // Validation
    API_VALIDATION_MAX_BODY_SIZE: z.coerce.number().default(10485760),
    API_VALIDATION_MAX_REQUEST_TIME: z.coerce.number().default(30000),
    API_VALIDATION_ALLOWED_CONTENT_TYPES: z
        .string()
        .default('application/json,multipart/form-data'),
    API_VALIDATION_REQUIRED_HEADERS: z.string().default('user-agent'),
    API_VALIDATION_AUTH_ENABLED: boolEnv(true),
    API_VALIDATION_AUTH_HEADERS: z.string().default('authorization'),
    API_VALIDATION_SANITIZE_ENABLED: boolEnv(true),
    API_VALIDATION_SANITIZE_MAX_STRING_LENGTH: z.coerce.number().default(1000),
    API_VALIDATION_SANITIZE_REMOVE_HTML_TAGS: boolEnv(true),
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
    API_METRICS_ENABLED: boolEnv(true),
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
    /**
     * Cloudflare Turnstile secret key for server-side token verification (SPEC-301).
     * When set, every public feedback submission is verified via the Turnstile siteverify
     * endpoint before creating a Linear issue. Missing token or siteverify failure → 403
     * (fail-closed, R-2). When unset, the route also rejects — dev must set the test key.
     */
    HOSPEDA_TURNSTILE_SECRET_KEY: z.string().optional(),

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
    HOSPEDA_REVALIDATION_SECRET: z.string().min(32),
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
     * Slug of the billing plan used to provision a commerce-listing subscription
     * (SPEC-239 T-049). Resolved by slug against `billing_plans.name` via the
     * same `resolvePlanBySlug` machinery the accommodation start-paid flow uses.
     * Optional: the commerce start-subscription route 404s when unset or unknown.
     */
    HOSPEDA_COMMERCE_PLAN_ID: z.string().optional(),

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

    // Newsletter (SPEC-101)
    /** HMAC-SHA256 secret for verification + unsubscribe tokens. Min 32 bytes. */
    HOSPEDA_NEWSLETTER_HMAC_SECRET: z.string().min(32),
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
    /** OpenAI API key for the content-moderation engine. Required when HOSPEDA_MODERATION_PROVIDER=openai. */
    HOSPEDA_MODERATION_OPENAI_API_KEY: z.string().min(1).optional(),
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
     * Platform-wide default minimum price-drop percentage (SPEC-286 G-1)
     * that triggers a tourist's price-drop alert when the alert's own
     * `targetPercentDrop` is `null` ("notify on any drop"). Read directly by
     * `PriceDropEvaluatorService` (`@repo/service-core`) via `process.env` —
     * this schema entry exists for registry cross-validation and doc
     * generation, not because the service imports this module. Default: 5.
     */
    HOSPEDA_ALERT_PRICE_DROP_THRESHOLD_PCT: z.coerce.number().default(5),

    /**
     * Testing-only override for the host publish-flow trial length, in days.
     * When set to a positive integer it replaces the `OWNER_TRIAL_DAYS` (14)
     * constant used by `TrialService.startTrial`, so a QA run can exercise trial
     * expiry after e.g. 1 day instead of waiting 14.
     *
     * Deliberately NOT gated by environment: `NODE_ENV` is `'production'` on BOTH
     * the prod and staging deployments (so it cannot distinguish them), and testing
     * must be possible against production. It is an explicit ops knob — it affects
     * EVERY trial started while it is set, so the operator sets it, runs the test,
     * then UNSETS it. Optional (no default) so the absence of the var yields
     * `undefined` and the constant path is taken. Unset by default everywhere.
     */
    HOSPEDA_TRIAL_DAYS_OVERRIDE: z.coerce.number().int().positive().optional(),

    /**
     * Testing-only flag that exposes and enables subscribing to the hidden
     * daily test billing plan (`owner-test-daily`, `@repo/billing`
     * `TEST_DAILY_PLAN`). When `false` (default), `resolvePlanBySlug` in
     * `apps/api/src/services/subscription-checkout.service.ts` rejects the
     * plan slug with `PLAN_NOT_FOUND` even though the row always exists in
     * `billing_plans`/`billing_prices` (seeded unconditionally). When `true`,
     * the plan resolves normally and a checkout against it creates a REAL
     * MercadoPago recurring preapproval that charges every 1 day.
     *
     * Deliberately NOT gated by environment: `NODE_ENV` is `'production'` on
     * BOTH the prod and staging deployments (so it cannot distinguish them),
     * and testing the full recurring-charge lifecycle must be possible
     * against production (the MP sandbox on staging is unreliable). It is an
     * explicit ops knob — while it is `true`, ANY authenticated caller who
     * knows the `owner-test-daily` slug can trigger a REAL daily charge in
     * prod. Set it, run the test, then UNSET it. Unset by default everywhere.
     *
     * Uses the string→boolean transform (NOT z.coerce.boolean()) so the
     * literal 'false' evaluates to false — see the footgun note on
     * HOSPEDA_DISABLE_AUTH.
     */
    HOSPEDA_SHOW_TEST_BILLING_PLAN: z
        .string()
        .optional()
        .transform((v) => v === 'true'),

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
        .optional(),

    // Accommodation import (SPEC-222)
    /** Apify API token for the Airbnb scraper actor and Booking.com fallback adapter */
    HOSPEDA_APIFY_TOKEN: z.string().optional(),
    /**
     * Apify actor ID/slug for the Airbnb rooms/detail scraper (swappable without a code deploy).
     *
     * Defaults to `tri_angle/airbnb-rooms-urls-scraper` — the actor that accepts
     * /rooms/ detail URLs. Do NOT use `tri_angle/airbnb-scraper` (search scraper),
     * which rejects detail URLs and returns an empty dataset.
     */
    HOSPEDA_APIFY_AIRBNB_ACTOR: z.string().default('tri_angle/airbnb-rooms-urls-scraper'),
    /** Apify actor ID/slug for the Booking.com scraper fallback (swappable without a code deploy) */
    HOSPEDA_APIFY_BOOKING_ACTOR: z.string().default('voyager/booking-scraper'),
    /** Google Places API (New) key for the Google Maps import tier */
    HOSPEDA_GOOGLE_PLACES_API_KEY: z.string().optional(),
    /** MercadoLibre OAuth app client ID (HOS-45 OAuth refresh flow). Optional: required only in environments where the ML import tier is enabled. */
    HOSPEDA_MERCADOLIBRE_CLIENT_ID: z.string().optional(),
    /** MercadoLibre OAuth app client secret (HOS-45 OAuth refresh flow) */
    HOSPEDA_MERCADOLIBRE_CLIENT_SECRET: z.string().optional(),
    /** MercadoLibre OAuth redirect URI registered on the ML app (HOS-45 OAuth refresh flow) */
    HOSPEDA_MERCADOLIBRE_REDIRECT_URI: z.string().optional(),
    /**
     * AES-256-GCM master key for the OAuth credentials vault (HOS-45). Provider-agnostic
     * name (NOT ML-specific) because the encrypted credentials table is designed to extend
     * to future OAuth providers beyond MercadoLibre. Optional until the OAuth vault is wired
     * everywhere; required in environments where the ML import tier is enabled.
     */
    HOSPEDA_OAUTH_VAULT_MASTER_KEY: z.string().optional(),
    /** Timeout in milliseconds for the safeExternalFetch utility used in import adapters */
    HOSPEDA_IMPORT_FETCH_TIMEOUT_MS: z.coerce.number().default(8000),
    /** Timeout in milliseconds for synchronous Apify actor runs in import adapters (Airbnb, Booking fallback); actors take 8-120s so they get a longer budget than the fetch timeout */
    HOSPEDA_IMPORT_APIFY_TIMEOUT_MS: z.coerce.number().default(120000),
    /** Maximum response body size in bytes for the safeExternalFetch utility used in import adapters */
    HOSPEDA_IMPORT_FETCH_MAX_BYTES: z.coerce.number().default(3000000),
    /** Per-user rate limit (requests per hour) for the accommodation import endpoint */
    HOSPEDA_IMPORT_RATE_LIMIT_RPH: z.coerce.number().default(10),
    /** Maximum characters of scraped page text sent to the AI Strategy B enrichment step */
    HOSPEDA_IMPORT_AI_MAX_CHARS: z.coerce.number().default(12000),

    // Stock image search (SPEC-274)
    /** Unsplash API access key (Client-ID) for stock image search proxy */
    HOSPEDA_UNSPLASH_ACCESS_KEY: z.string().optional(),
    /** Pexels API key for stock image search proxy */
    HOSPEDA_PEXELS_API_KEY: z.string().optional(),

    // Social Automation (SPEC-254)
    /**
     * AES-256-GCM master key for the social credentials vault (HOS-64 G-4).
     * Separate blast radius from HOSPEDA_AI_VAULT_MASTER_KEY — do not reuse.
     * Optional until the vault data migration (T-025/T-033) runs.
     */
    HOSPEDA_SOCIAL_VAULT_MASTER_KEY: z
        .string()
        .min(32, 'HOSPEDA_SOCIAL_VAULT_MASTER_KEY must be at least 32 characters')
        .optional(),

    // External reputation / review aggregation (SPEC-237)
    /**
     * How many days a Google Places snippet is considered fresh before the background
     * cron re-fetches it. Lower values keep ratings current at the cost of more API quota.
     * Default 30.
     */
    HOSPEDA_EXTREP_GOOGLE_SNIPPET_TTL_DAYS: z.coerce.number().int().min(1).default(30),
    /**
     * Per-accommodation rate limit for the manual snippet refresh endpoint.
     * Format: "N/S" — N refreshes per S seconds. Default "1/600" (1 per 10 min).
     * A malformed value (not matching N/S) fails fast at boot (FIX L2).
     */
    HOSPEDA_EXTREP_REFRESH_RATE_LIMIT: z
        .string()
        .regex(/^\d+\/\d+$/, 'must be in N/S format e.g. 1/600')
        .default('1/600'),
    /**
     * Cron expression for the background job that refreshes stale Google Places snippets.
     * Default "0 2 * * 1" runs every Monday at 02:00 UTC.
     */
    HOSPEDA_EXTREP_CRON_SCHEDULE: z.string().default('0 2 * * 1'),

    // External reputation async polling (SPEC-250)
    /**
     * Cron expression for the poll-apify-reputation-runs job that checks the status
     * of pending/running Apify actor runs and persists results.
     * Default: every 2 minutes (step-2 cron). See env.example for the exact value.
     */
    HOSPEDA_EXTREP_POLL_SCHEDULE: z.string().default('*/2 * * * *'),
    /**
     * Milliseconds before the poller sweeps a pending/running Apify run as timed out
     * and marks it fetch_status='error'. Default 600000 (10 minutes).
     */
    HOSPEDA_EXTREP_APIFY_RUN_TIMEOUT_MS: z.coerce.number().int().min(1).default(600_000)
});
