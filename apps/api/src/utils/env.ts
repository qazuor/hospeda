import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStartupValidator } from '@repo/config';
/**
 * Environment configuration with validation
 * Uses @repo/config for centralized environment variable management
 */
import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables from root directory
const rootDir = resolve(__dirname, '../../../..');
const envFiles = [resolve(rootDir, '.env.local'), resolve(rootDir, '.env')];

if (process.env.NODE_ENV === 'test') {
    envFiles.unshift(resolve(rootDir, '.env.test'));
}

// Load environment variables

for (const envFile of envFiles) {
    // Only try to load files that actually exist
    if (!existsSync(envFile)) {
        continue;
    }

    try {
        const result = config({ path: envFile });
        if (result?.error) {
            console.warn(`⚠️  Could not load ${envFile}: ${result.error.message}`);
        }
    } catch (error) {
        console.warn(
            `⚠️  Error loading ${envFile}:`,
            error instanceof Error ? error.message : String(error)
        );
    }
}

/**
 * API-specific environment schema
 * Combines common schemas with API-specific requirements
 */
const ApiEnvSchema = z.object({
    // Server Configuration
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_PORT: z.coerce.number().positive().default(3001),
    API_HOST: z.string().default('localhost'),

    // Required URLs
    HOSPEDA_API_URL: z.string().url('Must be a valid API URL'),
    HOSPEDA_DATABASE_URL: z.string().min(1, 'Database URL is required'),

    // Authentication (Clerk) - REQUIRED, NO DEFAULTS
    HOSPEDA_CLERK_SECRET_KEY: z.string().min(1, 'Clerk secret key is required'),
    HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'Clerk publishable key is required'),
    HOSPEDA_CLERK_WEBHOOK_SECRET: z.string().optional(),

    // Logging Configuration (API-specific)
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

    // CORS Configuration (API-specific)
    API_CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:4321'),
    API_CORS_ALLOW_CREDENTIALS: z.coerce.boolean().default(true),
    API_CORS_MAX_AGE: z.coerce.number().default(86400),
    API_CORS_ALLOW_METHODS: z.string().default('GET,POST,PUT,DELETE,PATCH,OPTIONS'),
    API_CORS_ALLOW_HEADERS: z
        .string()
        .default('Content-Type,Authorization,X-Requested-With,x-actor-id,x-user-id'),
    API_CORS_EXPOSE_HEADERS: z.string().default('Content-Length,X-Request-ID'),

    // Cache Configuration (API-specific)
    API_CACHE_ENABLED: z.coerce.boolean().default(true),
    API_CACHE_DEFAULT_MAX_AGE: z.coerce.number().default(300),
    API_CACHE_DEFAULT_STALE_WHILE_REVALIDATE: z.coerce.number().default(60),
    API_CACHE_DEFAULT_STALE_IF_ERROR: z.coerce.number().default(86400),
    API_CACHE_PUBLIC_ENDPOINTS: z.string().default('/api/v1/public/accommodations,/health'),
    API_CACHE_PRIVATE_ENDPOINTS: z.string().default('/api/v1/public/users'),
    API_CACHE_NO_CACHE_ENDPOINTS: z.string().default('/health/db,/docs'),
    API_CACHE_ETAG_ENABLED: z.coerce.boolean().default(true),
    API_CACHE_LAST_MODIFIED_ENABLED: z.coerce.boolean().default(true),

    // Compression Configuration (API-specific)
    API_COMPRESSION_ENABLED: z.coerce.boolean().default(true),
    API_COMPRESSION_LEVEL: z.coerce.number().min(1).max(9).default(6),
    API_COMPRESSION_THRESHOLD: z.coerce.number().default(1024),
    API_COMPRESSION_CHUNK_SIZE: z.coerce.number().default(16384),
    API_COMPRESSION_FILTER: z
        .string()
        .default('text/*,application/json,application/xml,application/javascript'),
    API_COMPRESSION_EXCLUDE_ENDPOINTS: z.string().default('/health/db,/docs'),
    API_COMPRESSION_ALGORITHMS: z.string().default('gzip,deflate'),

    // Rate Limiting Configuration (API-specific)
    API_RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
    API_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
    API_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
    API_RATE_LIMIT_KEY_GENERATOR: z.string().default('ip'),
    API_RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: z.coerce.boolean().default(false),
    API_RATE_LIMIT_SKIP_FAILED_REQUESTS: z.coerce.boolean().default(false),
    API_RATE_LIMIT_STANDARD_HEADERS: z.coerce.boolean().default(true),
    API_RATE_LIMIT_LEGACY_HEADERS: z.coerce.boolean().default(false),
    API_RATE_LIMIT_MESSAGE: z.string().default('Too many requests, please try again later.'),

    // Auth Rate Limiting
    API_RATE_LIMIT_AUTH_ENABLED: z.coerce.boolean().default(true),
    API_RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().default(300000), // 5 minutes
    API_RATE_LIMIT_AUTH_MAX_REQUESTS: z.coerce.number().default(50),
    API_RATE_LIMIT_AUTH_MESSAGE: z
        .string()
        .default('Too many authentication requests, please try again later.'),

    // Public API Rate Limiting
    API_RATE_LIMIT_PUBLIC_ENABLED: z.coerce.boolean().default(true),
    API_RATE_LIMIT_PUBLIC_WINDOW_MS: z.coerce.number().default(3600000), // 1 hour
    API_RATE_LIMIT_PUBLIC_MAX_REQUESTS: z.coerce.number().default(1000),
    API_RATE_LIMIT_PUBLIC_MESSAGE: z
        .string()
        .default('Too many API requests, please try again later.'),

    // Admin Rate Limiting
    API_RATE_LIMIT_ADMIN_ENABLED: z.coerce.boolean().default(true),
    API_RATE_LIMIT_ADMIN_WINDOW_MS: z.coerce.number().default(600000), // 10 minutes
    API_RATE_LIMIT_ADMIN_MAX_REQUESTS: z.coerce.number().default(200),
    API_RATE_LIMIT_ADMIN_MESSAGE: z
        .string()
        .default('Too many admin requests, please try again later.'),

    // Security Configuration (API-specific)
    API_SECURITY_ENABLED: z.coerce.boolean().default(true),
    API_SECURITY_CSRF_ENABLED: z.coerce.boolean().default(true),
    API_SECURITY_CSRF_ORIGIN: z.string().optional(),
    API_SECURITY_CSRF_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
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
    API_SECURITY_PERMISSIONS_POLICY: z.string().default('camera=(), microphone=(), geolocation=()'),

    // Response Configuration (API-specific)
    API_RESPONSE_FORMAT_ENABLED: z.coerce.boolean().default(true),
    API_RESPONSE_INCLUDE_TIMESTAMP: z.coerce.boolean().default(true),
    API_RESPONSE_INCLUDE_VERSION: z.coerce.boolean().default(true),
    API_RESPONSE_API_VERSION: z.string().default('1.0.0'),
    API_RESPONSE_INCLUDE_REQUEST_ID: z.coerce.boolean().default(true),
    API_RESPONSE_INCLUDE_METADATA: z.coerce.boolean().default(true),
    API_RESPONSE_SUCCESS_MESSAGE: z.string().default('Success'),
    API_RESPONSE_ERROR_MESSAGE: z.string().default('An error occurred'),

    // Validation Configuration (API-specific)
    API_VALIDATION_MAX_BODY_SIZE: z.coerce.number().default(10485760), // 10MB
    API_VALIDATION_MAX_REQUEST_TIME: z.coerce.number().default(30000), // 30 seconds
    API_VALIDATION_ALLOWED_CONTENT_TYPES: z
        .string()
        .default('application/json,multipart/form-data'),
    API_VALIDATION_REQUIRED_HEADERS: z.string().default('user-agent'),
    API_VALIDATION_CLERK_AUTH_ENABLED: z.coerce.boolean().default(true),
    API_VALIDATION_CLERK_AUTH_HEADERS: z.string().default('authorization'),
    API_VALIDATION_SANITIZE_ENABLED: z.coerce.boolean().default(true),
    API_VALIDATION_SANITIZE_MAX_STRING_LENGTH: z.coerce.number().default(1000),
    API_VALIDATION_SANITIZE_REMOVE_HTML_TAGS: z.coerce.boolean().default(true),
    API_VALIDATION_SANITIZE_ALLOWED_CHARS: z.string().default('[\\w\\s\\-.,!?@#$%&*()+=]'),

    // Metrics Configuration (API-specific)
    API_METRICS_ENABLED: z.coerce.boolean().default(true),
    API_METRICS_SLOW_REQUEST_THRESHOLD_MS: z.coerce.number().default(1000),
    API_METRICS_SLOW_AUTH_THRESHOLD_MS: z.coerce.number().default(2000),

    // Database Pool Configuration
    DB_POOL_MAX_CONNECTIONS: z.coerce.number().default(10),
    DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
    DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().default(2000),

    // Optional configurations
    HOSPEDA_REDIS_URL: z.string().optional(),
    TESTING_RATE_LIMIT: z.coerce.boolean().default(false),
    DEBUG_TESTS: z.coerce.boolean().default(false),
    COMMIT_SHA: z.string().default('unknown')
});

