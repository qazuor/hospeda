import { z } from 'zod';
import { PurchaseSchema } from '../purchase/purchase.schema.js';
import { SubscriptionSchema } from '../subscription/subscription.schema.js';
import { SubscriptionItemSchema } from './subscriptionItem.schema.js';

/**
 * SubscriptionItem with Source relation
 *
 * This is a union type that includes either subscription or purchase
 * based on the sourceType field.
 */
export const SubscriptionItemWithSourceSchema = SubscriptionItemSchema.extend({
    // Union type for polymorphic source
    source: z.union([
        SubscriptionSchema.extend({ _type: z.literal('subscription') }),
        PurchaseSchema.extend({ _type: z.literal('purchase') })
    ])
});

export type SubscriptionItemWithSource = z.infer<typeof SubscriptionItemWithSourceSchema>;

/**
 * SubscriptionItem with Subscription source
 *
 * When sourceType is 'subscription'.
 */
export const SubscriptionItemWithSubscriptionSchema = SubscriptionItemSchema.extend({
    subscription: SubscriptionSchema
});

export type SubscriptionItemWithSubscription = z.infer<
    typeof SubscriptionItemWithSubscriptionSchema
>;

/**
 * SubscriptionItem with Purchase source
 *
 * When sourceType is 'purchase'.
 */
export const SubscriptionItemWithPurchaseSchema = SubscriptionItemSchema.extend({
    purchase: PurchaseSchema
});

export type SubscriptionItemWithPurchase = z.infer<typeof SubscriptionItemWithPurchaseSchema>;

/**
 * SubscriptionItem with target entity
 *
 * This will be polymorphic based on entityType.
 * For now, we define a basic structure that can be extended.
 */
export const SubscriptionItemWithTargetEntitySchema = SubscriptionItemSchema.extend({
    // TODO: This will be extended once all target entity schemas are implemented
    // The actual target entity will be resolved based on entityType + linkedEntityId
    targetEntity: z.record(z.string(), z.unknown()).optional()
});

export type SubscriptionItemWithTargetEntity = z.infer<
    typeof SubscriptionItemWithTargetEntitySchema
>;

/**
 * Complete SubscriptionItem with all relations
 *
 * Includes both source and target entity information.
 */
export const SubscriptionItemCompleteSchema = SubscriptionItemSchema.extend({
    // Polymorphic source
    source: z.union([
        SubscriptionSchema.extend({ _type: z.literal('subscription') }),
        PurchaseSchema.extend({ _type: z.literal('purchase') })
    ]),

    // TODO: Polymorphic target entity once all schemas are implemented
    targetEntity: z.record(z.string(), z.unknown()).optional()
});

export type SubscriptionItemComplete = z.infer<typeof SubscriptionItemCompleteSchema>;

/**
 * SubscriptionItem collection for a source
 *
 * Used when loading all items for a subscription or purchase.
 */
export const SubscriptionItemCollectionSchema = z.object({
    sourceId: z.string().uuid(),
    sourceType: z.enum(['subscription', 'purchase']),
    items: z.array(SubscriptionItemSchema),
    totalCount: z.number().int().min(0)
});

export type SubscriptionItemCollection = z.infer<typeof SubscriptionItemCollectionSchema>;
