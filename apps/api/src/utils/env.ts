import { resolve } from 'node:path';
/**
 * Environment configuration with validation
 * Centralized environment variables with Zod validation
 */
import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env files
// First try to load from root directory, then fallback to local files
const rootDir = resolve(__dirname, '../../../..');
const envFiles = [
    resolve(rootDir, '.env.local'),
    resolve(rootDir, '.env'),
    '.env.local', // Fallback to local files
    '.env'
];

if (process.env.NODE_ENV === 'test') {
    envFiles.unshift(resolve(rootDir, '.env.test'), '.env.test');
}

config({ path: envFiles });

const EnvSchema = z.object({
    // Server Configuration
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_PORT: z.coerce.number().default(3001),
    API_HOST: z.string().default('localhost'),

    // Logging Configuration
    LOG_LEVEL: z
        .string()
        .transform((val) => val.toLowerCase())
        .pipe(z.enum(['debug', 'info', 'warn', 'error']))
        .default('info'),
    ENABLE_REQUEST_LOGGING: z.coerce.boolean().default(true),

    // API Logging Configuration
    API_LOG_INCLUDE_TIMESTAMPS: z.coerce.boolean().default(true),
    API_LOG_INCLUDE_LEVEL: z.coerce.boolean().default(true),
    API_LOG_USE_COLORS: z.coerce.boolean().default(true),
    API_LOG_SAVE: z.coerce.boolean().default(false),
    API_LOG_EXPAND_OBJECT_LEVELS: z.coerce.boolean().default(false),
    API_LOG_TRUNCATE_LONG_TEXT: z.coerce.boolean().default(true),
    API_LOG_TRUNCATE_LONG_TEXT_AT: z.coerce.number().default(200),
    API_LOG_STRINGIFY_OBJECTS: z.coerce.boolean().default(false),

    // CORS Configuration
    CORS_ORIGINS: z
        .string()
        .default(
            'http://localhost:3000,http://localhost:4321,http://localhost:5173,http://localhost:4173'
        ),
    CORS_ALLOW_CREDENTIALS: z.coerce.boolean().default(true),
    CORS_MAX_AGE: z.coerce.number().default(86400), // 24 hours
    CORS_ALLOW_METHODS: z.string().default('GET,POST,PUT,DELETE,PATCH,OPTIONS'),
    CORS_ALLOW_HEADERS: z.string().default('Content-Type,Authorization,X-Requested-With'),
    CORS_EXPOSE_HEADERS: z.string().default('Content-Length,X-Request-ID'),

    // Cache Configuration (auto-detects runtime support)
    CACHE_ENABLED: z.coerce.boolean().default(true),
    CACHE_DEFAULT_MAX_AGE: z.coerce.number().default(300), // 5 minutes
    CACHE_DEFAULT_STALE_WHILE_REVALIDATE: z.coerce.number().default(60), // 1 minute
    CACHE_DEFAULT_STALE_IF_ERROR: z.coerce.number().default(86400), // 24 hours
    CACHE_PUBLIC_ENDPOINTS: z.string().default('/api/v1/public/accommodations,/health'),
    CACHE_PRIVATE_ENDPOINTS: z.string().default('/api/v1/public/users'),
    CACHE_NO_CACHE_ENDPOINTS: z.string().default('/health/db,/docs'),
    CACHE_ETAG_ENABLED: z.coerce.boolean().default(true),
    CACHE_LAST_MODIFIED_ENABLED: z.coerce.boolean().default(true),

    // Compression Configuration
    COMPRESSION_ENABLED: z.coerce.boolean().default(true),
    COMPRESSION_LEVEL: z.coerce.number().min(1).max(9).default(6),
    COMPRESSION_THRESHOLD: z.coerce.number().default(1024), // 1KB
    COMPRESSION_CHUNK_SIZE: z.coerce.number().default(16384), // 16KB
    COMPRESSION_FILTER: z
        .string()
        .default('text/*,application/json,application/xml,application/javascript'),
    COMPRESSION_EXCLUDE_ENDPOINTS: z.string().default('/health/db,/docs'),
    COMPRESSION_ALGORITHMS: z.string().default('gzip,deflate'),

    // Rate Limiting Configuration - General
    RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
    RATE_LIMIT_KEY_GENERATOR: z.enum(['ip', 'user', 'custom']).default('ip'),
    RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: z.coerce.boolean().default(false),
    RATE_LIMIT_SKIP_FAILED_REQUESTS: z.coerce.boolean().default(false),
    RATE_LIMIT_STANDARD_HEADERS: z.coerce.boolean().default(true),
    RATE_LIMIT_LEGACY_HEADERS: z.coerce.boolean().default(false),
    RATE_LIMIT_MESSAGE: z.string().default('Too many requests, please try again later.'),

    // Rate Limiting Configuration - Auth Endpoints (more permissive)
    RATE_LIMIT_AUTH_ENABLED: z.coerce.boolean().default(true),
    RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().default(300000), // 5 minutes
    RATE_LIMIT_AUTH_MAX_REQUESTS: z.coerce.number().default(50), // Higher limit for auth operations
    RATE_LIMIT_AUTH_MESSAGE: z
        .string()
        .default('Too many authentication requests, please try again later.'),

    // Rate Limiting Configuration - Public API (more restrictive)
    RATE_LIMIT_PUBLIC_ENABLED: z.coerce.boolean().default(true),
    RATE_LIMIT_PUBLIC_WINDOW_MS: z.coerce.number().default(3600000), // 1 hour
    RATE_LIMIT_PUBLIC_MAX_REQUESTS: z.coerce.number().default(1000), // Higher limit for public data
    RATE_LIMIT_PUBLIC_MESSAGE: z.string().default('Too many API requests, please try again later.'),

    // Rate Limiting Configuration - Admin Endpoints (most restrictive)
    RATE_LIMIT_ADMIN_ENABLED: z.coerce.boolean().default(true),
    RATE_LIMIT_ADMIN_WINDOW_MS: z.coerce.number().default(600000), // 10 minutes
    RATE_LIMIT_ADMIN_MAX_REQUESTS: z.coerce.number().default(200), // Moderate limit for admin operations
    RATE_LIMIT_ADMIN_MESSAGE: z
        .string()
        .default('Too many admin requests, please try again later.'),

    // Security Configuration
    SECURITY_ENABLED: z.coerce.boolean().default(true),
    SECURITY_CSRF_ENABLED: z.coerce.boolean().default(true),
    SECURITY_CSRF_ORIGIN: z.string().url().optional(),
    SECURITY_CSRF_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
    SECURITY_HEADERS_ENABLED: z.coerce.boolean().default(true),
    SECURITY_CONTENT_SECURITY_POLICY: z
        .string()
        .default(
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
        ),
    SECURITY_STRICT_TRANSPORT_SECURITY: z.string().default('max-age=31536000; includeSubDomains'),
    SECURITY_X_FRAME_OPTIONS: z.enum(['DENY', 'SAMEORIGIN', 'ALLOW-FROM']).default('SAMEORIGIN'),
    SECURITY_X_CONTENT_TYPE_OPTIONS: z.string().default('nosniff'),
    SECURITY_X_XSS_PROTECTION: z.string().default('1; mode=block'),
    SECURITY_REFERRER_POLICY: z.string().default('strict-origin-when-cross-origin'),
    SECURITY_PERMISSIONS_POLICY: z.string().default('camera=(), microphone=(), geolocation=()'),

    // Response Formatting Configuration
    RESPONSE_FORMAT_ENABLED: z.coerce.boolean().default(true),
    RESPONSE_INCLUDE_TIMESTAMP: z.coerce.boolean().default(true),
    RESPONSE_INCLUDE_VERSION: z.coerce.boolean().default(true),
    RESPONSE_API_VERSION: z.string().default('1.0.0'),
    RESPONSE_INCLUDE_REQUEST_ID: z.coerce.boolean().default(true),
    RESPONSE_INCLUDE_METADATA: z.coerce.boolean().default(true),
    RESPONSE_SUCCESS_MESSAGE: z.string().default('Success'),
    RESPONSE_ERROR_MESSAGE: z.string().default('An error occurred'),

    // Validation Configuration
    VALIDATION_MAX_BODY_SIZE: z.coerce
        .number()
        .positive()
        .default(10 * 1024 * 1024), // 10MB
    VALIDATION_MAX_REQUEST_TIME: z.coerce.number().positive().default(30000), // 30s
    VALIDATION_ALLOWED_CONTENT_TYPES: z.string().default('application/json,multipart/form-data'),
    VALIDATION_REQUIRED_HEADERS: z.string().default('user-agent'),
    VALIDATION_CLERK_AUTH_ENABLED: z.coerce.boolean().default(true),
    VALIDATION_CLERK_AUTH_HEADERS: z.string().default('authorization'),
    VALIDATION_SANITIZE_ENABLED: z.coerce.boolean().default(true),
    VALIDATION_SANITIZE_MAX_STRING_LENGTH: z.coerce.number().positive().default(1000),
    VALIDATION_SANITIZE_REMOVE_HTML_TAGS: z.coerce.boolean().default(true),
    VALIDATION_SANITIZE_ALLOWED_CHARS: z.string().default('[\\w\\s\\-.,!?@#$%&*()+=]'),

    // Metrics Configuration
    METRICS_ENABLED: z.coerce.boolean().default(true),
    METRICS_SLOW_REQUEST_THRESHOLD_MS: z.coerce.number().positive().default(1000),
    METRICS_SLOW_AUTH_THRESHOLD_MS: z.coerce.number().positive().default(2000),

    // Internationalization Configuration
    SUPPORTED_LOCALES: z.string().default('en,es'),
    DEFAULT_LOCALE: z.string().default('en'),

    // Database Configuration (optional)
    DATABASE_URL: z.string().optional(),

    // Database Pool Configuration
    DB_POOL_MAX_CONNECTIONS: z.coerce.number().positive().default(10),
    DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().positive().default(30000), // 30 seconds
    DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().positive().default(2000), // 2 seconds

    // Auth Configuration (optional)
    CLERK_PUBLISHABLE_KEY: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional(),
    CLERK_WEBHOOK_SECRET: z.string().optional()
});

