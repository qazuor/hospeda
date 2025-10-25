import { z } from 'zod';
import { ClientSchema } from '../client/client.schema.js';
import { PricingPlanSchema } from '../pricingPlan/pricingPlan.schema.js';
import { PurchaseSchema } from './purchase.schema.js';

/**
 * Purchase with Client relation
 *
 * Includes the client that made the purchase.
 */
export const PurchaseWithClientSchema = PurchaseSchema.extend({
    client: ClientSchema
});

export type PurchaseWithClient = z.infer<typeof PurchaseWithClientSchema>;

/**
 * Purchase with PricingPlan relation
 *
 * Includes the pricing plan details for the purchase.
 */
export const PurchaseWithPricingPlanSchema = PurchaseSchema.extend({
    pricingPlan: PricingPlanSchema
});

export type PurchaseWithPricingPlan = z.infer<typeof PurchaseWithPricingPlanSchema>;

/**
 * Purchase with full relations
 *
 * Includes both client and pricing plan information.
 */
export const PurchaseWithRelationsSchema = PurchaseSchema.extend({
    client: ClientSchema,
    pricingPlan: PricingPlanSchema
});

export type PurchaseWithRelations = z.infer<typeof PurchaseWithRelationsSchema>;

/**
 * Purchase items collection relation
 *
 * This will be extended once SubscriptionItem schemas are created.
 * For now, we define the basic structure.
 */
export const PurchaseWithItemsSchema = PurchaseSchema.extend({
    // TODO [23751a8c-f5c7-4c62-adab-7c4b7eacecdb]: Add subscription items once SubscriptionItem schema is implemented
    // subscriptionItems: z.array(SubscriptionItemSchema)
    itemsCount: z.number().int().min(0).default(0)
});

export type PurchaseWithItems = z.infer<typeof PurchaseWithItemsSchema>;

/**
 * Complete purchase with all relations
 *
 * Includes client, pricing plan, and subscription items.
 */
export const PurchaseCompleteSchema = PurchaseSchema.extend({
    client: ClientSchema,
    pricingPlan: PricingPlanSchema,
    // TODO [744c868c-5387-405e-8996-acb47e90fa25]: Add subscription items once SubscriptionItem schema is implemented
    // subscriptionItems: z.array(SubscriptionItemSchema)
    itemsCount: z.number().int().min(0).default(0)
});

export type PurchaseComplete = z.infer<typeof PurchaseCompleteSchema>;
