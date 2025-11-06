import { z } from 'zod';
import { PricingPlanSchema } from '../pricingPlan/pricingPlan.schema.js';
import { PricingTierSchema } from '../pricingTier/pricingTier.schema.js';
import { ProductSchema } from './product.schema.js';

// PricingPlan with nested PricingTiers
export const PricingPlanWithTiersSchema = PricingPlanSchema.extend({
    pricingTiers: z.array(PricingTierSchema).default([])
});

// Product with PricingPlans (basic relation)
export const ProductWithPricingPlansSchema = ProductSchema.extend({
    pricingPlans: z.array(PricingPlanSchema).default([])
});

// Product with complete nested relations (PricingPlans + PricingTiers)
export const ProductRelationsSchema = ProductSchema.extend({
    pricingPlans: z.array(PricingPlanWithTiersSchema).default([])
});

// Summary schema for product with pricing counts
export const ProductRelationsSummarySchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: z.enum(['campaign', 'sponsorship', 'promotion', 'event', 'content']),
    isActive: z.boolean(),
    pricingPlansCount: z.number().int().min(0),
    pricingTiersCount: z.number().int().min(0),
    defaultPlan: z
        .object({
            id: z.string().uuid(),
            name: z.string(),
            isDefault: z.boolean()
        })
        .nullable()
});

// Paginated list of product relations summaries
export const ProductRelationsListSchema = z.object({
    items: z.array(ProductRelationsSummarySchema),
    total: z.number().int().min(0),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean()
});

// Re-export types from their source packages (to maintain backward compatibility)
export type { PricingPlan } from '../pricingPlan/pricingPlan.schema.js';
export type { PricingTier } from '../pricingTier/pricingTier.schema.js';

// Type exports for product-specific relation schemas
export type PricingPlanWithTiers = z.infer<typeof PricingPlanWithTiersSchema>;
export type ProductWithPricingPlans = z.infer<typeof ProductWithPricingPlansSchema>;
export type ProductRelations = z.infer<typeof ProductRelationsSchema>;
export type ProductRelationsSummary = z.infer<typeof ProductRelationsSummarySchema>;
export type ProductRelationsList = z.infer<typeof ProductRelationsListSchema>;
