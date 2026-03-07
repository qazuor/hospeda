/**
 * API-specific (`API_*`) environment variable definitions.
 *
 * These variables configure the Hono API server behaviour: server binding,
 * CORS, caching, compression, rate limiting, security headers, response
 * formatting, request validation, and metrics. All are optional with
 * production-safe defaults baked into `apps/api/src/utils/env.ts`.
 *
 * @module env-registry.api-config
 */
import type { EnvVarDefinition } from './env-registry-types.js';

/**
 * All `API_*` environment variable definitions grouped by middleware concern.
 *
 * @example
 * ```ts
 * import { API_CONFIG_ENV_VARS } from './env-registry.api-config.js';
 * const corsVars = API_CONFIG_ENV_VARS.filter(v => v.name.startsWith('API_CORS_'));
 * ```
 */
export const API_CONFIG_ENV_VARS = [
    // -------------------------------------------------------------------------
    // Server
    // -------------------------------------------------------------------------
    {
        name: 'API_PORT',
        description: 'Port the API server listens on',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '3001',
        exampleValue: '3001',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_HOST',
        description: 'Hostname/interface the API server binds to',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'localhost',
        exampleValue: '0.0.0.0',
        apps: ['api'],
        category: 'api-config'
    },
    // -------------------------------------------------------------------------
    // Logging
    // -------------------------------------------------------------------------
    {
        name: 'API_LOG_LEVEL',
        description: 'Minimum log level emitted by the API logger',
        type: 'enum',
        required: false,
        secret: false,
        defaultValue: 'info',
        exampleValue: 'info',
        enumValues: ['debug', 'info', 'warn', 'error'] as const,
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_ENABLE_REQUEST_LOGGING',
        description: 'Enable per-request access log entries',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_LOG_INCLUDE_TIMESTAMPS',
        description: 'Prepend ISO-8601 timestamp to each log line',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_LOG_INCLUDE_LEVEL',
        description: 'Include severity level label in log output',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_LOG_USE_COLORS',
        description: 'Colorise log output (disable in CI/production)',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'false',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_LOG_SAVE',
        description: 'Persist log output to a file on disk',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_LOG_EXPAND_OBJECTS',
        description: 'Pretty-print nested objects in log output',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_LOG_TRUNCATE_TEXT',
        description: 'Truncate long string values in log entries',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_LOG_TRUNCATE_AT',
        description: 'Character limit at which log strings are truncated',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '1000',
        exampleValue: '1000',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_LOG_STRINGIFY',
        description: 'JSON-stringify objects in log output instead of pretty-printing',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['api'],
        category: 'api-config'
    },

    // -------------------------------------------------------------------------
    // CORS
    // -------------------------------------------------------------------------
    {
        name: 'API_CORS_ORIGINS',
        description: 'Comma-separated list of allowed CORS origins',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'http://localhost:3000,http://localhost:4321',
        exampleValue: 'http://localhost:3000,http://localhost:4321',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_CORS_ALLOW_CREDENTIALS',
        description: 'Whether the CORS preflight includes credentials',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_CORS_MAX_AGE',
        description: 'CORS preflight cache duration in seconds',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '86400',
        exampleValue: '86400',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_CORS_ALLOW_METHODS',
        description: 'Comma-separated list of allowed HTTP methods for CORS',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
        exampleValue: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_CORS_ALLOW_HEADERS',
        description: 'Comma-separated list of allowed request headers for CORS',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Content-Type,Authorization,X-Requested-With',
        exampleValue: 'Content-Type,Authorization,X-Requested-With',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_CORS_EXPOSE_HEADERS',
        description: 'Comma-separated list of response headers exposed to browser CORS clients',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Content-Length,X-Request-ID',
        exampleValue: 'Content-Length,X-Request-ID',
        apps: ['api'],
        category: 'api-config'
    },

    // -------------------------------------------------------------------------
    // Cache
    // -------------------------------------------------------------------------
    {
        name: 'API_CACHE_ENABLED',
        description: 'Enable HTTP cache-control header middleware',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_CACHE_DEFAULT_MAX_AGE',
        description: 'Default Cache-Control max-age in seconds',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '300',
        exampleValue: '300',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_CACHE_DEFAULT_STALE_WHILE_REVALIDATE',
        description: 'Default stale-while-revalidate window in seconds',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '60',
        exampleValue: '60',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_CACHE_DEFAULT_STALE_IF_ERROR',
        description: 'Default stale-if-error window in seconds',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '86400',
        exampleValue: '86400',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_CACHE_PUBLIC_ENDPOINTS',
        description: 'Comma-separated path prefixes that receive public cache headers',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '/api/v1/public/accommodations,/health',
        exampleValue: '/api/v1/public/accommodations,/health',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_CACHE_PRIVATE_ENDPOINTS',
        description: 'Comma-separated path prefixes that receive private cache headers',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '/api/v1/public/users',
        exampleValue: '/api/v1/public/users',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_CACHE_NO_CACHE_ENDPOINTS',
        description: 'Comma-separated path prefixes that receive no-cache headers',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '/health/db,/docs',
        exampleValue: '/health/db,/docs',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_CACHE_ETAG_ENABLED',
        description: 'Enable ETag response headers',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_CACHE_LAST_MODIFIED_ENABLED',
        description: 'Enable Last-Modified response headers',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },

    // -------------------------------------------------------------------------
    // Compression
    // -------------------------------------------------------------------------
    {
        name: 'API_COMPRESSION_ENABLED',
        description: 'Enable response compression middleware',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_COMPRESSION_LEVEL',
        description: 'zlib compression level (1-9)',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '6',
        exampleValue: '6',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_COMPRESSION_THRESHOLD',
        description: 'Minimum response size in bytes before compression is applied',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '1024',
        exampleValue: '1024',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_COMPRESSION_CHUNK_SIZE',
        description: 'Streaming chunk size in bytes for compressed responses',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '16384',
        exampleValue: '16384',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_COMPRESSION_FILTER',
        description: 'Comma-separated MIME type patterns eligible for compression',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'text/*,application/json,application/xml,application/javascript',
        exampleValue: 'text/*,application/json,application/xml,application/javascript',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_COMPRESSION_EXCLUDE_ENDPOINTS',
        description: 'Comma-separated path prefixes excluded from compression',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '/health/db,/docs',
        exampleValue: '/health/db,/docs',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_COMPRESSION_ALGORITHMS',
        description: 'Comma-separated compression algorithms to offer (gzip, deflate)',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'gzip,deflate',
        exampleValue: 'gzip,deflate',
        apps: ['api'],
        category: 'api-config'
    },

    // -------------------------------------------------------------------------
    // Rate Limiting
    // -------------------------------------------------------------------------
    {
        name: 'API_RATE_LIMIT_ENABLED',
        description: 'Enable global rate limiting middleware',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_WINDOW_MS',
        description: 'Global rate-limit sliding window duration in milliseconds',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '900000',
        exampleValue: '900000',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_MAX_REQUESTS',
        description: 'Maximum requests allowed per window for the global limiter',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '100',
        exampleValue: '100',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_KEY_GENERATOR',
        description: 'Strategy for generating the rate-limit key (ip, user)',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'ip',
        exampleValue: 'ip',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS',
        description: 'Do not count 2xx responses toward the rate limit',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_SKIP_FAILED_REQUESTS',
        description: 'Do not count 4xx/5xx responses toward the rate limit',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_STANDARD_HEADERS',
        description: 'Return RateLimit-* standard response headers',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_LEGACY_HEADERS',
        description: 'Return X-RateLimit-* legacy response headers',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_MESSAGE',
        description: 'Error message returned when the global rate limit is exceeded',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Too many requests, please try again later.',
        exampleValue: 'Too many requests, please try again later.',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_TRUST_PROXY',
        description: 'Trust X-Forwarded-For and similar headers for real-IP extraction',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'false',
        exampleValue: 'false',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_TRUSTED_PROXIES',
        description: 'Comma-separated list of trusted proxy IPs or CIDRs',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '',
        exampleValue: '10.0.0.0/8,172.16.0.0/12',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_AUTH_ENABLED',
        description: 'Enable dedicated rate limiter for auth endpoints',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_AUTH_WINDOW_MS',
        description: 'Auth rate-limit window duration in milliseconds',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '300000',
        exampleValue: '300000',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_AUTH_MAX_REQUESTS',
        description: 'Maximum requests allowed per window for the auth limiter',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '50',
        exampleValue: '50',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_AUTH_MESSAGE',
        description: 'Error message returned when the auth rate limit is exceeded',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Too many authentication requests, please try again later.',
        exampleValue: 'Too many authentication requests, please try again later.',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_PUBLIC_ENABLED',
        description: 'Enable dedicated rate limiter for public API endpoints',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_PUBLIC_WINDOW_MS',
        description: 'Public API rate-limit window duration in milliseconds',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '3600000',
        exampleValue: '3600000',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_PUBLIC_MAX_REQUESTS',
        description: 'Maximum requests allowed per window for the public API limiter',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '1000',
        exampleValue: '1000',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_PUBLIC_MESSAGE',
        description: 'Error message returned when the public API rate limit is exceeded',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Too many API requests, please try again later.',
        exampleValue: 'Too many API requests, please try again later.',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_ADMIN_ENABLED',
        description: 'Enable dedicated rate limiter for admin endpoints',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_ADMIN_WINDOW_MS',
        description: 'Admin rate-limit window duration in milliseconds',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '600000',
        exampleValue: '600000',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_ADMIN_MAX_REQUESTS',
        description: 'Maximum requests allowed per window for the admin limiter',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '200',
        exampleValue: '200',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RATE_LIMIT_ADMIN_MESSAGE',
        description: 'Error message returned when the admin rate limit is exceeded',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Too many admin requests, please try again later.',
        exampleValue: 'Too many admin requests, please try again later.',
        apps: ['api'],
        category: 'api-config'
    },

    // -------------------------------------------------------------------------
    // Security Headers
    // -------------------------------------------------------------------------
    {
        name: 'API_SECURITY_ENABLED',
        description: 'Enable the security-headers middleware',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_SECURITY_CSRF_ENABLED',
        description: 'Enable CSRF origin verification',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_SECURITY_CSRF_ORIGIN',
        description: 'Single trusted origin for CSRF checks (overrides list)',
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'http://localhost:4321',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_SECURITY_CSRF_ORIGINS',
        description: 'Comma-separated list of trusted origins for CSRF verification',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'http://localhost:3000,http://localhost:5173',
        exampleValue: 'http://localhost:3000,http://localhost:5173',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_SECURITY_HEADERS_ENABLED',
        description: 'Inject OWASP-recommended security response headers',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_SECURITY_CONTENT_SECURITY_POLICY',
        description: 'Value of the Content-Security-Policy response header',
        type: 'string',
        required: false,
        secret: false,
        defaultValue:
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
        exampleValue: "default-src 'self';",
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_SECURITY_STRICT_TRANSPORT_SECURITY',
        description: 'Value of the Strict-Transport-Security response header',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'max-age=31536000; includeSubDomains',
        exampleValue: 'max-age=31536000; includeSubDomains',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_SECURITY_X_FRAME_OPTIONS',
        description: 'Value of the X-Frame-Options response header',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'SAMEORIGIN',
        exampleValue: 'SAMEORIGIN',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_SECURITY_X_CONTENT_TYPE_OPTIONS',
        description: 'Value of the X-Content-Type-Options response header',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'nosniff',
        exampleValue: 'nosniff',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_SECURITY_X_XSS_PROTECTION',
        description: 'Value of the X-XSS-Protection response header',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '1; mode=block',
        exampleValue: '1; mode=block',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_SECURITY_REFERRER_POLICY',
        description: 'Value of the Referrer-Policy response header',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'strict-origin-when-cross-origin',
        exampleValue: 'strict-origin-when-cross-origin',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_SECURITY_PERMISSIONS_POLICY',
        description: 'Value of the Permissions-Policy response header',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'camera=(), microphone=(), geolocation=()',
        exampleValue: 'camera=(), microphone=(), geolocation=()',
        apps: ['api'],
        category: 'api-config'
    },

    // -------------------------------------------------------------------------
    // Response Formatting
    // -------------------------------------------------------------------------
    {
        name: 'API_RESPONSE_FORMAT_ENABLED',
        description: 'Wrap all responses in a standard envelope shape',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RESPONSE_INCLUDE_TIMESTAMP',
        description: 'Include ISO-8601 timestamp in every response envelope',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RESPONSE_INCLUDE_VERSION',
        description: 'Include API version string in every response envelope',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RESPONSE_API_VERSION',
        description: 'API version string injected into every response envelope',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '1.0.0',
        exampleValue: '1.0.0',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RESPONSE_INCLUDE_REQUEST_ID',
        description: 'Include X-Request-ID in every response envelope',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RESPONSE_INCLUDE_METADATA',
        description: 'Include extended metadata in every response envelope',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RESPONSE_SUCCESS_MESSAGE',
        description: 'Default success message used in response envelopes',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'Success',
        exampleValue: 'Success',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_RESPONSE_ERROR_MESSAGE',
        description: 'Default error message used in response envelopes',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'An error occurred',
        exampleValue: 'An error occurred',
        apps: ['api'],
        category: 'api-config'
    },

    // -------------------------------------------------------------------------
    // Request Validation
    // -------------------------------------------------------------------------
    {
        name: 'API_VALIDATION_MAX_BODY_SIZE',
        description: 'Maximum allowed request body size in bytes',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '10485760',
        exampleValue: '10485760',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_VALIDATION_MAX_REQUEST_TIME',
        description: 'Maximum time in milliseconds allowed for a request to complete',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '30000',
        exampleValue: '30000',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_VALIDATION_ALLOWED_CONTENT_TYPES',
        description: 'Comma-separated list of accepted Content-Type values',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'application/json,multipart/form-data',
        exampleValue: 'application/json,multipart/form-data',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_VALIDATION_REQUIRED_HEADERS',
        description: 'Comma-separated list of headers that must be present on every request',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'user-agent',
        exampleValue: 'user-agent',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_VALIDATION_AUTH_ENABLED',
        description: 'Enable auth-header presence check in the validation middleware',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_VALIDATION_AUTH_HEADERS',
        description: 'Comma-separated list of headers that carry auth credentials',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: 'authorization',
        exampleValue: 'authorization',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_VALIDATION_SANITIZE_ENABLED',
        description: 'Enable request body string sanitisation',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_VALIDATION_SANITIZE_MAX_STRING_LENGTH',
        description: 'Maximum allowed length for individual string values in request bodies',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '1000',
        exampleValue: '1000',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_VALIDATION_SANITIZE_REMOVE_HTML_TAGS',
        description: 'Strip HTML tags from string values during sanitisation',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_VALIDATION_SANITIZE_ALLOWED_CHARS',
        description: 'Regex character class defining allowed characters during sanitisation',
        type: 'string',
        required: false,
        secret: false,
        defaultValue: '[\\w\\s\\-.,!?@#$%&*()+=]',
        exampleValue: '[\\w\\s\\-.,!?@#$%&*()+=]',
        apps: ['api'],
        category: 'api-config'
    },

    // -------------------------------------------------------------------------
    // Metrics
    // -------------------------------------------------------------------------
    {
        name: 'API_METRICS_ENABLED',
        description: 'Enable the metrics collection middleware',
        type: 'boolean',
        required: false,
        secret: false,
        defaultValue: 'true',
        exampleValue: 'true',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_METRICS_SLOW_REQUEST_THRESHOLD_MS',
        description: 'Duration threshold in milliseconds above which a request is flagged as slow',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '1000',
        exampleValue: '1000',
        apps: ['api'],
        category: 'api-config'
    },
    {
        name: 'API_METRICS_SLOW_AUTH_THRESHOLD_MS',
        description:
            'Duration threshold in milliseconds above which an auth check is flagged as slow',
        type: 'number',
        required: false,
        secret: false,
        defaultValue: '2000',
        exampleValue: '2000',
        apps: ['api'],
        category: 'api-config'
    }
] as const satisfies readonly EnvVarDefinition[];
