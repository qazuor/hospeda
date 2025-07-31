/**
 * Environment configuration with validation
 * Centralized environment variables with Zod validation
 */
import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env files
config({ path: ['.env.local', '.env'] });

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
    API_LOG_TRUNCATE_LONG_TEXT_AT: z.coerce.number().default(1000),
    API_LOG_STRINGIFY_OBJECTS: z.coerce.boolean().default(false),

    // CORS Configuration
    CORS_ORIGINS: z
        .string()
        .default('http://localhost:3000,http://localhost:5173,http://localhost:4173'),
    CORS_ALLOW_CREDENTIALS: z.coerce.boolean().default(true),
    CORS_MAX_AGE: z.coerce.number().default(86400), // 24 hours
    CORS_ALLOW_METHODS: z.string().default('GET,POST,PUT,DELETE,PATCH,OPTIONS'),
    CORS_ALLOW_HEADERS: z.string().default('Content-Type,Authorization,X-Requested-With'),
    CORS_EXPOSE_HEADERS: z.string().default('Content-Length,X-Request-ID'),

    // Cache Configuration
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

    // Rate Limiting Configuration
    RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
    RATE_LIMIT_KEY_GENERATOR: z.enum(['ip', 'user', 'custom']).default('ip'),
    RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: z.coerce.boolean().default(false),
    RATE_LIMIT_SKIP_FAILED_REQUESTS: z.coerce.boolean().default(false),
    RATE_LIMIT_STANDARD_HEADERS: z.coerce.boolean().default(true),
    RATE_LIMIT_LEGACY_HEADERS: z.coerce.boolean().default(false),
    RATE_LIMIT_MESSAGE: z.string().default('Too many requests, please try again later.'),

    // Security Configuration
    SECURITY_ENABLED: z.coerce.boolean().default(true),
    SECURITY_CSRF_ENABLED: z.coerce.boolean().default(true),
    SECURITY_CSRF_ORIGIN: z.string().default('http://localhost:3000'),
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

    // Internationalization Configuration
    SUPPORTED_LOCALES: z.string().default('en,es'),
    DEFAULT_LOCALE: z.string().default('en'),

    // Database Configuration (optional for now)
    DATABASE_URL: z.string().optional(),

    // Auth Configuration (optional for now)
    CLERK_PUBLISHABLE_KEY: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional()
});

// Parse and validate environment variables
const parseEnv = () => {
    try {
        return EnvSchema.parse(process.env);
    } catch (error) {
        console.error('❌ Invalid environment configuration:', error);
        process.exit(1);
    }
};

export const env = parseEnv();

// Export types for usage in other files
export type Env = z.infer<typeof EnvSchema>;
