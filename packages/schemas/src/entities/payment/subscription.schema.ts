import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { PaymentPlanIdSchema, SubscriptionIdSchema, UserIdSchema } from '../../common/id.schema.js';
import {
    BillingCycleEnumSchema,
    PriceCurrencyEnumSchema,
    SubscriptionStatusEnumSchema
} from '../../enums/index.js';
import { numericField } from '../../utils/index.js';

/**
 * Payment Subscription Schema - Payment Integration Schema
 *
 * This schema defines the structure of a Subscription entity
 * specific to payment processing and Mercado Pago integration.
 * @deprecated Use the main SubscriptionSchema from entities/subscription instead
 */
export const PaymentSubscriptionSchema = z.object({
    // Base fields
    id: SubscriptionIdSchema,
    ...BaseAuditFields,

    // Subscription-specific core fields
    userId: UserIdSchema,
    paymentPlanId: PaymentPlanIdSchema,
    status: SubscriptionStatusEnumSchema,
    billingCycle: BillingCycleEnumSchema,

    // Amount and currency
    amount: numericField(
        z
            .number({
                message: 'zodError.subscription.amount.required'
            })
            .positive({ message: 'zodError.subscription.amount.positive' })
    ),

    currency: PriceCurrencyEnumSchema,

    // Mercado Pago integration
    mercadoPagoSubscriptionId: z
        .string({
            message: 'zodError.subscription.mercadoPagoSubscriptionId.required'
        })
        .min(1, { message: 'zodError.subscription.mercadoPagoSubscriptionId.min' })
        .optional(),

    externalReference: z
        .string({
            message: 'zodError.subscription.externalReference.required'
        })
        .min(1, { message: 'zodError.subscription.externalReference.min' })
        .max(100, { message: 'zodError.subscription.externalReference.max' })
        .optional(),

    // Important dates
    startDate: z.date({
        message: 'zodError.subscription.startDate.invalid'
    }),

    endDate: z
        .date({
            message: 'zodError.subscription.endDate.invalid'
        })
        .optional(),

    nextBillingDate: z
        .date({
            message: 'zodError.subscription.nextBillingDate.invalid'
        })
        .optional(),

    cancelledAt: z
        .date({
            message: 'zodError.subscription.cancelledAt.invalid'
        })
        .optional(),

    // Cancellation info
    cancellationReason: z
        .string({
            message: 'zodError.subscription.cancellationReason.required'
        })
        .min(1, { message: 'zodError.subscription.cancellationReason.min' })
        .max(1000, { message: 'zodError.subscription.cancellationReason.max' })
        .optional(),

    // Billing cycles
    billingCyclesCompleted: z
        .number({
            message: 'zodError.subscription.billingCyclesCompleted.required'
        })
        .int({ message: 'zodError.subscription.billingCyclesCompleted.int' })
        .min(0, { message: 'zodError.subscription.billingCyclesCompleted.min' })
        .default(0),

    maxBillingCycles: z
        .number({
            message: 'zodError.subscription.maxBillingCycles.required'
        })
        .int({ message: 'zodError.subscription.maxBillingCycles.int' })
        .min(1, { message: 'zodError.subscription.maxBillingCycles.min' })
        .optional(),

    // Trial period
    trialEndDate: z
        .date({
            message: 'zodError.subscription.trialEndDate.invalid'
        })
        .optional(),

    // Metadata and additional info
    metadata: z.record(z.string(), z.unknown()).optional(),

    // Raw Mercado Pago response
    mercadoPagoResponse: z.record(z.string(), z.unknown()).optional()
});

/**
 * Type export for the payment-specific Subscription entity
 * @deprecated Use the main Subscription type from entities/subscription instead
 */
export type PaymentSubscription = z.infer<typeof PaymentSubscriptionSchema>;
