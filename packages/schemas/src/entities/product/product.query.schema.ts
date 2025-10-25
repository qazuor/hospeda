import { z } from 'zod';
import { ProductIdSchema } from '../../common/id.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { ProductTypeEnumSchema } from '../../enums/product-type.schema.js';
import { ProductSchema } from './product.schema.js';

/**
 * Product Query Schemas - Standardized Implementation
 *
 * This file contains all schemas related to querying products following the unified standard:
 * - Pagination: page/pageSize pattern
 * - Sorting: sortBy/sortOrder with 'asc'/'desc' values
 * - Search: 'q' field for text search
 * - Filters: entity-specific filters (direct fields like accommodation pattern)
 */

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Standard product search schema
 * Follows the same pattern as accommodation - direct fields without nesting
 */
export const ProductSearchSchema = BaseSearchSchema.extend({
    // Entity-specific filters - direct fields like accommodation
    name: z.string().min(1).optional(),
    type: ProductTypeEnumSchema.optional(),

    // Boolean filters
    isActive: z.boolean().optional(),

    // Date filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Metadata queries
    metadataKey: z.string().optional(),
    metadataValue: z.string().optional()
});

// Type: Search Input
export type ProductSearch = z.infer<typeof ProductSearchSchema>;
export type ProductSearchInput = z.infer<typeof ProductSearchSchema>;

/**
 * Schema for product search output
 * Returns paginated results with metadata
 */
export const ProductSearchOutputSchema = PaginationResultSchema(ProductSchema);

// Type: Search Output
export type ProductSearchOutput = z.infer<typeof ProductSearchOutputSchema>;

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for product list output
 * Simple list without pagination metadata
 */
export const ProductListOutputSchema = z.object({
    items: z.array(ProductSchema),
    total: z.number().int().min(0)
});

// Type: List Output
export type ProductListOutput = z.infer<typeof ProductListOutputSchema>;

// ============================================================================
// SUMMARY SCHEMAS
// ============================================================================

/**
 * Schema for product summary (lightweight representation)
 * Contains only essential fields for listings and dropdowns
 */
export const ProductSummarySchema = z.object({
    id: ProductIdSchema,
    name: z.string(),
    type: ProductTypeEnumSchema
});

// Type: Summary
export type ProductSummary = z.infer<typeof ProductSummarySchema>;

// ============================================================================
// STATS SCHEMAS
// ============================================================================

/**
 * Schema for product statistics
 */
export const ProductStatsSchema = z.object({
    totalProducts: z.number().int().min(0),
    productsByType: z.record(ProductTypeEnumSchema, z.number().int().min(0)),
    activeProducts: z.number().int().min(0),
    archivedProducts: z.number().int().min(0)
});

// Type: Stats
export type ProductStats = z.infer<typeof ProductStatsSchema>;
