import { z } from 'zod';
import { SubscriptionItemSourceTypeEnum } from './subscription-item-source-type.enum.js';

/**
 * Subscription item source type enum schema for validation
 */
export const SubscriptionItemSourceTypeEnumSchema = z.nativeEnum(SubscriptionItemSourceTypeEnum, {
    message: 'zodError.enums.subscriptionItemSourceType.invalid'
});
export type SubscriptionItemSourceTypeSchema = z.infer<typeof SubscriptionItemSourceTypeEnumSchema>;
