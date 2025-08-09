import { z } from 'zod';
import { env } from '../utils/env';

/**
 * Validation configuration schema
 */
export const ValidationConfigSchema = z.object({
    maxBodySize: z
        .number()
        .positive()
        .default(10 * 1024 * 1024), // 10MB
    maxRequestTime: z.number().positive().default(30000), // 30s
    allowedContentTypes: z.array(z.string()).default(['application/json', 'multipart/form-data']),
    requiredHeaders: z.array(z.string()).default(['user-agent']),
    sanitizeOptions: z.object({
        removeHtmlTags: z.boolean().default(true),
        maxStringLength: z.number().positive().default(1000),
        allowedCharacters: z.string().default('/[\\w\\s\\-.,!?@#$%&*()+=]/g')
    }),
    clerkAuth: z.object({
        enabled: z.boolean().default(true),
        requiredHeaders: z.array(z.string()).default(['authorization'])
    })
});

/**
 * Validation configuration type
 */
export type ValidationConfig = z.infer<typeof ValidationConfigSchema>;

/**
 * Default validation configuration
 */
export const defaultValidationConfig: ValidationConfig = {
    maxBodySize: 10 * 1024 * 1024, // 10MB
    maxRequestTime: 30000, // 30s
    allowedContentTypes: ['application/json', 'multipart/form-data'],
    requiredHeaders: ['user-agent'],
    sanitizeOptions: {
        removeHtmlTags: true,
        maxStringLength: 1000,
        allowedCharacters: '/[\\w\\s\\-.,!?@#$%&*()+=]/g'
    },
    clerkAuth: {
        enabled: true,
        requiredHeaders: ['authorization']
    }
};

/**
 * Critical headers that should always be validated
 */
export const CRITICAL_HEADERS = {
    // Security
    Authorization: 'Bearer token for Clerk authentication',
    'User-Agent': 'Client identification (used in rate limiting)',

    // Content
    'Content-Type': 'application/json for requests with body',
    Accept: 'application/json for responses',

    // Internationalization
    'Accept-Language': 'Language preference (used in i18n)',

    // Caching
    'Accept-Encoding': 'Compression (used in compression middleware)',

    // Logging
    'X-Request-ID': 'Request ID for tracing',
    'X-Forwarded-For': 'Real IP (used in rate limiting)',
    'X-Real-IP': 'Real IP (used in rate limiting)'
} as const;

/**
 * Get validation configuration from environment or use defaults
 */
export const getValidationConfig = (): ValidationConfig => {
    try {
        // Read dynamic overrides directly from process.env to support test-time changes
        const rawAllowed =
            typeof process.env.VALIDATION_ALLOWED_CONTENT_TYPES === 'string'
                ? process.env.VALIDATION_ALLOWED_CONTENT_TYPES
                : env.VALIDATION_ALLOWED_CONTENT_TYPES;
        const rawRequired =
            typeof process.env.VALIDATION_REQUIRED_HEADERS === 'string'
                ? process.env.VALIDATION_REQUIRED_HEADERS
                : env.VALIDATION_REQUIRED_HEADERS;
        const rawClerkHeaders =
            typeof process.env.VALIDATION_CLERK_AUTH_HEADERS === 'string'
                ? process.env.VALIDATION_CLERK_AUTH_HEADERS
                : env.VALIDATION_CLERK_AUTH_HEADERS;
        const clerkEnabled =
            typeof process.env.VALIDATION_CLERK_AUTH_ENABLED === 'string'
                ? process.env.VALIDATION_CLERK_AUTH_ENABLED === 'true'
                : env.VALIDATION_CLERK_AUTH_ENABLED;

        return {
            maxBodySize:
                typeof process.env.VALIDATION_MAX_BODY_SIZE === 'string'
                    ? Number(process.env.VALIDATION_MAX_BODY_SIZE)
                    : env.VALIDATION_MAX_BODY_SIZE,
            maxRequestTime:
                typeof process.env.VALIDATION_MAX_REQUEST_TIME === 'string'
                    ? Number(process.env.VALIDATION_MAX_REQUEST_TIME)
                    : env.VALIDATION_MAX_REQUEST_TIME,
            allowedContentTypes: rawAllowed
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            requiredHeaders: rawRequired
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            sanitizeOptions: {
                removeHtmlTags:
                    typeof process.env.VALIDATION_SANITIZE_REMOVE_HTML_TAGS === 'string'
                        ? process.env.VALIDATION_SANITIZE_REMOVE_HTML_TAGS === 'true'
                        : env.VALIDATION_SANITIZE_REMOVE_HTML_TAGS,
                maxStringLength:
                    typeof process.env.VALIDATION_SANITIZE_MAX_STRING_LENGTH === 'string'
                        ? Number(process.env.VALIDATION_SANITIZE_MAX_STRING_LENGTH)
                        : env.VALIDATION_SANITIZE_MAX_STRING_LENGTH,
                allowedCharacters:
                    typeof process.env.VALIDATION_SANITIZE_ALLOWED_CHARS === 'string'
                        ? process.env.VALIDATION_SANITIZE_ALLOWED_CHARS
                        : env.VALIDATION_SANITIZE_ALLOWED_CHARS
            },
            clerkAuth: {
                enabled: clerkEnabled,
                requiredHeaders: rawClerkHeaders
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
            }
        };
    } catch {
        return defaultValidationConfig;
    }
};