/**
 * Helper to safely access process.env with defaults during module initialization
 */
const safeEnv = {
    get: (key: string, defaultValue = ''): string => process.env[key] || defaultValue,
    getBoolean: (key: string, defaultValue = false): boolean => {
        const value = process.env[key];
        if (value === undefined) return defaultValue;
        return value === 'true';
    },
    getNumber: (key: string, defaultValue = 0): number => {
        const value = process.env[key];
        if (value === undefined) return defaultValue;
        const parsed = Number(value);
        return Number.isNaN(parsed) ? defaultValue : parsed;
    }
};

/**
 * Parse comma-separated string into array
 */
export const parseCommaSeparated = (value: string | undefined): string[] => {
    if (!value || typeof value !== 'string') return [];
    return value.split(',').map((item) => item.trim());
};

/**
 * Cache configuration helper
 */
export const getCacheConfig = () => ({
    enabled: safeEnv.getBoolean('API_CACHE_ENABLED', true),
    defaultMaxAge: safeEnv.getNumber('API_CACHE_DEFAULT_MAX_AGE', 300),
    defaultStaleWhileRevalidate: safeEnv.getNumber('API_CACHE_DEFAULT_STALE_WHILE_REVALIDATE', 60),
    defaultStaleIfError: safeEnv.getNumber('API_CACHE_DEFAULT_STALE_IF_ERROR', 86400),
    // Aliases for backward compatibility
    maxAge: safeEnv.getNumber('API_CACHE_DEFAULT_MAX_AGE', 300),
    staleWhileRevalidate: safeEnv.getNumber('API_CACHE_DEFAULT_STALE_WHILE_REVALIDATE', 60),
    staleIfError: safeEnv.getNumber('API_CACHE_DEFAULT_STALE_IF_ERROR', 86400),
    publicEndpoints: parseCommaSeparated(
        safeEnv.get('API_CACHE_PUBLIC_ENDPOINTS', '/api/v1/public/accommodations,/health')
    ),
    privateEndpoints: parseCommaSeparated(
        safeEnv.get('API_CACHE_PRIVATE_ENDPOINTS', '/api/v1/public/users')
    ),
    noCacheEndpoints: parseCommaSeparated(
        safeEnv.get('API_CACHE_NO_CACHE_ENDPOINTS', '/health/db,/docs')
    ),
    etagEnabled: safeEnv.getBoolean('API_CACHE_ETAG_ENABLED', true),
    lastModifiedEnabled: safeEnv.getBoolean('API_CACHE_LAST_MODIFIED_ENABLED', true)
});

