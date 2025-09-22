import { z } from 'zod';

/**
 * Common API Response Schemas
 *
 * This file contains reusable schemas for API responses:
 * - Success responses
 * - Error responses
 * - Paginated responses
 * - List responses
 * - Stats responses
 */

// ============================================================================
// SUCCESS RESPONSE SCHEMAS
// ============================================================================

/**
 * Schema for successful API responses
 * Used for operations that return data with success status
 */
export const SuccessResponseSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.response.success.invalidType'
        })
        .default(true),
    message: z
        .string({
            message: 'zodError.response.message.invalidType'
        })
        .optional(),
    timestamp: z
        .date({
            message: 'zodError.response.timestamp.invalidType'
        })
        .optional()
        .default(() => new Date()),
    requestId: z
        .string({
            message: 'zodError.response.requestId.invalidType'
        })
        .uuid({ message: 'zodError.response.requestId.uuid' })
        .optional(),
    executionTime: z
        .number({
            message: 'zodError.response.executionTime.invalidType'
        })
        .min(0, { message: 'zodError.response.executionTime.min' })
        .optional()
});
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

// ============================================================================
// ERROR RESPONSE SCHEMAS
// ============================================================================

/**
 * Schema for API error responses
 * Used for operations that fail with error details
 */
export const ErrorResponseSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.response.success.invalidType'
        })
        .default(false),
    error: z.object({
        code: z
            .string({
                message: 'zodError.response.error.code.invalidType'
            })
            .min(1, { message: 'zodError.response.error.code.min' }),
        message: z
            .string({
                message: 'zodError.response.error.message.invalidType'
            })
            .min(1, { message: 'zodError.response.error.message.min' }),
        details: z
            .string({
                message: 'zodError.response.error.details.invalidType'
            })
            .optional(),
        field: z
            .string({
                message: 'zodError.response.error.field.invalidType'
            })
            .optional(),
        path: z
            .string({
                message: 'zodError.response.error.path.invalidType'
            })
            .optional(),
        statusCode: z
            .number({
                message: 'zodError.response.error.statusCode.invalidType'
            })
            .int({ message: 'zodError.response.error.statusCode.int' })
            .min(400, { message: 'zodError.response.error.statusCode.min' })
            .max(599, { message: 'zodError.response.error.statusCode.max' })
            .optional(),
        timestamp: z
            .date({
                message: 'zodError.response.error.timestamp.invalidType'
            })
            .optional()
            .default(() => new Date())
    }),
    requestId: z
        .string({
            message: 'zodError.response.requestId.invalidType'
        })
        .uuid({ message: 'zodError.response.requestId.uuid' })
        .optional(),
    validationErrors: z
        .array(
            z.object({
                field: z.string(),
                message: z.string(),
                code: z.string().optional(),
                value: z.unknown().optional()
            })
        )
        .optional(),
    stack: z
        .string({
            message: 'zodError.response.stack.invalidType'
        })
        .optional() // Only in development
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================================================
// PAGINATION METADATA SCHEMA
// ============================================================================

/**
 * Schema for pagination metadata
 * Used in paginated responses to provide navigation information
 */
