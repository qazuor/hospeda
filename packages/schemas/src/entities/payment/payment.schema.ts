import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    InvoiceIdSchema,
    PaymentIdSchema,
    PaymentPlanIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import {
    PaymentMethodEnumSchema,
    PaymentStatusEnumSchema,
    PaymentTypeEnumSchema,
    PriceCurrencyEnumSchema
} from '../../enums/index.js';
import { numericField } from '../../utils/index.js';

/**
 * Payment Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a Payment entity
 * representing a payment transaction in the system.
 */
export const PaymentSchema = z.object({
    // Base fields
    id: PaymentIdSchema,
    ...BaseAuditFields,

    // Payment-specific core fields
    userId: UserIdSchema,
    paymentPlanId: PaymentPlanIdSchema.optional(),
    invoiceId: InvoiceIdSchema.optional(),
    type: PaymentTypeEnumSchema,
    status: PaymentStatusEnumSchema,
    paymentMethod: PaymentMethodEnumSchema.optional(),

    // Amount and currency
    amount: numericField(
        z
            .number({ message: 'zodError.payment.amount.required' })
            .positive({ message: 'zodError.payment.amount.positive' })
    ),

    currency: PriceCurrencyEnumSchema,

    // Mercado Pago integration
    mercadoPagoPaymentId: z
        .string({
            message: 'zodError.payment.mercadoPagoPaymentId.required'
        })
        .min(1, { message: 'zodError.payment.mercadoPagoPaymentId.min' })
        .optional(),

    mercadoPagoPreferenceId: z
        .string({
            message: 'zodError.payment.mercadoPagoPreferenceId.required'
        })
        .min(1, { message: 'zodError.payment.mercadoPagoPreferenceId.min' })
        .optional(),

    // External reference and description
    externalReference: z
        .string({
            message: 'zodError.payment.externalReference.required'
        })
        .min(1, { message: 'zodError.payment.externalReference.min' })
        .max(100, { message: 'zodError.payment.externalReference.max' })
        .optional(),

    description: z
        .string({
            message: 'zodError.payment.description.required'
        })
        .min(1, { message: 'zodError.payment.description.min' })
        .max(500, { message: 'zodError.payment.description.max' })
        .optional(),

    // Metadata and additional info
    metadata: z.record(z.string(), z.unknown()).optional(),

    // Important dates
    processedAt: z
        .date({
            message: 'zodError.payment.processedAt.invalid'
        })
        .optional(),

    expiresAt: z
        .date({
            message: 'zodError.payment.expiresAt.invalid'
        })
        .optional(),

    // Failure handling
    failureReason: z
        .string({
            message: 'zodError.payment.failureReason.required'
        })
        .min(1, { message: 'zodError.payment.failureReason.min' })
        .max(1000, { message: 'zodError.payment.failureReason.max' })
        .optional(),

    // Raw Mercado Pago response
    mercadoPagoResponse: z.record(z.string(), z.unknown()).optional(),

    // Lifecycle fields
    ...BaseLifecycleFields,

    // Status fields
    isActive: z.boolean().default(true),
    isDeleted: z.boolean().default(false),

    // Admin fields
    ...BaseAdminFields
});

/**
 * Type export for the main Payment entity
 */
export type Payment = z.infer<typeof PaymentSchema>;
