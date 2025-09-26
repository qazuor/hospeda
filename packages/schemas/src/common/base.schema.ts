/**
 * Base schema components that all entities inherit from
 * Provides consistent structure for IDs, timestamps, and common fields
 */
import { z } from 'zod';

/**
 * Standard UUID schema with validation and OpenAPI metadata
 * Used across all entities for consistent ID handling
 */
export const UuidSchema = z
    .string()
    .uuid({ message: 'zodError.common.id.invalidUuid' })
    .describe('Unique identifier in UUID v4 format');

export type Uuid = z.infer<typeof UuidSchema>;

/**
 * Base audit fields present in all entities
 * Provides consistent tracking of creation and modification times
 */
export const BaseAuditSchema = z.object({
    createdAt: z.date().describe('Timestamp when the entity was created'),
    updatedAt: z.date().describe('Timestamp when the entity was last updated'),
    deletedAt: z
        .date()
        .nullable()
        .optional()
        .describe('Timestamp when the entity was soft deleted (null if active)')
});

export type BaseAudit = z.infer<typeof BaseAuditSchema>;

/**
 * Standardized pagination parameters
 * Ensures consistent pagination behavior across all list endpoints
 */
export const PaginationParamsSchema = z.object({
    page: z.number().int().positive().default(1).describe('Page number for pagination (1-based)'),
    pageSize: z
        .number()
        .int()
        .positive()
        .max(100)
        .default(20)
        .describe('Number of items per page (max 100)')
});

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

/**
 * Standardized sorting parameters
 * Provides consistent sorting interface across all entities
 */
export const SortingParamsSchema = z.object({
    sortBy: z.string().optional().describe('Field name to sort by'),
    sortOrder: z
        .enum(['asc', 'desc'])
        .default('asc')
        .optional()
        .describe('Sort direction (ascending or descending)')
});

export type SortingParams = z.infer<typeof SortingParamsSchema>;

/**
 * Base search schema combining pagination, sorting, and text search
 * All entity search schemas should extend this for consistency
 */
export const BaseSearchSchema = z.object({
    ...PaginationParamsSchema.shape,
    ...SortingParamsSchema.shape,
    q: z.string().optional().describe('General search query string')
});

export type BaseSearch = z.infer<typeof BaseSearchSchema>;