export const PaginationMetadataSchema = z.object({
    page: z
        .number({
            message: 'zodError.pagination.page.invalidType'
        })
        .int({ message: 'zodError.pagination.page.int' })
        .min(1, { message: 'zodError.pagination.page.min' }),
    pageSize: z
        .number({
            message: 'zodError.pagination.pageSize.invalidType'
        })
        .int({ message: 'zodError.pagination.pageSize.int' })
        .min(1, { message: 'zodError.pagination.pageSize.min' })
        .max(100, { message: 'zodError.pagination.pageSize.max' }),
    total: z
        .number({
            message: 'zodError.pagination.total.invalidType'
        })
        .int({ message: 'zodError.pagination.total.int' })
        .min(0, { message: 'zodError.pagination.total.min' }),
    totalPages: z
        .number({
            message: 'zodError.pagination.totalPages.invalidType'
        })
        .int({ message: 'zodError.pagination.totalPages.int' })
        .min(0, { message: 'zodError.pagination.totalPages.min' }),
    hasNext: z
        .boolean({
            message: 'zodError.pagination.hasNext.invalidType'
        })
        .optional(),
    hasPrevious: z
        .boolean({
            message: 'zodError.pagination.hasPrevious.invalidType'
        })
        .optional(),
    nextPage: z
        .number({
            message: 'zodError.pagination.nextPage.invalidType'
        })
        .int({ message: 'zodError.pagination.nextPage.int' })
        .min(1, { message: 'zodError.pagination.nextPage.min' })
        .optional(),
    previousPage: z
        .number({
            message: 'zodError.pagination.previousPage.invalidType'
        })
        .int({ message: 'zodError.pagination.previousPage.int' })
        .min(1, { message: 'zodError.pagination.previousPage.min' })
        .optional(),
    offset: z
        .number({
            message: 'zodError.pagination.offset.invalidType'
        })
        .int({ message: 'zodError.pagination.offset.int' })
        .min(0, { message: 'zodError.pagination.offset.min' })
        .optional(),
    limit: z
        .number({
            message: 'zodError.pagination.limit.invalidType'
        })
        .int({ message: 'zodError.pagination.limit.int' })
        .min(1, { message: 'zodError.pagination.limit.min' })
        .max(100, { message: 'zodError.pagination.limit.max' })
        .optional()
});
export type PaginationMetadata = z.infer<typeof PaginationMetadataSchema>;

// ============================================================================
// PAGINATED RESPONSE SCHEMA
// ============================================================================

/**
 * Generic schema for paginated API responses
 * Can be used with any data type for consistent pagination structure
 */
export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    SuccessResponseSchema.extend({
        data: z.object({
            items: z.array(itemSchema),
            pagination: PaginationMetadataSchema,
            filters: z.record(z.string(), z.unknown()).optional(),
            sorting: z
                .object({
                    sortBy: z.string().optional(),
                    sortOrder: z.enum(['asc', 'desc']).optional()
                })
                .optional(),
            search: z
                .object({
                    query: z.string().optional(),
                    totalResults: z.number().int().min(0).optional(),
                    executionTime: z.number().min(0).optional()
                })
                .optional()
        })
    });

/**
 * Schema for paginated responses with unknown item type
 * Use createPaginatedResponseSchema for type-safe versions
 */
export const PaginatedResponseSchema = createPaginatedResponseSchema(z.unknown());
export type PaginatedResponse<T = unknown> = z.infer<
    ReturnType<typeof createPaginatedResponseSchema<z.ZodType<T>>>
>;

// ============================================================================
// LIST RESPONSE SCHEMA
// ============================================================================

/**
 * Generic schema for simple list API responses (without pagination)
 * Can be used with any data type for consistent list structure
 */
export const createListResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    SuccessResponseSchema.extend({
        data: z.object({
            items: z.array(itemSchema),
            total: z
                .number({
                    message: 'zodError.list.total.invalidType'
                })
                .int({ message: 'zodError.list.total.int' })
                .min(0, { message: 'zodError.list.total.min' }),
            filters: z.record(z.string(), z.unknown()).optional(),
            sorting: z
                .object({
                    sortBy: z.string().optional(),
                    sortOrder: z.enum(['asc', 'desc']).optional()
                })
                .optional(),
            grouping: z.record(z.string(), z.array(itemSchema)).optional()
        })
    });

/**
 * Schema for list responses with unknown item type
 * Use createListResponseSchema for type-safe versions
 */
export const ListResponseSchema = createListResponseSchema(z.unknown());
export type ListResponse<T = unknown> = z.infer<
    ReturnType<typeof createListResponseSchema<z.ZodType<T>>>
>;

// ============================================================================
// STATS RESPONSE SCHEMA
// ============================================================================

/**
 * Schema for statistics API responses
 * Used for endpoints that return analytics and metrics data
 */