/**
 * Parse CORS origins from environment variable
 */
export const parseCorsOrigins = (origins: string | undefined): string[] => {
    if (!origins || typeof origins !== 'string')
        return ['http://localhost:3000', 'http://localhost:4321'];
    return origins.split(',').map((origin) => origin.trim());
};

/**
 * CORS configuration helper
 */
export const getCorsConfig = () => ({
    origins: parseCorsOrigins(
        safeEnv.get('API_CORS_ORIGINS', 'http://localhost:3000,http://localhost:4321')
    ),
    allowCredentials: safeEnv.getBoolean('API_CORS_ALLOW_CREDENTIALS', true),
    maxAge: safeEnv.getNumber('API_CORS_MAX_AGE', 86400),
    allowMethods: parseCommaSeparated(
        safeEnv.get('API_CORS_ALLOW_METHODS', 'GET,POST,PUT,DELETE,PATCH,OPTIONS')
    ),
    allowHeaders: parseCommaSeparated(
        safeEnv.get(
            'API_CORS_ALLOW_HEADERS',
            'Content-Type,Authorization,X-Requested-With,x-actor-id,x-user-id'
        )
    ),
    exposeHeaders: parseCommaSeparated(
        safeEnv.get('API_CORS_EXPOSE_HEADERS', 'Content-Length,X-Request-ID')
    )
});

/**
 * Compression configuration helper
 */
