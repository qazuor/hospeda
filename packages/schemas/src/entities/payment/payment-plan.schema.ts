import { z } from 'zod';
import { WithAuditSchema } from '../../common/helpers.schema.js';
import { PaymentPlanIdSchema } from '../../common/id.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/currency.enum.schema.js';
import {
    BillingCycleEnumSchema,
    PaymentTypeEnumSchema
} from '../../enums/payment-type.enum.schema.js';

/**
 * Payment plan schema definition using Zod for validation.
 * Defines pricing, features, and billing for different payment options.
 */
export const PaymentPlanSchema = WithAuditSchema.extend({
    id: PaymentPlanIdSchema,
    /** Unique identifier for the plan */
    slug: z
        .string({
            message: 'zodError.paymentPlan.slug.required'
        })
        .min(1, { message: 'zodError.paymentPlan.slug.min' })
        .max(100, { message: 'zodError.paymentPlan.slug.max' })
        .regex(/^[a-z0-9-]+$/, { message: 'zodError.paymentPlan.slug.format' }),
    /** Display name for the plan */
    name: z
        .string({
            message: 'zodError.paymentPlan.name.required'
        })
        .min(1, { message: 'zodError.paymentPlan.name.min' })
        .max(100, { message: 'zodError.paymentPlan.name.max' }),
    /** Detailed description of the plan */
    description: z
        .string()
        .max(500, { message: 'zodError.paymentPlan.description.max' })
        .optional(),
    /** Type of payment: one-time or subscription */
    type: PaymentTypeEnumSchema,
    /** Billing cycle for subscriptions */
    billingCycle: BillingCycleEnumSchema.optional(),
    /** Price in the specified currency */
    price: z
        .number({
            message: 'zodError.paymentPlan.price.required'
        })
        .min(0, { message: 'zodError.paymentPlan.price.min' }),
    /** Currency for the price */
    currency: PriceCurrencyEnumSchema,
    /** Discount percentage for yearly plans */
    discountPercentage: z
        .number()
        .min(0, { message: 'zodError.paymentPlan.discountPercentage.min' })
        .max(100, { message: 'zodError.paymentPlan.discountPercentage.max' })
        .optional(),
    /** List of feature identifiers included in this plan */
    features: z
        .array(z.string().min(1, { message: 'zodError.paymentPlan.features.item.min' }))
        .min(1, { message: 'zodError.paymentPlan.features.minItems' }),
    /** Whether this plan is currently active and available for purchase */
    isActive: z.boolean({
        message: 'zodError.paymentPlan.isActive.required'
    }),
    /** Display order for sorting plans */
    sortOrder: z
        .number({
            message: 'zodError.paymentPlan.sortOrder.required'
        })
        .int({ message: 'zodError.paymentPlan.sortOrder.int' })
        .min(0, { message: 'zodError.paymentPlan.sortOrder.min' }),
    /** Mercado Pago specific configuration */
    mercadoPagoConfig: z
        .object({
            /** Mercado Pago plan ID for subscriptions */
            planId: z.string().optional(),
            /** Additional metadata for Mercado Pago */
            metadata: z.record(z.string()).optional()
        })
        .optional()
});

/**
 * Schema for creating a new payment plan.
 * Omits server-generated fields like id, audit fields, etc.
 */
export const CreatePaymentPlanSchema = PaymentPlanSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true
}).strict();

/**
 * Schema for updating an existing payment plan.
 * All fields optional except id (required for update).
 */
export const UpdatePaymentPlanSchema = PaymentPlanSchema.partial().extend({
    id: PaymentPlanIdSchema
});

export type PaymentPlanInput = z.infer<typeof CreatePaymentPlanSchema>;
export type UpdatePaymentPlanInput = z.infer<typeof UpdatePaymentPlanSchema>;