// Parse and validate environment variables
const parseEnv = () => {
    try {
        return EnvSchema.parse(process.env);
    } catch (error) {
        // Use console.error here since logger may not be initialized yet
        console.error('❌ Invalid environment configuration:', error);
        process.exit(1);
    }
};

export const env = parseEnv();

// Export types for usage in other files
export type Env = z.infer<typeof EnvSchema>;

/**
 * Configuration helpers for middlewares
 * These helpers parse and validate common configuration patterns
 */

/**
 * Parse comma-separated strings into arrays
 */
export const parseCommaSeparated = (value: string): string[] => {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
};

/**
 * Parse CORS origins with validation
 */
export const parseCorsOrigins = (): string[] | '*' => {
    if (env.CORS_ORIGINS === '*') {
        return '*';
    }
    return parseCommaSeparated(env.CORS_ORIGINS);
};

/**
 * Parse cache endpoint lists
 */
export const getCacheConfig = () => ({
    enabled: env.CACHE_ENABLED,
    publicEndpoints: parseCommaSeparated(env.CACHE_PUBLIC_ENDPOINTS),
    privateEndpoints: parseCommaSeparated(env.CACHE_PRIVATE_ENDPOINTS),
    noCacheEndpoints: parseCommaSeparated(env.CACHE_NO_CACHE_ENDPOINTS),
    maxAge: env.CACHE_DEFAULT_MAX_AGE,
    staleWhileRevalidate: env.CACHE_DEFAULT_STALE_WHILE_REVALIDATE,
    staleIfError: env.CACHE_DEFAULT_STALE_IF_ERROR,
    etagEnabled: env.CACHE_ETAG_ENABLED,
    lastModifiedEnabled: env.CACHE_LAST_MODIFIED_ENABLED
});

