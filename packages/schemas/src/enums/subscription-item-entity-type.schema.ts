import { z } from 'zod';
import { SubscriptionItemEntityTypeEnum } from './subscription-item-entity-type.enum.js';

/**
 * Subscription item entity type enum schema for validation
 */
export const SubscriptionItemEntityTypeEnumSchema = z.nativeEnum(SubscriptionItemEntityTypeEnum, {
    message: 'zodError.enums.subscriptionItemEntityType.invalid'
});
export type SubscriptionItemEntityTypeSchema = z.infer<typeof SubscriptionItemEntityTypeEnumSchema>;
