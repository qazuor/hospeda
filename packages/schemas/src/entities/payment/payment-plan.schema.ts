import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { PaymentPlanIdSchema } from '../../common/id.schema.js';
import {
    BillingCycleEnumSchema,
    PaymentTypeEnumSchema,
    PriceCurrencyEnumSchema
} from '../../enums/index.js';

/**
 * Payment Plan Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a Payment Plan entity
 * representing a payment plan configuration in the system.
 */
export const PaymentPlanSchema = z.object({
    // Base fields
    id: PaymentPlanIdSchema,
    ...BaseAuditFields,

    // Payment Plan-specific core fields
    slug: z
        .string({
            message: 'zodError.paymentPlan.slug.required'
        })
        .min(3, { message: 'zodError.paymentPlan.slug.min' })
        .max(100, { message: 'zodError.paymentPlan.slug.max' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'zodError.paymentPlan.slug.pattern'
        }),

    name: z
        .string({
            message: 'zodError.paymentPlan.name.required'
        })
        .min(2, { message: 'zodError.paymentPlan.name.min' })
        .max(100, { message: 'zodError.paymentPlan.name.max' }),

    description: z
        .string({
            message: 'zodError.paymentPlan.description.required'
        })
        .min(10, { message: 'zodError.paymentPlan.description.min' })
        .max(1000, { message: 'zodError.paymentPlan.description.max' })
        .optional(),

    // Payment configuration
    type: PaymentTypeEnumSchema,
    billingCycle: BillingCycleEnumSchema.optional(),

    // Pricing
    price: z
        .number({
            message: 'zodError.paymentPlan.price.required'
        })
        .min(0, { message: 'zodError.paymentPlan.price.min' }),

    currency: PriceCurrencyEnumSchema,

    discountPercentage: z
        .number({
            message: 'zodError.paymentPlan.discountPercentage.required'
        })
        .min(0, { message: 'zodError.paymentPlan.discountPercentage.min' })
        .max(100, { message: 'zodError.paymentPlan.discountPercentage.max' })
        .optional(),

    // Features and configuration
    features: z
        .array(
            z.string({
                message: 'zodError.paymentPlan.features.item.required'
            })
        )
        .min(1, { message: 'zodError.paymentPlan.features.min' }),

    isActive: z
        .boolean({
            message: 'zodError.paymentPlan.isActive.required'
        })
        .default(true),

    sortOrder: z
        .number({
            message: 'zodError.paymentPlan.sortOrder.required'
        })
        .int({ message: 'zodError.paymentPlan.sortOrder.int' })
        .min(0, { message: 'zodError.paymentPlan.sortOrder.min' })
        .default(0),

    // Mercado Pago configuration
    mercadoPagoConfig: z
        .object({
            planId: z
                .string({
                    message: 'zodError.paymentPlan.mercadoPagoConfig.planId.required'
                })
                .min(1, { message: 'zodError.paymentPlan.mercadoPagoConfig.planId.min' })
                .optional(),

            metadata: z.record(z.string(), z.string()).optional()
        })
        .optional()
});

/**
 * Type export for the main Payment Plan entity
 */
export type PaymentPlan = z.infer<typeof PaymentPlanSchema>;
