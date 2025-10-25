import { z } from 'zod';
import { ClientIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { ClientSchema } from './client.schema.js';

/**
 * Client Query Schemas
 *
 * This file contains all schemas related to querying clients:
 * - Search: paginated search with filters
 * - List: simple list without pagination metadata
 * - Filters: client-specific filters
 * - Summary: lightweight client representation
 */

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Standard client search schema
 * Follows the same pattern as accommodation - direct fields without nesting
 */
export const ClientSearchSchema = BaseSearchSchema.extend({
    // Entity-specific filters - direct fields like accommodation
    name: z.string().min(1).optional(),
    billingEmail: z.string().email().optional(),
    userId: UserIdSchema.optional(),

    // Date filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional()
});

// Type: Search Input
export type ClientSearch = z.infer<typeof ClientSearchSchema>;
export type ClientSearchInput = z.infer<typeof ClientSearchSchema>;

/**
 * Schema for client search output
 * Returns paginated results with metadata
 */
export const ClientSearchOutputSchema = PaginationResultSchema(ClientSchema);

// Type: Search Output
export type ClientSearchOutput = z.infer<typeof ClientSearchOutputSchema>;

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for client list output
 * Simple list without pagination metadata
 */
export const ClientListOutputSchema = z.object({
    items: z.array(ClientSchema),
    total: z.number().int().min(0)
});

// Type: List Output
export type ClientListOutput = z.infer<typeof ClientListOutputSchema>;

// ============================================================================
// SUMMARY SCHEMAS
// ============================================================================

/**
 * Schema for client summary (lightweight representation)
 * Contains only essential fields for listings and dropdowns
 */
export const ClientSummarySchema = z.object({
    id: ClientIdSchema,
    name: z.string(),
    billingEmail: z.string(),
    userId: UserIdSchema.nullable()
});

// Type: Summary
export type ClientSummary = z.infer<typeof ClientSummarySchema>;
