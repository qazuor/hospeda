import { z } from 'zod';
import { SubscriptionStatusEnum } from './subscription-status.enum.js';

/**
 * Subscription status enum schema for validation
 */
export const SubscriptionStatusEnumSchema = z.nativeEnum(SubscriptionStatusEnum, {
    message: 'zodError.subscription.status.invalid'
});
