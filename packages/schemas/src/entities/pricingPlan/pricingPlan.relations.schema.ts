import { z } from 'zod';
import { BillingSchemeEnum } from '../../enums/billing-scheme.enum.js';
import { AccommodationSchema } from '../accommodation/accommodation.schema.js';
import {
    ProductCreateInputSchema,
    ProductUpdateInputSchema
} from '../product/product.crud.schema.js';
import { ProductSchema } from '../product/product.schema.js';
import {
    PricingPlanCreateInputSchema,
    PricingPlanUpdateInputSchema
} from './pricingPlan.crud.schema.js';
import { PricingPlanSchema } from './pricingPlan.schema.js';

// ============================================================================
// PRICING PLAN WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Pricing plan with product information
 * Includes the related product data for complete context
 */
export const PricingPlanWithProductSchema = PricingPlanSchema.extend({
    product: ProductSchema
});

export type PricingPlanWithProduct = z.infer<typeof PricingPlanWithProductSchema>;

/**
 * Pricing plan with product and accommodation relations
 * Full nested data structure for comprehensive views
 */
export const PricingPlanWithRelationsSchema = PricingPlanSchema.extend({
    product: ProductSchema.extend({
        accommodation: AccommodationSchema.optional()
    })
});

export type PricingPlanWithRelations = z.infer<typeof PricingPlanWithRelationsSchema>;

/**
 * Minimal pricing plan schema for lightweight operations
 * Contains only essential fields for basic operations
 */
export const PricingPlanMinimalSchema = PricingPlanSchema.pick({
    id: true,
    billingScheme: true,
    interval: true,
    amountMinor: true,
    currency: true,
    lifecycleState: true
}).refine(
    (data) => {
        // Same conditional validation as full schema
        if (data.billingScheme === BillingSchemeEnum.RECURRING) {
            return data.interval !== undefined;
        }
        if (data.billingScheme === BillingSchemeEnum.ONE_TIME) {
            return data.interval === undefined;
        }
        return true;
    },
    {
        message: 'RECURRING billing scheme requires interval, ONE_TIME must not have interval',
        path: ['interval']
    }
);

export type PricingPlanMinimal = z.infer<typeof PricingPlanMinimalSchema>;

/**
 * Pricing plan summary for list views
 * Compact representation with key information
 */
export const PricingPlanSummarySchema = PricingPlanMinimalSchema.extend({
    productId: z.string().uuid(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.date(),
    updatedAt: z.date()
});

export type PricingPlanSummary = z.infer<typeof PricingPlanSummarySchema>;

// ============================================================================
// NESTED OPERATION SCHEMAS
// ============================================================================

/**
 * Schema for creating pricing plan with nested product creation
 * Allows creating both pricing plan and product in single operation
 */
export const PricingPlanNestedCreateSchema = PricingPlanCreateInputSchema.omit({ productId: true })
    .extend({
        product: ProductCreateInputSchema
    })
    .refine(
        (data) => {
            // Apply the same conditional validation as PricingPlanCreateInputSchema
            if (data.billingScheme === BillingSchemeEnum.RECURRING) {
                return data.interval !== undefined;
            }
            if (data.billingScheme === BillingSchemeEnum.ONE_TIME) {
                return data.interval === undefined;
            }
            return true;
        },
        {
            message: 'Interval is required for RECURRING billing scheme and forbidden for ONE_TIME',
            path: ['interval']
        }
    );

export type PricingPlanNestedCreate = z.infer<typeof PricingPlanNestedCreateSchema>;

/**
 * Schema for updating pricing plan with optional product updates
 * Supports partial updates to both pricing plan and related product
 */
export const PricingPlanNestedUpdateSchema = PricingPlanUpdateInputSchema.extend({
    product: ProductUpdateInputSchema.optional()
});

export type PricingPlanNestedUpdate = z.infer<typeof PricingPlanNestedUpdateSchema>;

// ============================================================================
// RELATION QUERY SCHEMAS
// ============================================================================

/**
 * Schema for querying pricing plans with product inclusion options
 */
export const PricingPlanIncludeOptionsSchema = z.object({
    product: z.boolean().default(false),
    accommodation: z.boolean().default(false)
});

export type PricingPlanIncludeOptions = z.infer<typeof PricingPlanIncludeOptionsSchema>;

/**
 * Pricing plan with conditional relations based on include options
 */
export const PricingPlanConditionalRelationsSchema = z.union([
    PricingPlanSchema,
    PricingPlanWithProductSchema,
    PricingPlanWithRelationsSchema
]);

export type PricingPlanConditionalRelations = z.infer<typeof PricingPlanConditionalRelationsSchema>;
