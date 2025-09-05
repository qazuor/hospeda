import { BillingCycleEnum, PaymentTypeEnum, SubscriptionStatusEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Payment type enum schema for validation
 */
export const PaymentTypeEnumSchema = z.nativeEnum(PaymentTypeEnum, {
    message: 'zodError.payment.type.invalid'
});

/**
 * Billing cycle enum schema for validation
 */
export const BillingCycleEnumSchema = z.nativeEnum(BillingCycleEnum, {
    message: 'zodError.payment.billingCycle.invalid'
});

/**
 * Subscription status enum schema for validation
 */
export const SubscriptionStatusEnumSchema = z.nativeEnum(SubscriptionStatusEnum, {
    message: 'zodError.subscription.status.invalid'
});
