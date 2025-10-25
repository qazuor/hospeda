import { z } from 'zod';
import { ProductSchema } from './product.schema.js';

// TODO [08efb1f9-8a95-4c87-bfe9-a2724b1bb4c5]: These schemas will be imported from their respective packages when implemented
// For now, creating minimal schemas to define the structure

// Temporary PricingTier schema until package is implemented
export const PricingTierSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    pricingPlanId: z.string().uuid(),
    currency: z.string().length(3), // ISO 4217
    price: z.number().positive(),
    billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME']),
    isDefault: z.boolean(),
    lifecycleState: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']),
    createdAt: z.date(),
    updatedAt: z.date(),
    createdById: z.string(),
    updatedById: z.string(),
    isActive: z.boolean(),
    isDeleted: z.boolean()
});

// Temporary PricingPlan schema until package is implemented
export const PricingPlanSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    productId: z.string().uuid(),
    description: z.string().optional(),
    isDefault: z.boolean(),
    lifecycleState: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']),
    createdAt: z.date(),
    updatedAt: z.date(),
    createdById: z.string(),
    updatedById: z.string(),
    isActive: z.boolean(),
    isDeleted: z.boolean()
});

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

// Type exports
export type PricingTier = z.infer<typeof PricingTierSchema>;
export type PricingPlan = z.infer<typeof PricingPlanSchema>;
export type PricingPlanWithTiers = z.infer<typeof PricingPlanWithTiersSchema>;
export type ProductWithPricingPlans = z.infer<typeof ProductWithPricingPlansSchema>;
export type ProductRelations = z.infer<typeof ProductRelationsSchema>;
export type ProductRelationsSummary = z.infer<typeof ProductRelationsSummarySchema>;
export type ProductRelationsList = z.infer<typeof ProductRelationsListSchema>;
