/**
 * HOSPEDA_* environment variable definitions for the Hospeda monorepo.
 *
 * This module contains only the server-side `HOSPEDA_*` prefixed variables.
 * It is re-exported from `env-registry.ts` as part of the full `ENV_REGISTRY`.
 *
 * @module env-registry.hospeda
 */
import type { EnvVarDefinition } from './env-registry-types.js';

/**
 * All `HOSPEDA_*` environment variable definitions grouped by logical category.
 *
 * @example
 * ```ts
 * import { HOSPEDA_ENV_VARS } from './env-registry.hospeda.js';
 * const secretVars = HOSPEDA_ENV_VARS.filter(v => v.secret);
 * ```
 */
export const HOSPEDA_ENV_VARS = [
    // -------------------------------------------------------------------------
    // Core
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_API_URL',
        description: 'API base URL',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:3001',
        apps: ['api', 'web', 'admin'],
        category: 'core'
    },
    {
        name: 'HOSPEDA_SITE_URL',
        description: 'Web app base URL',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:4321',
        apps: ['api', 'web'],
        category: 'core'
    },
    {
        name: 'HOSPEDA_ADMIN_URL',
        description: 'Admin app URL (CORS, server-side links from web)',
        type: 'url',
        required: false,
        secret: false,
        exampleValue: 'http://localhost:3000',
        apps: ['api', 'web'],
        category: 'core'
    },

    // -------------------------------------------------------------------------
    // Database
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_DATABASE_URL',
        description: 'PostgreSQL connection string',
        type: 'url',
        required: true,
        secret: true,
        exampleValue: 'postgresql://user:password@host:5432/dbname',
        apps: ['api', 'seed'],
        category: 'database'
    },
    {
        name: 'HOSPEDA_DB_POOL_MAX_CONNECTIONS',
        description: 'DB pool max connections',
        type: 'number',
        required: false,
        secret: false,
        exampleValue: '10',
        apps: ['api'],
        category: 'database'
    },
    {
        name: 'HOSPEDA_DB_POOL_IDLE_TIMEOUT_MS',
        description: 'DB pool idle timeout',
        type: 'number',
        required: false,
        secret: false,
        exampleValue: '30000',
        apps: ['api'],
        category: 'database'
    },
    {
        name: 'HOSPEDA_DB_POOL_CONNECTION_TIMEOUT_MS',
        description: 'DB pool connection timeout',
        type: 'number',
        required: false,
        secret: false,
        exampleValue: '5000',
        apps: ['api'],
        category: 'database'
    },
    {
        name: 'HOSPEDA_SEED_SUPER_ADMIN_PASSWORD',
        description: 'Super admin password for seeding',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-super-admin-password',
        apps: ['seed'],
        category: 'database'
    },

    // -------------------------------------------------------------------------
    // Auth
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_BETTER_AUTH_SECRET',
        description: 'Better Auth session signing secret',
        type: 'string',
        required: true,
        secret: true,
        exampleValue: 'your-secret-key-minimum-32-characters-long',
        apps: ['api'],
        category: 'auth'
    },
    {
        name: 'HOSPEDA_LOCATION_SALT',
        description:
            'Server-only salt for deterministic accommodation location obfuscation (privacy-aware approximate coordinates). Must be at least 32 characters; rotating changes all approximate locations shown to public visitors.',
        type: 'string',
        required: true,
        secret: true,
        exampleValue: 'replace-with-32-plus-char-random-string-from-openssl',
        apps: ['api'],
        category: 'auth'
    },
    {
        name: 'HOSPEDA_GEOCODING_USER_AGENT',
        description:
            'User-Agent header sent to Photon (Komoot) and Nominatim (OSM) when the admin location picker queries them. Required by Nominatim usage policy; missing or generic values may cause throttling.',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'Hospeda/1.0 (https://hospeda.ar)',
        apps: ['api'],
        category: 'auth'
    },
    {
        name: 'HOSPEDA_BETTER_AUTH_URL',
        description: 'Better Auth endpoint URL',
        type: 'url',
        required: true,
        secret: false,
        exampleValue: 'http://localhost:3001/api/auth',
        apps: ['api', 'web'],
        category: 'auth'
    },
    {
        name: 'HOSPEDA_GOOGLE_CLIENT_ID',
        description: 'Google OAuth client ID',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-google-client-id',
        apps: ['api'],
        category: 'auth'
    },
    {
        name: 'HOSPEDA_GOOGLE_CLIENT_SECRET',
        description: 'Google OAuth secret',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-google-client-secret',
        apps: ['api'],
        category: 'auth'
    },
    {
        name: 'HOSPEDA_FACEBOOK_CLIENT_ID',
        description: 'Facebook OAuth client ID',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-facebook-client-id',
        apps: ['api'],
        category: 'auth'
    },
    {
        name: 'HOSPEDA_FACEBOOK_CLIENT_SECRET',
        description: 'Facebook OAuth secret',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-facebook-client-secret',
        apps: ['api'],
        category: 'auth'
    },

    // -------------------------------------------------------------------------
    // Cache
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_REDIS_URL',
        description: 'Redis URL for rate limiting',
        type: 'url',
        required: false,
        secret: true,
        exampleValue: 'redis://localhost:6379',
        apps: ['api'],
        category: 'cache'
    },
    {
        name: 'HOSPEDA_RATE_LIMIT_BACKEND',
        description:
            'Storage backend for the sliding-window per-user rate limiter. "memory" uses an in-process Map (single-instance dev/staging). "redis" uses Redis sorted sets for distributed multi-instance deployments. Falls back to in-memory when Redis is unavailable.',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'memory',
        exampleValue: 'redis',
        enumValues: ['memory', 'redis'] as const,
        apps: ['api'],
        category: 'cache'
    },

    // -------------------------------------------------------------------------
    // Billing
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN',
        description: 'MercadoPago API token',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'TEST-xxxx-xxxx',
        apps: ['api'],
        category: 'billing'
    },
    {
        name: 'HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET',
        description: 'MercadoPago webhook signature secret',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'whsec_xxxx',
        apps: ['api'],
        category: 'billing'
    },
    {
        name: 'HOSPEDA_MERCADO_PAGO_SANDBOX',
        description: 'Enable MercadoPago sandbox mode',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'billing'
    },
    {
        name: 'HOSPEDA_MERCADO_PAGO_TIMEOUT',
        description: 'MercadoPago API request timeout in ms',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '5000',
        exampleValue: '5000',
        apps: ['api'],
        category: 'billing'
    },
    {
        name: 'HOSPEDA_MERCADO_PAGO_PLATFORM_ID',
        description: 'MercadoPago platform ID for marketplace tracking',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'MP-PLATFORM-ID',
        apps: ['api'],
        category: 'billing'
    },
    {
        name: 'HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID',
        description: 'MercadoPago integrator ID for tracking',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'MP-INTEGRATOR-ID',
        apps: ['api'],
        category: 'billing'
    },

    // -------------------------------------------------------------------------
    // Email
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_RESEND_API_KEY',
        description: 'Resend email API key',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 're_xxxx',
        apps: ['api'],
        category: 'email'
    },
    {
        name: 'HOSPEDA_RESEND_FROM_EMAIL',
        description: 'Sender email address',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'noreply@hospeda.ar',
        apps: ['api'],
        category: 'email'
    },
    {
        name: 'HOSPEDA_RESEND_FROM_NAME',
        description: 'Sender display name',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'Hospeda',
        apps: ['api'],
        category: 'email'
    },
    {
        name: 'HOSPEDA_ADMIN_NOTIFICATION_EMAILS',
        description: 'Comma-separated admin emails for dispute/webhook notifications',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'admin@hospeda.ar',
        apps: ['api'],
        category: 'email'
    },

    // -------------------------------------------------------------------------
    // Cron
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_CRON_SECRET',
        description: 'Cron endpoint auth secret',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-cron-secret',
        apps: ['api'],
        category: 'cron'
    },
    {
        name: 'HOSPEDA_CRON_ADAPTER',
        description: 'Cron scheduler type',
        type: 'enum',
        required: false,
        secret: false,
        exampleValue: 'manual',
        enumValues: ['manual', 'vercel', 'node-cron'] as const,
        apps: ['api'],
        category: 'cron'
    },
    {
        name: 'HOSPEDA_REVALIDATION_SECRET',
        description:
            'Shared secret for authenticating ISR revalidation requests from the API. Min 32 characters.',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'a-secret-string-of-at-least-32-characters',
        apps: ['api', 'web'],
        category: 'cron'
    },
    {
        name: 'HOSPEDA_REVALIDATION_CRON_SCHEDULE',
        description: 'Cron schedule for automatic page revalidation',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '0 * * * *',
        exampleValue: '0 * * * *',
        apps: ['api'],
        category: 'cron'
    },

    // -------------------------------------------------------------------------
    // Addon lifecycle
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_ADDON_LIFECYCLE_ENABLED',
        description:
            'Feature flag for addon lifecycle processing (cancellations, plan changes, expiry). Set to "false" to disable side-effects without deploying code.',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'billing'
    },

    // -------------------------------------------------------------------------
    // Auth lockout (brute-force protection)
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS',
        description: 'Max failed login attempts before temporary lockout',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '5',
        exampleValue: '5',
        apps: ['api'],
        category: 'auth'
    },
    {
        name: 'HOSPEDA_AUTH_LOCKOUT_WINDOW_MS',
        description: 'Lockout window in milliseconds (default 900000 = 15 min)',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '900000',
        exampleValue: '900000',
        apps: ['api'],
        category: 'auth'
    },

    // -------------------------------------------------------------------------
    // Integrations
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_LINEAR_API_KEY',
        description: 'Linear bug report API key',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'lin_api_xxxx',
        apps: ['api'],
        category: 'integrations'
    },
    {
        name: 'HOSPEDA_LINEAR_TEAM_ID',
        description: 'Linear team ID for issue creation',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'team-id',
        apps: ['api'],
        category: 'integrations'
    },
    {
        name: 'HOSPEDA_FEEDBACK_ENABLED',
        description: 'Kill switch to disable feedback endpoint (set to "false" to disable)',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'true',
        apps: ['api'],
        category: 'integrations'
    },
    {
        name: 'HOSPEDA_FEEDBACK_FALLBACK_EMAIL',
        description: 'Email address for feedback fallback notifications when Linear is unavailable',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'feedback@hospeda.com',
        apps: ['api'],
        category: 'integrations'
    },
    {
        name: 'HOSPEDA_EXCHANGE_RATE_API_KEY',
        description: 'ExchangeRate-API key',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-api-key',
        apps: ['api'],
        category: 'integrations'
    },
    {
        name: 'HOSPEDA_DOLAR_API_BASE_URL',
        description: 'DolarAPI base URL',
        type: 'url',
        required: false,
        secret: false,
        exampleValue: 'https://dolarapi.com/v1',
        apps: ['api'],
        category: 'integrations'
    },
    {
        name: 'HOSPEDA_EXCHANGE_RATE_API_BASE_URL',
        description: 'ExchangeRate-API base URL',
        type: 'url',
        required: false,
        secret: false,
        exampleValue: 'https://v6.exchangerate-api.com/v6',
        apps: ['api'],
        category: 'integrations'
    },

    // -------------------------------------------------------------------------
    // Cloudinary (Image Management)
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_CLOUDINARY_CLOUD_NAME',
        description: 'Cloudinary account cloud name for image storage and CDN delivery',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'hospeda',
        apps: ['api', 'seed'],
        category: 'integrations'
    },
    {
        name: 'HOSPEDA_CLOUDINARY_API_KEY',
        description: 'Cloudinary API key for server-side image upload and management',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: '123456789012345',
        apps: ['api', 'seed'],
        category: 'integrations'
    },
    {
        name: 'HOSPEDA_CLOUDINARY_API_SECRET',
        description: 'Cloudinary API secret for server-side authentication',
        type: 'string',
        required: false,
        secret: true,
        exampleValue: 'your-cloudinary-api-secret',
        apps: ['api', 'seed'],
        category: 'integrations'
    },
    {
        name: 'HOSPEDA_ALLOW_PROD_CLEANUP',
        description:
            'Safety flag required to allow destructive cleanup operations (e.g. seed --clean-images) in production environments. Must be exactly "true".',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['seed'],
        category: 'integrations'
    },
    {
        name: 'HOSPEDA_MEDIA_MAX_FILE_SIZE_MB',
        description:
            'Maximum upload file size in megabytes (values above 4.5 require Vercel Pro plan)',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '10',
        exampleValue: '10',
        apps: ['api', 'seed'],
        category: 'integrations'
    },

    // -------------------------------------------------------------------------
    // Messaging
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_MESSAGING_BLOCKED_WORDS',
        description: 'Comma-separated list of blocked words for conversation content moderation',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'spam,scam,phishing',
        apps: ['api'],
        category: 'messaging'
    },
    {
        name: 'HOSPEDA_MESSAGING_BLOCKED_DOMAINS',
        description: 'Comma-separated list of email domains blocked from initiating conversations',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'mailinator.com,guerrillamail.com',
        apps: ['api'],
        category: 'messaging'
    },

    // -------------------------------------------------------------------------
    // Monitoring
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_SENTRY_DSN',
        description: 'Sentry DSN for API error tracking',
        type: 'url',
        required: false,
        secret: true,
        exampleValue: 'https://xxxx@sentry.io/xxxx',
        apps: ['api'],
        category: 'monitoring'
    },
    {
        name: 'HOSPEDA_SENTRY_RELEASE',
        description: 'Sentry release identifier',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: '1.0.0',
        apps: ['api'],
        category: 'monitoring'
    },
    {
        name: 'HOSPEDA_SENTRY_PROJECT',
        description: 'Sentry project name',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'hospeda-api',
        apps: ['api'],
        category: 'monitoring'
    },

    // -------------------------------------------------------------------------
    // Testing
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_DISABLE_AUTH',
        description: 'Bypass auth in tests',
        type: 'boolean',
        required: false,
        secret: false,
        exampleValue: 'false',
        apps: ['api'],
        category: 'testing'
    },
    {
        name: 'HOSPEDA_ALLOW_MOCK_ACTOR',
        description: 'Allow mock actors in tests',
        type: 'boolean',
        required: false,
        secret: false,
        exampleValue: 'false',
        apps: ['api'],
        category: 'testing'
    },
    {
        name: 'HOSPEDA_TESTING_RATE_LIMIT',
        description: 'Enable rate limit in tests',
        type: 'boolean',
        required: false,
        secret: false,
        exampleValue: 'false',
        apps: ['api'],
        category: 'testing'
    },
    {
        name: 'HOSPEDA_TESTING_ORIGIN_VERIFICATION',
        description: 'Enable origin check in tests',
        type: 'boolean',
        required: false,
        secret: false,
        exampleValue: 'false',
        apps: ['api'],
        category: 'testing'
    },
    {
        name: 'HOSPEDA_DEBUG_TESTS',
        description: 'Verbose test logging',
        type: 'boolean',
        required: false,
        secret: false,
        exampleValue: 'false',
        apps: ['api'],
        category: 'testing'
    },

    // -------------------------------------------------------------------------
    // Debugging
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_API_DEBUG_ERRORS',
        description: 'Show error details in responses',
        type: 'boolean',
        required: false,
        secret: false,
        exampleValue: 'false',
        apps: ['api'],
        category: 'debugging'
    },

    // -------------------------------------------------------------------------
    // Build
    // -------------------------------------------------------------------------
    {
        name: 'HOSPEDA_COMMIT_SHA',
        description: 'Build commit SHA',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'abc123',
        apps: ['api'],
        category: 'build'
    },
    {
        name: 'HOSPEDA_DEBUG_ACTOR_ID',
        description:
            'Override actor ID for admin debugging (mapped to VITE_DEBUG_ACTOR_ID at build)',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'user-uuid',
        apps: ['admin'],
        category: 'debugging'
    },
    {
        name: 'HOSPEDA_SUPPORTED_LOCALES',
        description: 'Supported locales (mapped to VITE_SUPPORTED_LOCALES at build)',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'en,es',
        exampleValue: 'en,es,pt',
        apps: ['admin'],
        category: 'i18n'
    },
    {
        name: 'HOSPEDA_DEFAULT_LOCALE',
        description: 'Default locale (mapped to VITE_DEFAULT_LOCALE at build)',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'en',
        exampleValue: 'es',
        apps: ['admin'],
        category: 'i18n'
    }
] as const satisfies readonly EnvVarDefinition[];