export const getCompressionConfig = () => ({
    enabled: safeEnv.getBoolean('API_COMPRESSION_ENABLED', true),
    level: safeEnv.getNumber('API_COMPRESSION_LEVEL', 6),
    threshold: safeEnv.getNumber('API_COMPRESSION_THRESHOLD', 1024),
    chunkSize: safeEnv.getNumber('API_COMPRESSION_CHUNK_SIZE', 16384),
    filter: safeEnv.get(
        'API_COMPRESSION_FILTER',
        'text/*,application/json,application/xml,application/javascript'
    ),
    excludeEndpoints: parseCommaSeparated(
        safeEnv.get('API_COMPRESSION_EXCLUDE_ENDPOINTS', '/health/db,/docs')
    ),
    algorithms: safeEnv.get('API_COMPRESSION_ALGORITHMS', 'gzip,deflate')
});

/**
 * Rate limiting configuration helper
 */
export const getRateLimitConfig = () => ({
    enabled: safeEnv.getBoolean('API_RATE_LIMIT_ENABLED', true),
    windowMs: safeEnv.getNumber('API_RATE_LIMIT_WINDOW_MS', 900000),
    maxRequests: safeEnv.getNumber('API_RATE_LIMIT_MAX_REQUESTS', 100),
    keyGenerator: safeEnv.get('API_RATE_LIMIT_KEY_GENERATOR', 'ip'),
    skipSuccessfulRequests: safeEnv.getBoolean('API_RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS', false),
    skipFailedRequests: safeEnv.getBoolean('API_RATE_LIMIT_SKIP_FAILED_REQUESTS', false),
    standardHeaders: safeEnv.getBoolean('API_RATE_LIMIT_STANDARD_HEADERS', true),
    legacyHeaders: safeEnv.getBoolean('API_RATE_LIMIT_LEGACY_HEADERS', false),
    message: safeEnv.get('API_RATE_LIMIT_MESSAGE', 'Too many requests, please try again later.'),

    // Auth-specific
    authEnabled: safeEnv.getBoolean('API_RATE_LIMIT_AUTH_ENABLED', true),
    authWindowMs: safeEnv.getNumber('API_RATE_LIMIT_AUTH_WINDOW_MS', 300000),
    authMaxRequests: safeEnv.getNumber('API_RATE_LIMIT_AUTH_MAX_REQUESTS', 50),
    authMessage: safeEnv.get(
        'API_RATE_LIMIT_AUTH_MESSAGE',
        'Too many authentication requests, please try again later.'
    ),

    // Public API-specific
    publicEnabled: safeEnv.getBoolean('API_RATE_LIMIT_PUBLIC_ENABLED', true),
    publicWindowMs: safeEnv.getNumber('API_RATE_LIMIT_PUBLIC_WINDOW_MS', 3600000),
    publicMaxRequests: safeEnv.getNumber('API_RATE_LIMIT_PUBLIC_MAX_REQUESTS', 1000),
    publicMessage: safeEnv.get(
        'API_RATE_LIMIT_PUBLIC_MESSAGE',
        'Too many API requests, please try again later.'
    ),

    // Admin-specific
    adminEnabled: safeEnv.getBoolean('API_RATE_LIMIT_ADMIN_ENABLED', true),
    adminWindowMs: safeEnv.getNumber('API_RATE_LIMIT_ADMIN_WINDOW_MS', 600000),
    adminMaxRequests: safeEnv.getNumber('API_RATE_LIMIT_ADMIN_MAX_REQUESTS', 200),
    adminMessage: safeEnv.get(
        'API_RATE_LIMIT_ADMIN_MESSAGE',
        'Too many admin requests, please try again later.'
    )
});

/**
 * Security configuration helper
 */
export const getSecurityConfig = () => ({
    enabled: safeEnv.getBoolean('API_SECURITY_ENABLED', true),
    csrfEnabled: safeEnv.getBoolean('API_SECURITY_CSRF_ENABLED', true),
    csrfOrigin: safeEnv.get('API_SECURITY_CSRF_ORIGIN'),
    csrfOrigins: parseCommaSeparated(
        safeEnv.get('API_SECURITY_CSRF_ORIGINS', 'http://localhost:3000,http://localhost:5173')
    ),
    headersEnabled: safeEnv.getBoolean('API_SECURITY_HEADERS_ENABLED', true),
    contentSecurityPolicy: safeEnv.get(
        'API_SECURITY_CONTENT_SECURITY_POLICY',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    ),
    strictTransportSecurity: safeEnv.get(
        'API_SECURITY_STRICT_TRANSPORT_SECURITY',
        'max-age=31536000; includeSubDomains'
    ),
    xFrameOptions: safeEnv.get('API_SECURITY_X_FRAME_OPTIONS', 'SAMEORIGIN'),
    xContentTypeOptions: safeEnv.get('API_SECURITY_X_CONTENT_TYPE_OPTIONS', 'nosniff'),
    xXssProtection: safeEnv.get('API_SECURITY_X_XSS_PROTECTION', '1; mode=block'),
    referrerPolicy: safeEnv.get('API_SECURITY_REFERRER_POLICY', 'strict-origin-when-cross-origin'),
    permissionsPolicy: safeEnv.get(
        'API_SECURITY_PERMISSIONS_POLICY',
        'camera=(), microphone=(), geolocation=()'
    )
});

