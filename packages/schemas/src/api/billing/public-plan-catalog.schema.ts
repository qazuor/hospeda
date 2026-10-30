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
    /**
     * The SELLABLE version's own `trial_days`. NOT the trial offer: the trial
     * is one per vertical and its length lives on the vertical's `role='trial'`
     * plan (HOS-1967). Kept only for wire compatibility; read
     * {@link PublicPlanCatalogResponseSchema} `trialOffer` instead.
     *
     * @deprecated Never use it to promise a trial.
     */
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

/**
 * The free trial a vertical offers, decided by the API (HOS-1967): present only
 * when the vertical has a real trial path AND its `role='trial'` plan's current
 * version has `trial_days > 0`. `trialDays` is that version's value, the same
 * number the trial engine uses when the trial starts.
 */
export const PublicPlanCatalogTrialOfferSchema = z.object({
    trialDays: z.number().int().positive()
});
export type PublicPlanCatalogTrialOffer = z.infer<typeof PublicPlanCatalogTrialOfferSchema>;

/** Public sellable plans and the optional current floor plan for a vertical. */
export const PublicPlanCatalogResponseSchema = z.object({
    vertical: PublicPlanCatalogVerticalSchema,
    plans: z.array(PublicPlanCatalogPlanSchema),
    floor: PublicPlanCatalogFloorSchema.nullable(),
    /**
     * The vertical's trial offer, or `null` when none is offered. Optional on
     * the wire only so a web deployed ahead of the API parses an older
     * response; an absent value means "no offer", never "unknown, assume yes".
     */
    trialOffer: PublicPlanCatalogTrialOfferSchema.nullable().optional()
});
export type PublicPlanCatalogResponse = z.infer<typeof PublicPlanCatalogResponseSchema>;
