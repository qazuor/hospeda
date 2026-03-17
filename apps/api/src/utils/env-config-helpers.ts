/**
 * Configuration helper functions derived from environment variables.
 * These helpers read from process.env directly via safeEnv so they work
 * both before and after validateApiEnv() is called.
 */

/**
 * Helper to safely access process.env with typed defaults.
 * Intentionally duplicated from env.ts to avoid a circular import.
 */
const _safe = {
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
 * Parse comma-separated string into trimmed array.
 *
 * @param value - Raw comma-separated string or undefined
 * @returns Array of non-empty trimmed strings
 *
 * @example
 * ```ts
 * parseCommaSeparated('a, b, c') // ['a', 'b', 'c']
 * parseCommaSeparated(undefined) // []
 * ```
 */
export const parseCommaSeparated = (value: string | undefined): string[] => {
    if (!value || typeof value !== 'string') return [];
    return value.split(',').map((item) => item.trim());
};

/**
 * Parse CORS origins from environment variable string.
 *
 * @param origins - Comma-separated origin URLs or undefined
 * @returns Array of origin strings; falls back to localhost defaults
 */
export const parseCorsOrigins = (origins: string | undefined): string[] => {
    if (!origins || typeof origins !== 'string')
        return ['http://localhost:3000', 'http://localhost:4321'];
    return origins.split(',').map((origin) => origin.trim());
};

/**
 * Returns the resolved cache configuration from environment variables.
 */
export const getCacheConfig = () => ({
    enabled: _safe.getBoolean('API_CACHE_ENABLED', true),
    defaultMaxAge: _safe.getNumber('API_CACHE_DEFAULT_MAX_AGE', 300),
    defaultStaleWhileRevalidate: _safe.getNumber('API_CACHE_DEFAULT_STALE_WHILE_REVALIDATE', 60),
    defaultStaleIfError: _safe.getNumber('API_CACHE_DEFAULT_STALE_IF_ERROR', 86400),
    maxAge: _safe.getNumber('API_CACHE_DEFAULT_MAX_AGE', 300),
    staleWhileRevalidate: _safe.getNumber('API_CACHE_DEFAULT_STALE_WHILE_REVALIDATE', 60),
    staleIfError: _safe.getNumber('API_CACHE_DEFAULT_STALE_IF_ERROR', 86400),
    publicEndpoints: parseCommaSeparated(
        _safe.get('API_CACHE_PUBLIC_ENDPOINTS', '/api/v1/public/accommodations,/health')
    ),
    privateEndpoints: parseCommaSeparated(
        _safe.get('API_CACHE_PRIVATE_ENDPOINTS', '/api/v1/public/users')
    ),
    noCacheEndpoints: parseCommaSeparated(
        _safe.get('API_CACHE_NO_CACHE_ENDPOINTS', '/health/db,/docs')
    ),
    etagEnabled: _safe.getBoolean('API_CACHE_ETAG_ENABLED', true),
    lastModifiedEnabled: _safe.getBoolean('API_CACHE_LAST_MODIFIED_ENABLED', true)
});

/**
 * Returns the resolved CORS configuration from environment variables.
 */
export const getCorsConfig = () => ({
    origins: parseCorsOrigins(
        _safe.get('API_CORS_ORIGINS', 'http://localhost:3000,http://localhost:4321')
    ),
    allowCredentials: _safe.getBoolean('API_CORS_ALLOW_CREDENTIALS', true),
    maxAge: _safe.getNumber('API_CORS_MAX_AGE', 86400),
    allowMethods: parseCommaSeparated(
        _safe.get('API_CORS_ALLOW_METHODS', 'GET,POST,PUT,DELETE,PATCH,OPTIONS')
    ),
    allowHeaders: parseCommaSeparated(
        _safe.get('API_CORS_ALLOW_HEADERS', 'Content-Type,Authorization,X-Requested-With')
    ),
    exposeHeaders: parseCommaSeparated(
        _safe.get('API_CORS_EXPOSE_HEADERS', 'Content-Length,X-Request-ID')
    )
});

/**
 * Returns the resolved compression configuration from environment variables.
 */
export const getCompressionConfig = () => ({
    enabled: _safe.getBoolean('API_COMPRESSION_ENABLED', true),
    level: _safe.getNumber('API_COMPRESSION_LEVEL', 6),
    threshold: _safe.getNumber('API_COMPRESSION_THRESHOLD', 1024),
    chunkSize: _safe.getNumber('API_COMPRESSION_CHUNK_SIZE', 16384),
    filter: _safe.get(
        'API_COMPRESSION_FILTER',
        'text/*,application/json,application/xml,application/javascript'
    ),
    excludeEndpoints: parseCommaSeparated(
        _safe.get('API_COMPRESSION_EXCLUDE_ENDPOINTS', '/health/db,/docs')
    ),
    algorithms: _safe.get('API_COMPRESSION_ALGORITHMS', 'gzip,deflate')
});

/**
 * Returns the resolved rate limiting configuration from environment variables.
 */
export const getRateLimitConfig = () => ({
    enabled: _safe.getBoolean('API_RATE_LIMIT_ENABLED', true),
    windowMs: _safe.getNumber('API_RATE_LIMIT_WINDOW_MS', 900000),
    maxRequests: _safe.getNumber('API_RATE_LIMIT_MAX_REQUESTS', 100),
    keyGenerator: _safe.get('API_RATE_LIMIT_KEY_GENERATOR', 'ip'),
    skipSuccessfulRequests: _safe.getBoolean('API_RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS', false),
    skipFailedRequests: _safe.getBoolean('API_RATE_LIMIT_SKIP_FAILED_REQUESTS', false),
    standardHeaders: _safe.getBoolean('API_RATE_LIMIT_STANDARD_HEADERS', true),
    legacyHeaders: _safe.getBoolean('API_RATE_LIMIT_LEGACY_HEADERS', false),
    message: _safe.get('API_RATE_LIMIT_MESSAGE', 'Too many requests, please try again later.'),
    trustProxy: _safe.getBoolean('API_RATE_LIMIT_TRUST_PROXY', false),
    trustedProxies: parseCommaSeparated(_safe.get('API_RATE_LIMIT_TRUSTED_PROXIES', '')),
    authEnabled: _safe.getBoolean('API_RATE_LIMIT_AUTH_ENABLED', true),
    authWindowMs: _safe.getNumber('API_RATE_LIMIT_AUTH_WINDOW_MS', 300000),
    authMaxRequests: _safe.getNumber('API_RATE_LIMIT_AUTH_MAX_REQUESTS', 50),
    authMessage: _safe.get(
        'API_RATE_LIMIT_AUTH_MESSAGE',
        'Too many authentication requests, please try again later.'
    ),
    publicEnabled: _safe.getBoolean('API_RATE_LIMIT_PUBLIC_ENABLED', true),
    publicWindowMs: _safe.getNumber('API_RATE_LIMIT_PUBLIC_WINDOW_MS', 3600000),
    publicMaxRequests: _safe.getNumber('API_RATE_LIMIT_PUBLIC_MAX_REQUESTS', 1000),
    publicMessage: _safe.get(
        'API_RATE_LIMIT_PUBLIC_MESSAGE',
        'Too many API requests, please try again later.'
    ),
    adminEnabled: _safe.getBoolean('API_RATE_LIMIT_ADMIN_ENABLED', true),
    adminWindowMs: _safe.getNumber('API_RATE_LIMIT_ADMIN_WINDOW_MS', 600000),
    adminMaxRequests: _safe.getNumber('API_RATE_LIMIT_ADMIN_MAX_REQUESTS', 200),
    adminMessage: _safe.get(
        'API_RATE_LIMIT_ADMIN_MESSAGE',
        'Too many admin requests, please try again later.'
    ),
    billingEnabled: _safe.getBoolean('API_RATE_LIMIT_BILLING_ENABLED', true),
    billingWindowMs: _safe.getNumber('API_RATE_LIMIT_BILLING_WINDOW_MS', 900000),
    billingMaxRequests: _safe.getNumber('API_RATE_LIMIT_BILLING_MAX_REQUESTS', 10),
    billingMessage: _safe.get(
        'API_RATE_LIMIT_BILLING_MESSAGE',
        'Too many billing requests, please try again later.'
    ),
    webhookEnabled: _safe.getBoolean('API_RATE_LIMIT_WEBHOOK_ENABLED', true),
    webhookWindowMs: _safe.getNumber('API_RATE_LIMIT_WEBHOOK_WINDOW_MS', 60000),
    webhookMaxRequests: _safe.getNumber('API_RATE_LIMIT_WEBHOOK_MAX_REQUESTS', 100),
    webhookMessage: _safe.get(
        'API_RATE_LIMIT_WEBHOOK_MESSAGE',
        'Too many webhook requests, please try again later.'
    )
});

/**
 * Returns the resolved security configuration from environment variables.
 */
export const getSecurityConfig = () => ({
    enabled: _safe.getBoolean('API_SECURITY_ENABLED', true),
    csrfEnabled: _safe.getBoolean('API_SECURITY_CSRF_ENABLED', true),
    csrfOrigin: _safe.get('API_SECURITY_CSRF_ORIGIN'),
    csrfOrigins: parseCommaSeparated(
        _safe.get('API_SECURITY_CSRF_ORIGINS', 'http://localhost:3000,http://localhost:5173')
    ),
    headersEnabled: _safe.getBoolean('API_SECURITY_HEADERS_ENABLED', true),
    // Default CSP for API responses. Note: security.ts middleware hardcodes its own CSP policy.
    contentSecurityPolicy: _safe.get(
        'API_SECURITY_CONTENT_SECURITY_POLICY',
        "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-src 'none';"
    ),
    strictTransportSecurity: _safe.get(
        'API_SECURITY_STRICT_TRANSPORT_SECURITY',
        'max-age=31536000; includeSubDomains'
    ),
    xFrameOptions: _safe.get('API_SECURITY_X_FRAME_OPTIONS', 'SAMEORIGIN'),
    xContentTypeOptions: _safe.get('API_SECURITY_X_CONTENT_TYPE_OPTIONS', 'nosniff'),
    xXssProtection: _safe.get('API_SECURITY_X_XSS_PROTECTION', '0'),
    referrerPolicy: _safe.get('API_SECURITY_REFERRER_POLICY', 'strict-origin-when-cross-origin'),
    permissionsPolicy: _safe.get(
        'API_SECURITY_PERMISSIONS_POLICY',
        'camera=(), microphone=(), geolocation=()'
    )
});

/**
 * Returns the resolved validation configuration from environment variables.
 */
export const getValidationConfig = () => ({
    maxBodySize: _safe.getNumber('API_VALIDATION_MAX_BODY_SIZE', 10485760),
    maxRequestTime: _safe.getNumber('API_VALIDATION_MAX_REQUEST_TIME', 30000),
    allowedContentTypes: parseCommaSeparated(
        _safe.get('API_VALIDATION_ALLOWED_CONTENT_TYPES', 'application/json,multipart/form-data')
    ),
    requiredHeaders: parseCommaSeparated(
        _safe.get('API_VALIDATION_REQUIRED_HEADERS', 'user-agent')
    ),
    authEnabled: _safe.getBoolean('API_VALIDATION_AUTH_ENABLED', true),
    authHeaders: parseCommaSeparated(_safe.get('API_VALIDATION_AUTH_HEADERS', 'authorization')),
    sanitizeEnabled: _safe.getBoolean('API_VALIDATION_SANITIZE_ENABLED', true),
    sanitizeMaxStringLength: _safe.getNumber('API_VALIDATION_SANITIZE_MAX_STRING_LENGTH', 1000),
    sanitizeRemoveHtmlTags: _safe.getBoolean('API_VALIDATION_SANITIZE_REMOVE_HTML_TAGS', true),
    sanitizeAllowedChars: _safe.get(
        'API_VALIDATION_SANITIZE_ALLOWED_CHARS',
        '[\\w\\s\\-.,!?@#$%&*()+=]'
    )
});

/**
 * Returns the resolved response format configuration from environment variables.
 */
export const getResponseConfig = () => ({
    formatEnabled: _safe.getBoolean('API_RESPONSE_FORMAT_ENABLED', true),
    includeTimestamp: _safe.getBoolean('API_RESPONSE_INCLUDE_TIMESTAMP', true),
    includeVersion: _safe.getBoolean('API_RESPONSE_INCLUDE_VERSION', true),
    apiVersion: _safe.get('API_RESPONSE_API_VERSION', '1.0.0'),
    includeRequestId: _safe.getBoolean('API_RESPONSE_INCLUDE_REQUEST_ID', true),
    includeMetadata: _safe.getBoolean('API_RESPONSE_INCLUDE_METADATA', true),
    successMessage: _safe.get('API_RESPONSE_SUCCESS_MESSAGE', 'Success'),
    errorMessage: _safe.get('API_RESPONSE_ERROR_MESSAGE', 'An error occurred')
});

/**
 * Returns the resolved database pool configuration.
 * In serverless environments (Vercel), defaults to max 3 connections
 * to stay within Neon pooler limits.
 */
export const getDatabasePoolConfig = () => {
    const isServerless = !!process.env.VERCEL;
    const defaultMax = isServerless ? 3 : 10;

    return {
        max: _safe.getNumber('HOSPEDA_DB_POOL_MAX_CONNECTIONS', defaultMax),
        idleTimeoutMillis: _safe.getNumber('HOSPEDA_DB_POOL_IDLE_TIMEOUT_MS', 30000),
        connectionTimeoutMillis: _safe.getNumber('HOSPEDA_DB_POOL_CONNECTION_TIMEOUT_MS', 2000)
    };
};
