import { z } from 'zod';
import { ProductIdSchema } from '../../common/id.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { BillingIntervalEnumSchema } from '../../enums/billing-interval.schema.js';
import { BillingSchemeEnumSchema } from '../../enums/billing-scheme.schema.js';
import { PricingPlanIdSchema } from './pricingPlan.schema.js';

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for searching pricing plans with filters
 * Follows flat structure pattern for HTTP compatibility
 */
export const PricingPlanSearchSchema = BaseSearchSchema.extend({
    // Product relationship filter
    productId: ProductIdSchema.optional(),

    // Billing configuration filters
    billingScheme: BillingSchemeEnumSchema.optional(),
    interval: BillingIntervalEnumSchema.optional(),
    currency: z
        .string()
        .length(3)
        .regex(/^[A-Z]{3}$/)
        .optional(),

    // Amount range filters
    amountMinorMin: z.number().int().min(0).optional(),
    amountMinorMax: z.number().int().min(0).optional(),

    // Status filters
    isActive: z.boolean().optional(),
    isDeleted: z.boolean().optional(),
    lifecycleState: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),

    // Date range filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),
    updatedAfter: z.date().optional(),
    updatedBefore: z.date().optional()
});

export type PricingPlanSearch = z.infer<typeof PricingPlanSearchSchema>;

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

/**
 * Schema for individual pricing plan item in results
 */
export const PricingPlanItemSchema = z.object({
    id: PricingPlanIdSchema,
    productId: ProductIdSchema,
    billingScheme: BillingSchemeEnumSchema,
    interval: BillingIntervalEnumSchema.optional(),
    amountMinor: z.number().int(),
    currency: z.string(),
    isActive: z.boolean(),
    isDeleted: z.boolean(),
    lifecycleState: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
    createdAt: z.date(),
    updatedAt: z.date()
});

export type PricingPlanItem = z.infer<typeof PricingPlanItemSchema>;

/**
 * Schema for paginated pricing plan search results
 */
export const PricingPlanSearchOutputSchema = PaginationResultSchema(PricingPlanItemSchema);

export type PricingPlanSearchOutput = z.infer<typeof PricingPlanSearchOutputSchema>;

/**
 * Schema for pricing plan list output
 * Simple list without pagination metadata
 */
export const PricingPlanListOutputSchema = z.object({
    items: z.array(PricingPlanItemSchema),
    totalCount: z.number().int().min(0),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalPages: z.number().int().min(0)
});

export type PricingPlanListOutput = z.infer<typeof PricingPlanListOutputSchema>;

// ============================================================================
// SUMMARY SCHEMAS
// ============================================================================

/**
 * Schema for pricing plan summary (minimal data for dropdowns, references)
 */
export const PricingPlanSummarySchema = z.object({
    id: PricingPlanIdSchema,
    productId: ProductIdSchema,
    billingScheme: BillingSchemeEnumSchema,
    interval: BillingIntervalEnumSchema.optional(),
    amountMinor: z.number().int(),
    currency: z.string(),
    isActive: z.boolean()
});

export type PricingPlanSummary = z.infer<typeof PricingPlanSummarySchema>;
