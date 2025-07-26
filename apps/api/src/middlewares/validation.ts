import { logger } from '@repo/logger';
import { IdSchema, InternationalPhoneRegex, SlugRegex } from '@repo/schemas';
import type { Context } from 'hono';
/**
 * Validation Infrastructure
 * Optimized validation system using centralized schemas from @repo/schemas
 */
import { z } from 'zod';

/**
 * API-specific validation schemas for configurations not available in @repo/schemas
 */
export const APIValidationSchemas = {
    // Date validation (ISO string) - keeping as API-specific format requirement
    date: z.string().datetime({ message: 'Must be a valid ISO date string' }),

    // Positive integer
    positiveInt: z.coerce.number().int().positive({ message: 'Must be a positive integer' }),

    // Non-negative integer (includes 0)
    nonNegativeInt: z.coerce.number().int().min(0, { message: 'Must be a non-negative integer' }),

    // API pagination with coercion for query params
    paginationLimit: z.coerce.number().int().min(1).max(100).default(20),
    paginationOffset: z.coerce.number().int().min(0).default(0),

    // Search query (3-100 characters) - API-specific length limits
    searchQuery: z
        .string()
        .min(3, { message: 'Search query must be at least 3 characters' })
        .max(100, { message: 'Search query must not exceed 100 characters' }),

    // Money amounts (in cents to avoid floating point issues) - API-specific
    moneyInCents: z
        .number()
        .int()
        .min(0, { message: 'Amount must be a non-negative integer in cents' }),

    // Rating (1-5 stars) - API-specific range
    rating: z.number().min(1).max(5, { message: 'Rating must be between 1 and 5' }),

    // Language code (ISO 639-1) - API-specific format
    languageCode: z.string().regex(/^[a-z]{2}$/, {
        message: 'Must be a valid ISO 639-1 language code (e.g., "en", "es")'
    }),

    // Country code (ISO 3166-1 alpha-2) - API-specific format
    countryCode: z.string().regex(/^[A-Z]{2}$/, {
        message: 'Must be a valid ISO 3166-1 alpha-2 country code (e.g., "US", "ES")'
    })
} as const;

/**
 * Sanitization utilities
 */
export const DataSanitizer = {
    /**
     * Sanitize and normalize string input
     */
    sanitizeString(input: string): string {
        return input
            .trim() // Remove leading/trailing whitespace
            .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
            .replace(/[<>]/g, ''); // Remove basic HTML characters
    },

    /**
     * Sanitize search query
     */
    sanitizeSearchQuery(query: string): string {
        return query
            .trim()
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, hyphens
            .replace(/\s+/g, ' ') // Normalize spaces
            .slice(0, 100); // Limit length
    },

    /**
     * Sanitize slug
     */
    sanitizeSlug(input: string): string {
        return input
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Remove multiple consecutive hyphens
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    },

    /**
     * Sanitize email
     */
    sanitizeEmail(email: string): string {
        return email.toLowerCase().trim();
    }
} as const;

/**
 * Validation error details
 */
export interface ValidationErrorDetail {
    field: string;
    message: string;
    code: string;
}

/**
 * Validation result wrapper
 */
export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    errors?: ValidationErrorDetail[];
}

/**
 * Advanced validation utilities
 */
export const ValidatorUtils = {
    /**
     * Parse and validate data with detailed error reporting
     */
    validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
        try {
            const result = schema.safeParse(data);

            if (result.success) {
                return {
                    success: true,
                    data: result.data
                };
            }

            const errors: ValidationErrorDetail[] = result.error.errors.map((err) => ({
                field: err.path.join('.') || 'root',
                message: err.message,
                code: err.code
            }));

            return {
                success: false,
                errors
            };
        } catch (error) {
            logger.error(
                'Validation error',
                error instanceof Error ? error.message : 'Unknown error'
            );

            return {
                success: false,
                errors: [
                    {
                        field: 'root',
                        message: 'Validation failed due to an internal error',
                        code: 'internal_error'
                    }
                ]
            };
        }
    },

    /**
     * Validate query parameters with sanitization
     */
    validateQuery<T>(schema: z.ZodSchema<T>, c: Context): ValidationResult<T> {
        const queryParams = Object.fromEntries(new URL(c.req.url).searchParams.entries());
        return ValidatorUtils.validate(schema, queryParams);
    },

    /**
     * Validate JSON body with sanitization
     */
    async validateBody<T>(schema: z.ZodSchema<T>, c: Context): Promise<ValidationResult<T>> {
        try {
            const body = await c.req.json();
            return ValidatorUtils.validate(schema, body);
        } catch {
            return {
                success: false,
                errors: [
                    {
                        field: 'body',
                        message: 'Invalid JSON format',
                        code: 'invalid_json'
                    }
                ]
            };
        }
    },

    /**
     * Validate path parameters
     */
    validateParams<T>(schema: z.ZodSchema<T>, c: Context): ValidationResult<T> {
        const params = c.req.param();
        return ValidatorUtils.validate(schema, params);
    }
} as const;