export const StatsResponseSchema = SuccessResponseSchema.extend({
    data: z.object({
        stats: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
        period: z
            .object({
                startDate: z.date().optional(),
                endDate: z.date().optional(),
                granularity: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']).optional()
            })
            .optional(),
        comparisons: z
            .object({
                previousPeriod: z
                    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
                    .optional(),
                yearOverYear: z
                    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
                    .optional(),
                percentageChange: z.record(z.string(), z.number()).optional()
            })
            .optional(),
        breakdown: z
            .array(
                z.object({
                    category: z.string(),
                    value: z.union([z.string(), z.number()]),
                    percentage: z.number().min(0).max(100).optional(),
                    count: z.number().int().min(0).optional()
                })
            )
            .optional(),
        trends: z
            .array(
                z.object({
                    period: z.string(),
                    value: z.number(),
                    change: z.number().optional(),
                    changePercentage: z.number().optional()
                })
            )
            .optional(),
        metadata: z
            .object({
                generatedAt: z.date().default(() => new Date()),
                dataSource: z.string().optional(),
                cacheExpiry: z.date().optional(),
                refreshRate: z.string().optional()
            })
            .optional()
    })
});
export type StatsResponse = z.infer<typeof StatsResponseSchema>;

// ============================================================================
// SINGLE ITEM RESPONSE SCHEMA
// ============================================================================

/**
 * Generic schema for single item API responses
 * Can be used with any data type for consistent single item structure
 */
export const createSingleItemResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    SuccessResponseSchema.extend({
        data: itemSchema
    });

/**
 * Schema for single item responses with unknown item type
 * Use createSingleItemResponseSchema for type-safe versions
 */
export const SingleItemResponseSchema = createSingleItemResponseSchema(z.unknown());
export type SingleItemResponse<T = unknown> = z.infer<
    ReturnType<typeof createSingleItemResponseSchema<z.ZodType<T>>>
>;

// ============================================================================
// BULK OPERATION RESPONSE SCHEMA
// ============================================================================

/**
 * Schema for bulk operation API responses
 * Used for operations that process multiple items
 */
export const BulkOperationResponseSchema = SuccessResponseSchema.extend({
    data: z.object({
        summary: z.object({
            total: z.number().int().min(0),
            successful: z.number().int().min(0),
            failed: z.number().int().min(0),
            skipped: z.number().int().min(0).optional()
        }),
        results: z.array(
            z.object({
                id: z.string(),
                success: z.boolean(),
                error: z.string().optional(),
                data: z.unknown().optional()
            })
        ),
        errors: z
            .array(
                z.object({
                    id: z.string(),
                    error: z.string(),
                    code: z.string().optional()
                })
            )
            .optional(),
        warnings: z
            .array(
                z.object({
                    id: z.string(),
                    warning: z.string(),
                    code: z.string().optional()
                })
            )
            .optional()
    })
});
export type BulkOperationResponse = z.infer<typeof BulkOperationResponseSchema>;

// ============================================================================
// HEALTH CHECK RESPONSE SCHEMA
// ============================================================================

/**
 * Schema for health check API responses
 * Used for system health and status endpoints
 */
export const HealthCheckResponseSchema = SuccessResponseSchema.extend({
    data: z.object({
        status: z.enum(['healthy', 'degraded', 'unhealthy']),
        version: z.string().optional(),
        uptime: z.number().min(0).optional(),
        timestamp: z.date().default(() => new Date()),
        services: z
            .record(
                z.string(),
                z.object({
                    status: z.enum(['up', 'down', 'degraded']),
                    responseTime: z.number().min(0).optional(),
                    lastCheck: z.date().optional(),
                    error: z.string().optional()
                })
            )
            .optional(),
        metrics: z
            .object({
                memoryUsage: z.number().min(0).optional(),
                cpuUsage: z.number().min(0).max(100).optional(),
                diskUsage: z.number().min(0).max(100).optional(),
                activeConnections: z.number().int().min(0).optional()
            })
            .optional()
    })
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
