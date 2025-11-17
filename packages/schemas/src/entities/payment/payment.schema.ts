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
    paymentPlanId: PaymentPlanIdSchema.nullable(),
    invoiceId: InvoiceIdSchema.nullable(),
    type: PaymentTypeEnumSchema,
    status: PaymentStatusEnumSchema,
    paymentMethod: PaymentMethodEnumSchema.nullable(),

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
        .nullable(),

    mercadoPagoPreferenceId: z
        .string({
            message: 'zodError.payment.mercadoPagoPreferenceId.required'
        })
        .min(1, { message: 'zodError.payment.mercadoPagoPreferenceId.min' })
        .nullable(),

    // External reference and description
    externalReference: z
        .string({
            message: 'zodError.payment.externalReference.required'
        })
        .min(1, { message: 'zodError.payment.externalReference.min' })
        .max(100, { message: 'zodError.payment.externalReference.max' })
        .nullable(),

    description: z
        .string({
            message: 'zodError.payment.description.required'
        })
        .min(1, { message: 'zodError.payment.description.min' })
        .max(500, { message: 'zodError.payment.description.max' })
        .nullable(),

    // Metadata and additional info
    metadata: z.record(z.string(), z.unknown()).nullable(),

    // Important dates
    processedAt: z
        .date({
            message: 'zodError.payment.processedAt.invalid'
        })
        .nullable(),

    expiresAt: z
        .date({
            message: 'zodError.payment.expiresAt.invalid'
        })
        .nullable(),

    // Failure handling
    failureReason: z
        .string({
            message: 'zodError.payment.failureReason.required'
        })
        .min(1, { message: 'zodError.payment.failureReason.min' })
        .max(1000, { message: 'zodError.payment.failureReason.max' })
        .nullable(),

    // Raw Mercado Pago response
    mercadoPagoResponse: z.record(z.string(), z.unknown()).nullable(),

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
