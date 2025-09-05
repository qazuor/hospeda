import { z } from 'zod';
import { WithAuditSchema } from '../../common/helpers.schema.js';
import { PaymentPlanIdSchema, SubscriptionIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/currency.enum.schema.js';
import {
    BillingCycleEnumSchema,
    SubscriptionStatusEnumSchema
} from '../../enums/payment-type.enum.schema.js';

/**
 * Subscription schema definition using Zod for validation.
 * Represents a subscription to a payment plan.
 */
export const SubscriptionSchema = WithAuditSchema.extend({
    id: SubscriptionIdSchema,
    /** User who owns the subscription */
    userId: UserIdSchema,
    /** Payment plan for this subscription */
    paymentPlanId: PaymentPlanIdSchema,
    /** Current status of the subscription */
    status: SubscriptionStatusEnumSchema,
    /** Billing cycle */
    billingCycle: BillingCycleEnumSchema,
    /** Subscription amount per billing cycle */
    amount: z
        .number({
            message: 'zodError.subscription.amount.required'
        })
        .min(0, { message: 'zodError.subscription.amount.min' }),
    /** Currency of the subscription */
    currency: PriceCurrencyEnumSchema,
    /** Mercado Pago subscription ID */
    mercadoPagoSubscriptionId: z
        .string()
        .min(1, { message: 'zodError.subscription.mercadoPagoSubscriptionId.min' })
        .optional(),
    /** External reference for tracking */
    externalReference: z
        .string()
        .min(1, { message: 'zodError.subscription.externalReference.min' })
        .max(256, { message: 'zodError.subscription.externalReference.max' })
        .optional(),
    /** Date when subscription starts */
    startDate: z.date({
        message: 'zodError.subscription.startDate.required'
    }),
    /** Date when subscription ends (if cancelled or expired) */
    endDate: z.date().optional(),
    /** Next billing date */
    nextBillingDate: z.date().optional(),
    /** Date when subscription was cancelled */
    cancelledAt: z.date().optional(),
    /** Reason for cancellation */
    cancellationReason: z
        .string()
        .max(500, { message: 'zodError.subscription.cancellationReason.max' })
        .optional(),
    /** Number of billing cycles completed */
    billingCyclesCompleted: z
        .number({
            message: 'zodError.subscription.billingCyclesCompleted.required'
        })
        .int({ message: 'zodError.subscription.billingCyclesCompleted.int' })
        .min(0, { message: 'zodError.subscription.billingCyclesCompleted.min' }),
    /** Maximum number of billing cycles (null for unlimited) */
    maxBillingCycles: z
        .number()
        .int({ message: 'zodError.subscription.maxBillingCycles.int' })
        .min(1, { message: 'zodError.subscription.maxBillingCycles.min' })
        .optional(),
    /** Trial period end date */
    trialEndDate: z.date().optional(),
    /** Additional metadata */
    metadata: z.record(z.unknown()).optional(),
    /** Raw response from Mercado Pago */
    mercadoPagoResponse: z.record(z.unknown()).optional()
});

/**
 * Schema for creating a new subscription.
 * Omits server-generated fields like id, audit fields, etc.
 */
export const CreateSubscriptionSchema = SubscriptionSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true
}).strict();

/**
 * Schema for updating an existing subscription.
 * All fields optional except id (required for update).
 */
export const UpdateSubscriptionSchema = SubscriptionSchema.partial().extend({
    id: SubscriptionIdSchema
});

/**
 * Schema for subscription webhook notifications from Mercado Pago
 */
export const SubscriptionWebhookSchema = z.object({
    /** Webhook action */
    action: z.string(),
    /** API version */
    api_version: z.string(),
    /** Subscription data */
    data: z.object({
        id: z.string()
    }),
    /** Date created */
    date_created: z.string(),
    /** Webhook ID */
    id: z.number(),
    /** Live mode flag */
    live_mode: z.boolean(),
    /** Type of notification */
    type: z.string(),
    /** User ID */
    user_id: z.string()
});

export type SubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof UpdateSubscriptionSchema>;
export type SubscriptionWebhookInput = z.infer<typeof SubscriptionWebhookSchema>;