/**
 * Parse compression configuration
 */
export const getCompressionConfig = () => ({
    enabled: env.COMPRESSION_ENABLED,
    algorithms: parseCommaSeparated(env.COMPRESSION_ALGORITHMS),
    threshold: env.COMPRESSION_THRESHOLD,
    level: env.COMPRESSION_LEVEL,
    chunkSize: env.COMPRESSION_CHUNK_SIZE,
    filter: parseCommaSeparated(env.COMPRESSION_FILTER),
    excludeEndpoints: parseCommaSeparated(env.COMPRESSION_EXCLUDE_ENDPOINTS)
});

/**
 * Get rate limiting configuration for different endpoint types
 */
export const getRateLimitConfig = (
    endpointType: 'general' | 'auth' | 'public' | 'admin' = 'general'
) => {
    const baseConfig = {
        keyGenerator: env.RATE_LIMIT_KEY_GENERATOR,
        skipSuccessful: env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS,
        skipFailed: env.RATE_LIMIT_SKIP_FAILED_REQUESTS,
        standardHeaders: env.RATE_LIMIT_STANDARD_HEADERS,
        legacyHeaders: env.RATE_LIMIT_LEGACY_HEADERS
    };

    switch (endpointType) {
        case 'auth':
            return {
                ...baseConfig,
                enabled: env.RATE_LIMIT_AUTH_ENABLED,
                windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
                maxRequests: env.RATE_LIMIT_AUTH_MAX_REQUESTS,
                message: env.RATE_LIMIT_AUTH_MESSAGE
            };
        case 'public':
            return {
                ...baseConfig,
                enabled: env.RATE_LIMIT_PUBLIC_ENABLED,
                windowMs: env.RATE_LIMIT_PUBLIC_WINDOW_MS,
                maxRequests: env.RATE_LIMIT_PUBLIC_MAX_REQUESTS,
                message: env.RATE_LIMIT_PUBLIC_MESSAGE
            };
        case 'admin':
            return {
                ...baseConfig,
                enabled: env.RATE_LIMIT_ADMIN_ENABLED,
                windowMs: env.RATE_LIMIT_ADMIN_WINDOW_MS,
                maxRequests: env.RATE_LIMIT_ADMIN_MAX_REQUESTS,
                message: env.RATE_LIMIT_ADMIN_MESSAGE
            };
        default:
            return {
                ...baseConfig,
                enabled: env.RATE_LIMIT_ENABLED,
                windowMs: env.RATE_LIMIT_WINDOW_MS,
                maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
                message: env.RATE_LIMIT_MESSAGE
            };
    }
};

