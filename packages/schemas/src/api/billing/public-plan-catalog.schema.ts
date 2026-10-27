import { z } from 'zod';
import { BillingCycleSchema } from '../../catalog/plan-publication.schema.js';

/** Verticals whose plans can be offered through public pricing. */
export const PublicPlanCatalogVerticalSchema = z.enum([
    'accommodation',
    'venue',
    'experience',
    'tourist'
]);
export type PublicPlanCatalogVertical = z.infer<typeof PublicPlanCatalogVerticalSchema>;

/** Query parameters for the public sellable plan catalog. */
export const PublicPlanCatalogQuerySchema = z.object({
    vertical: PublicPlanCatalogVerticalSchema
});
export type PublicPlanCatalogQuery = z.infer<typeof PublicPlanCatalogQuerySchema>;

/** A public billing choice, with amount expressed in minor currency units. */
export const PublicPlanCatalogBillingOptionSchema = z.object({
    id: z.string().uuid(),
    cycle: BillingCycleSchema,
    amount: z.number().int().nonnegative(),
    currency: z.literal('ARS')
});
export type PublicPlanCatalogBillingOption = z.infer<typeof PublicPlanCatalogBillingOptionSchema>;

/** One sellable current plan and its public presentation data. */
export const PublicPlanCatalogPlanSchema = z.object({
    planId: z.string().uuid(),
    planVersionId: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    pricingOrder: z.number().int(),
    rank: z.number().int(),
    trialDays: z.number().int().nonnegative(),
    inheritsTouristVip: z.boolean(),
    entitlements: z.array(z.string()),
    limits: z.record(z.string(), z.number().int().nonnegative()),
    billingOptions: z.array(PublicPlanCatalogBillingOptionSchema)
});
export type PublicPlanCatalogPlan = z.infer<typeof PublicPlanCatalogPlanSchema>;

/** Current floor plan presentation, which is never sold through this catalog. */
export const PublicPlanCatalogFloorSchema = PublicPlanCatalogPlanSchema.omit({
    billingOptions: true,
    inheritsTouristVip: true
}).strict();
export type PublicPlanCatalogFloor = z.infer<typeof PublicPlanCatalogFloorSchema>;

/** Public sellable plans and the optional current floor plan for a vertical. */
export const PublicPlanCatalogResponseSchema = z.object({
    vertical: PublicPlanCatalogVerticalSchema,
    plans: z.array(PublicPlanCatalogPlanSchema),
    floor: PublicPlanCatalogFloorSchema.nullable()
});
export type PublicPlanCatalogResponse = z.infer<typeof PublicPlanCatalogResponseSchema>;
