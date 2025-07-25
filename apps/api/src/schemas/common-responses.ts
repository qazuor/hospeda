import { ServiceErrorCode } from '@repo/types';
/**
 * Common Response Schemas
 * Reusable OpenAPI response schemas using existing types
 */
import { z } from 'zod';

/**
 * Base error response schema
 */
export const BaseErrorSchema = z.object({
    success: z.literal(false),
    error: z.object({
        code: z.nativeEnum(ServiceErrorCode),
        message: z.string(),
        requestId: z.string(),
        timestamp: z.string().datetime()
    })
});

/**
 * Validation error response schema with details
 */
export const ValidationErrorSchema = BaseErrorSchema.extend({
    error: BaseErrorSchema.shape.error.extend({
        details: z
            .object({
                field: z.string(),
                message: z.string(),
                code: z.string()
            })
            .array()
            .optional()
    })
});

/**
 * Success response schema factory
 */
export const createSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) => {
    return z.object({
        success: z.literal(true),
        data: dataSchema
    });
};

/**
 * Paginated response schema factory
 */
export const createPaginatedSchema = <T extends z.ZodTypeAny>(itemSchema: T) => {
    return z.object({
        success: z.literal(true),
        data: z.object({
            items: z.array(itemSchema),
            pagination: z.object({
                page: z.number(),
                limit: z.number(),
                total: z.number(),
                totalPages: z.number()
            })
        })
    });
};

/**
 * Common OpenAPI response definitions
 */
export const CommonResponses = {
    ValidationError: {
        description: 'Validation error',
        content: {
            'application/json': {
                schema: ValidationErrorSchema
            }
        }
    },
    NotFound: {
        description: 'Resource not found',
        content: {
            'application/json': {
                schema: BaseErrorSchema
            }
        }
    },
    Unauthorized: {
        description: 'Authentication required',
        content: {
            'application/json': {
                schema: BaseErrorSchema
            }
        }
    },
    Forbidden: {
        description: 'Insufficient permissions',
        content: {
            'application/json': {
                schema: BaseErrorSchema
            }
        }
    },
    InternalError: {
        description: 'Internal server error',
        content: {
            'application/json': {
                schema: BaseErrorSchema
            }
        }
    }
};
