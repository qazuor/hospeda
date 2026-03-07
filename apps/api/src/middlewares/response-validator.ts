/**
 * Response Validator Middleware
 * Validates that API responses conform to the expected schema structure.
 * Helps catch malformed responses during development and optionally in production.
 */

import type { Context, MiddlewareHandler, Next } from 'hono';
import { z } from 'zod';
import { paginationMetadataSchema } from '../schemas/response-schemas';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';

/**
 * Configuration for response validation middleware
 */
export interface ResponseValidatorConfig {
    /**
     * Enable response validation (default: true in development, false in production)
     */
    enabled: boolean;

    /**
     * Log warnings for invalid responses (default: true)
     */
    logWarnings: boolean;

    /**
     * Reject invalid responses with 500 error (default: false)
     * Enable with caution - may break endpoints returning non-standard responses
     */
    rejectInvalid: boolean;

    /**
     * Paths to exclude from validation (e.g., /docs, /metrics)
     */
    excludePaths: string[];
}

/**
 * Re-export pagination schema for validation use
 * Uses the centralized schema from response-schemas.ts
 */
const paginationSchema = paginationMetadataSchema;

/**
 * Schema for success response structure
 */
const successResponseSchema = z.object({
    success: z.literal(true),
    data: z.unknown(),
    metadata: z
        .object({
            timestamp: z.string(),
            version: z.string().optional(),
            requestId: z.string().optional(),
            pagination: paginationSchema.optional()
        })
        .optional()
});

/**
 * Schema for error response structure
 */
const errorResponseSchema = z.object({
    success: z.literal(false),
    error: z.object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional()
    }),
    metadata: z
        .object({
            timestamp: z.string(),
            version: z.string().optional(),
            requestId: z.string().optional()
        })
        .optional()
});

/**
 * Schema for paginated list response structure
 */
const paginatedResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        items: z.array(z.unknown()),
        pagination: paginationSchema
    }),
    metadata: z
        .object({
            timestamp: z.string(),
            version: z.string().optional(),
            requestId: z.string().optional()
        })
        .optional()
});

/**
 * Combined API response schema
 */
const apiResponseSchema = z.union([
    successResponseSchema,
    errorResponseSchema,
    paginatedResponseSchema
]);

/**
 * Get default configuration based on environment
 */
const getDefaultConfig = (): ResponseValidatorConfig => ({
    enabled: env.NODE_ENV === 'development' || env.NODE_ENV === 'test',
    logWarnings: true,
    rejectInvalid: false,
    excludePaths: ['/docs', '/reference', '/ui', '/metrics', '/health', '/favicon.ico']
});

/**
 * Validate a response body against the API response schema
 * @param body - The response body to validate
 * @returns Validation result with success flag and optional errors
 */
const validateResponse = (body: unknown): { valid: boolean; errors?: z.ZodIssue[] } => {
    const result = apiResponseSchema.safeParse(body);
    if (result.success) {
        return { valid: true };
    }
    return { valid: false, errors: result.error.issues };
};

/**
 * Check if a path should be excluded from validation
 * @param path - The request path
 * @param excludePaths - List of paths to exclude
 * @returns true if the path should be excluded
 */
const shouldExcludePath = (path: string, excludePaths: string[]): boolean => {
    return excludePaths.some((excludePath) => path.startsWith(excludePath));
};

/**
 * Creates a response validator middleware with the given configuration
 * @param userConfig - Partial configuration to override defaults
 * @returns Hono middleware handler
 */
export const createResponseValidatorMiddleware = (
    userConfig: Partial<ResponseValidatorConfig> = {}
): MiddlewareHandler => {
    const config = { ...getDefaultConfig(), ...userConfig };

    return async (c: Context, next: Next) => {
        // Skip if disabled
        if (!config.enabled) {
            await next();
            return;
        }

        // Skip excluded paths
        if (shouldExcludePath(c.req.path, config.excludePaths)) {
            await next();
            return;
        }

        // Store original json method
        const originalJson = c.json.bind(c);

        // Override json method to validate responses
        // biome-ignore lint/suspicious/noExplicitAny: Required for middleware override
        c.json = (data: any, status?: any, headers?: any) => {
            // Validate the response
            const validation = validateResponse(data);

            if (!validation.valid && config.logWarnings) {
                apiLogger.warn({
                    message: 'Response validation failed',
                    path: c.req.path,
                    method: c.req.method,
                    status,
                    errors: validation.errors,
                    responsePreview:
                        typeof data === 'object' ? JSON.stringify(data).slice(0, 500) : String(data)
                });
            }

            // If configured to reject invalid responses, return error
            if (!validation.valid && config.rejectInvalid) {
                const errorResponse = {
                    success: false,
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'Response validation failed',
                        details:
                            env.NODE_ENV === 'development'
                                ? { validationErrors: validation.errors }
                                : undefined
                    },
                    metadata: {
                        timestamp: new Date().toISOString(),
                        requestId: c.get('requestId') || 'unknown'
                    }
                };
                return originalJson(errorResponse, 500, headers);
            }

            // Return original response (validated or not)
            return originalJson(data, status, headers);
        };

        await next();
    };
};

/**
 * Default response validator middleware
 * Uses environment-based configuration
 */
export const responseValidatorMiddleware = createResponseValidatorMiddleware();

/**
 * Export schemas for testing and external use
 */
export {
    apiResponseSchema,
    successResponseSchema,
    errorResponseSchema,
    paginatedResponseSchema,
    paginationSchema
};