/**
 * Validation configuration helper
 */
export const getValidationConfig = () => ({
    maxBodySize: safeEnv.getNumber('API_VALIDATION_MAX_BODY_SIZE', 10485760),
    maxRequestTime: safeEnv.getNumber('API_VALIDATION_MAX_REQUEST_TIME', 30000),
    allowedContentTypes: parseCommaSeparated(
        safeEnv.get('API_VALIDATION_ALLOWED_CONTENT_TYPES', 'application/json,multipart/form-data')
    ),
    requiredHeaders: parseCommaSeparated(
        safeEnv.get('API_VALIDATION_REQUIRED_HEADERS', 'user-agent')
    ),
    clerkAuthEnabled: safeEnv.getBoolean('API_VALIDATION_CLERK_AUTH_ENABLED', true),
    clerkAuthHeaders: parseCommaSeparated(
        safeEnv.get('API_VALIDATION_CLERK_AUTH_HEADERS', 'authorization')
    ),
    sanitizeEnabled: safeEnv.getBoolean('API_VALIDATION_SANITIZE_ENABLED', true),
    sanitizeMaxStringLength: safeEnv.getNumber('API_VALIDATION_SANITIZE_MAX_STRING_LENGTH', 1000),
    sanitizeRemoveHtmlTags: safeEnv.getBoolean('API_VALIDATION_SANITIZE_REMOVE_HTML_TAGS', true),
    sanitizeAllowedChars: safeEnv.get(
        'API_VALIDATION_SANITIZE_ALLOWED_CHARS',
        '[\\w\\s\\-.,!?@#$%&*()+=]'
    )
});

/**
 * Response configuration helper
 */
export const getResponseConfig = () => ({
    formatEnabled: safeEnv.getBoolean('API_RESPONSE_FORMAT_ENABLED', true),
    includeTimestamp: safeEnv.getBoolean('API_RESPONSE_INCLUDE_TIMESTAMP', true),
    includeVersion: safeEnv.getBoolean('API_RESPONSE_INCLUDE_VERSION', true),
    apiVersion: safeEnv.get('API_RESPONSE_API_VERSION', '1.0.0'),
    includeRequestId: safeEnv.getBoolean('API_RESPONSE_INCLUDE_REQUEST_ID', true),
    includeMetadata: safeEnv.getBoolean('API_RESPONSE_INCLUDE_METADATA', true),
    successMessage: safeEnv.get('API_RESPONSE_SUCCESS_MESSAGE', 'Success'),
    errorMessage: safeEnv.get('API_RESPONSE_ERROR_MESSAGE', 'An error occurred')
});

/**
 * Database pool configuration helper
 */
export const getDatabasePoolConfig = () => ({
    max: safeEnv.getNumber('DB_POOL_MAX_CONNECTIONS', 10),
    idleTimeoutMillis: safeEnv.getNumber('DB_POOL_IDLE_TIMEOUT_MS', 30000),
    connectionTimeoutMillis: safeEnv.getNumber('DB_POOL_CONNECTION_TIMEOUT_MS', 2000)
});

/**
 * Creates the API environment validation function.
 * @remarks
 * Uses the ApiEnvSchema to validate environment variables at startup.
 * @see ApiEnvSchema
 * @see createStartupValidator
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for Zod schema compatibility with createStartupValidator
const _validateApiEnv = createStartupValidator(ApiEnvSchema as any, 'API');

/**
 * The validated API environment object.
 * @remarks
 * This object is populated after calling {@link validateApiEnv}.
 */
export let env: z.infer<typeof ApiEnvSchema>;

/**
 * Validate and populate the environment object
 * Must be called before using the env object
 */
export const validateApiEnv = (): void => {
    env = _validateApiEnv() as z.infer<typeof ApiEnvSchema>;
};

// Export the schema for testing
export { ApiEnvSchema };