/**
 * Parse security configuration
 */
export const getSecurityConfig = () => ({
    enabled: env.SECURITY_ENABLED,
    csrf: {
        enabled: env.SECURITY_CSRF_ENABLED,
        origin: env.SECURITY_CSRF_ORIGIN,
        origins: parseCommaSeparated(env.SECURITY_CSRF_ORIGINS)
    },
    headers: {
        enabled: env.SECURITY_HEADERS_ENABLED,
        contentSecurityPolicy: env.SECURITY_CONTENT_SECURITY_POLICY,
        strictTransportSecurity: env.SECURITY_STRICT_TRANSPORT_SECURITY,
        xFrameOptions: env.SECURITY_X_FRAME_OPTIONS,
        xContentTypeOptions: env.SECURITY_X_CONTENT_TYPE_OPTIONS,
        xXssProtection: env.SECURITY_X_XSS_PROTECTION,
        referrerPolicy: env.SECURITY_REFERRER_POLICY,
        permissionsPolicy: env.SECURITY_PERMISSIONS_POLICY
    }
});

/**
 * Parse CORS configuration
 */
export const getCorsConfig = () => ({
    origins: parseCorsOrigins(),
    allowCredentials: env.CORS_ALLOW_CREDENTIALS,
    maxAge: env.CORS_MAX_AGE,
    allowMethods: parseCommaSeparated(env.CORS_ALLOW_METHODS),
    allowHeaders: parseCommaSeparated(env.CORS_ALLOW_HEADERS),
    exposeHeaders: parseCommaSeparated(env.CORS_EXPOSE_HEADERS)
});

/**
 * Parse validation configuration
 */
export const getValidationConfig = () => ({
    maxBodySize: env.VALIDATION_MAX_BODY_SIZE,
    maxRequestTime: env.VALIDATION_MAX_REQUEST_TIME,
    allowedContentTypes: parseCommaSeparated(env.VALIDATION_ALLOWED_CONTENT_TYPES),
    requiredHeaders: parseCommaSeparated(env.VALIDATION_REQUIRED_HEADERS),
    clerk: {
        enabled: env.VALIDATION_CLERK_AUTH_ENABLED,
        headers: parseCommaSeparated(env.VALIDATION_CLERK_AUTH_HEADERS)
    },
    sanitize: {
        enabled: env.VALIDATION_SANITIZE_ENABLED,
        maxStringLength: env.VALIDATION_SANITIZE_MAX_STRING_LENGTH,
        removeHtmlTags: env.VALIDATION_SANITIZE_REMOVE_HTML_TAGS,
        allowedChars: env.VALIDATION_SANITIZE_ALLOWED_CHARS
    }
});

/**
 * Parse response formatting configuration
 */
export const getResponseConfig = () => ({
    enabled: env.RESPONSE_FORMAT_ENABLED,
    includeTimestamp: env.RESPONSE_INCLUDE_TIMESTAMP,
    includeVersion: env.RESPONSE_INCLUDE_VERSION,
    apiVersion: env.RESPONSE_API_VERSION,
    includeRequestId: env.RESPONSE_INCLUDE_REQUEST_ID,
    includeMetadata: env.RESPONSE_INCLUDE_METADATA,
    successMessage: env.RESPONSE_SUCCESS_MESSAGE,
    errorMessage: env.RESPONSE_ERROR_MESSAGE
});

/**
 * Parse database pool configuration
 */
export const getDatabasePoolConfig = () => ({
    max: env.DB_POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT_MS
});