/**
 * Validation middleware factory
 */
export const ValidationMiddleware = {
    /**
     * Create a validation middleware for query parameters
     */
    query<T>(schema: z.ZodSchema<T>) {
        return async (c: Context, next: () => Promise<void>) => {
            const result = ValidatorUtils.validateQuery(schema, c);

            if (!result.success) {
                return c.json(
                    {
                        error: 'Validation Error',
                        message: 'The provided query parameters are invalid',
                        details: result.errors
                    },
                    400
                );
            }

            // Store validated data in context for route handlers
            c.set('validatedQuery', result.data);
            await next();
        };
    },

    /**
     * Create a validation middleware for request body
     */
    body<T>(schema: z.ZodSchema<T>) {
        return async (c: Context, next: () => Promise<void>) => {
            const result = await ValidatorUtils.validateBody(schema, c);

            if (!result.success) {
                return c.json(
                    {
                        error: 'Validation Error',
                        message: 'The provided request body is invalid',
                        details: result.errors
                    },
                    400
                );
            }

            // Store validated data in context for route handlers
            c.set('validatedBody', result.data);
            await next();
        };
    },

    /**
     * Create a validation middleware for path parameters
     */
    params<T>(schema: z.ZodSchema<T>) {
        return async (c: Context, next: () => Promise<void>) => {
            const result = ValidatorUtils.validateParams(schema, c);

            if (!result.success) {
                return c.json(
                    {
                        error: 'Validation Error',
                        message: 'The provided path parameters are invalid',
                        details: result.errors
                    },
                    400
                );
            }

            // Store validated data in context for route handlers
            c.set('validatedParams', result.data);
            await next();
        };
    }
} as const;

/**
 * Common validation schemas for API endpoints
 */
export const APISchemas = {
    // Standard pagination query
    pagination: z.object({
        limit: APIValidationSchemas.paginationLimit,
        offset: APIValidationSchemas.paginationOffset,
        sort: z.string().optional(),
        order: z.enum(['asc', 'desc']).default('asc')
    }),

    // Search with pagination
    search: z.object({
        q: APIValidationSchemas.searchQuery,
        limit: APIValidationSchemas.paginationLimit,
        offset: APIValidationSchemas.paginationOffset,
        type: z.string().optional()
    }),

    // Common ID parameter
    idParam: z.object({
        id: IdSchema
    }),

    // Geolocation query
    geolocation: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radius: z.coerce.number().min(0.1).max(100).default(10) // km
    }),

    // Date range query
    dateRange: z
        .object({
            startDate: APIValidationSchemas.date,
            endDate: APIValidationSchemas.date
        })
        .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
            message: 'Start date must be before or equal to end date'
        }),

    // Language preference
    language: z.object({
        lang: APIValidationSchemas.languageCode.default('en')
    })
} as const;

/**
 * Re-export centralized schemas for backward compatibility and create API-specific schemas
 * @deprecated Use direct imports from @repo/schemas instead where possible
 */
export const CommonSchemas = {
    // Direct re-exports from @repo/schemas
    uuid: IdSchema,

    // Basic validation patterns using centralized regex patterns where possible
    email: z.string().email({ message: 'Must be a valid email address' }),
    url: z.string().url({ message: 'Must be a valid URL' }),
    phone: z.string().regex(InternationalPhoneRegex, {
        message: 'Must be a valid international phone number'
    }),
    slug: z.string().regex(SlugRegex, {
        message: 'Must be a valid slug (lowercase letters, numbers, and hyphens only)'
    }),
    latitude: z.number().min(-90).max(90, { message: 'Latitude must be between -90 and 90' }),
    longitude: z.number().min(-180).max(180, { message: 'Longitude must be between -180 and 180' }),

    // API-specific schemas
    date: APIValidationSchemas.date,
    positiveInt: APIValidationSchemas.positiveInt,
    nonNegativeInt: APIValidationSchemas.nonNegativeInt,
    paginationLimit: APIValidationSchemas.paginationLimit,
    paginationOffset: APIValidationSchemas.paginationOffset,
    searchQuery: APIValidationSchemas.searchQuery,
    moneyInCents: APIValidationSchemas.moneyInCents,
    rating: APIValidationSchemas.rating,
    languageCode: APIValidationSchemas.languageCode,
    countryCode: APIValidationSchemas.countryCode
} as const;

/**
 * Type helpers for validated data access
 */
declare module 'hono' {
    interface ContextVariableMap {
        validatedQuery?: unknown;
        validatedBody?: unknown;
        validatedParams?: unknown;
    }
}

export default {
    APIValidationSchemas,
    CommonSchemas, // Backward compatibility
    DataSanitizer,
    ValidatorUtils,
    ValidationMiddleware,
    APISchemas
};
