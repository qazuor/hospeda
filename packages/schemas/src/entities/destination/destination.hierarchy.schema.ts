/**
 * Destination Hierarchy Schemas
 *
 * Schemas for hierarchy-specific operations: children, descendants, ancestors,
 * path lookup, and breadcrumb navigation.
 */
import { z } from 'zod';
import { DestinationTypeEnumSchema } from '../../enums/destination-type.schema.js';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

/**
 * Input schema for getting direct children of a destination
 */
export const GetDestinationChildrenInputSchema = z.object({
    destinationId: z.string().uuid()
});
export type GetDestinationChildrenInput = z.infer<typeof GetDestinationChildrenInputSchema>;

/**
 * Input schema for getting all descendants of a destination
 */
export const GetDestinationDescendantsInputSchema = z.object({
    destinationId: z.string().uuid(),
    maxDepth: z.number().int().min(1).max(10).optional(),
    destinationType: DestinationTypeEnumSchema.optional()
});
export type GetDestinationDescendantsInput = z.infer<typeof GetDestinationDescendantsInputSchema>;

/**
 * Input schema for getting all ancestors of a destination
 */
export const GetDestinationAncestorsInputSchema = z.object({
    destinationId: z.string().uuid()
});
export type GetDestinationAncestorsInput = z.infer<typeof GetDestinationAncestorsInputSchema>;

/**
 * Input schema for looking up a destination by its materialized path
 */
export const GetDestinationByPathInputSchema = z.object({
    path: z
        .string()
        .min(1)
        .max(500)
        .regex(/^\/[a-z0-9-/]+$/, {
            message:
                'Path must start with / and contain only lowercase letters, numbers, hyphens, and slashes'
        })
});
export type GetDestinationByPathInput = z.infer<typeof GetDestinationByPathInputSchema>;

/**
 * Input schema for getting breadcrumb navigation data
 */
export const GetDestinationBreadcrumbInputSchema = z.object({
    destinationId: z.string().uuid()
});
export type GetDestinationBreadcrumbInput = z.infer<typeof GetDestinationBreadcrumbInputSchema>;

// ============================================================================
// OUTPUT / ITEM SCHEMAS
// ============================================================================

/**
 * Schema for a single breadcrumb navigation item
 */
export const BreadcrumbItemSchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    level: z.number().int().min(0).max(6),
    destinationType: DestinationTypeEnumSchema,
    path: z.string()
});
export type BreadcrumbItem = z.infer<typeof BreadcrumbItemSchema>;

/**
 * Schema for the full breadcrumb response (array of items from root to current)
 */
export const BreadcrumbResponseSchema = z.array(BreadcrumbItemSchema);
export type BreadcrumbResponse = z.infer<typeof BreadcrumbResponseSchema>;
