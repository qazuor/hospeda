import { z } from 'zod';
import { ClientSchema } from '../client/client.schema.js';
import { PricingPlanSchema } from '../pricingPlan/pricingPlan.schema.js';
import { SubscriptionSchema } from './subscription.schema.js';

/**
 * Subscription with Client relation
 *
 * Includes the client that owns the subscription.
 */
export const SubscriptionWithClientSchema = SubscriptionSchema.extend({
    client: ClientSchema
});

export type SubscriptionWithClient = z.infer<typeof SubscriptionWithClientSchema>;

/**
 * Subscription with PricingPlan relation
 *
 * Includes the pricing plan details for the subscription.
 */
export const SubscriptionWithPricingPlanSchema = SubscriptionSchema.extend({
    pricingPlan: PricingPlanSchema
});

export type SubscriptionWithPricingPlan = z.infer<typeof SubscriptionWithPricingPlanSchema>;

/**
 * Subscription with full relations
 *
 * Includes both client and pricing plan information.
 */
export const SubscriptionWithRelationsSchema = SubscriptionSchema.extend({
    client: ClientSchema,
    pricingPlan: PricingPlanSchema
});

export type SubscriptionWithRelations = z.infer<typeof SubscriptionWithRelationsSchema>;

/**
 * Subscription items collection relation
 *
 * This will be extended once SubscriptionItem schemas are created.
 * For now, we define the basic structure.
 */
export const SubscriptionWithItemsSchema = SubscriptionSchema.extend({
    // TODO [04c4270d-d0a9-496a-9142-7237e8159fca]: Add subscription items once SubscriptionItem schema is implemented
    // subscriptionItems: z.array(SubscriptionItemSchema)
    itemsCount: z.number().int().min(0).default(0)
});

export type SubscriptionWithItems = z.infer<typeof SubscriptionWithItemsSchema>;

/**
 * Complete subscription with all relations
 *
 * Includes client, pricing plan, and subscription items.
 */
export const SubscriptionCompleteSchema = SubscriptionSchema.extend({
    client: ClientSchema,
    pricingPlan: PricingPlanSchema,
    // TODO [ca06120a-c832-4106-aca9-a25eb7caa3a2]: Add subscription items once SubscriptionItem schema is implemented
    // subscriptionItems: z.array(SubscriptionItemSchema)
    itemsCount: z.number().int().min(0).default(0)
});

export type SubscriptionComplete = z.infer<typeof SubscriptionCompleteSchema>;
