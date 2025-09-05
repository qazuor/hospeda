import { z } from 'zod';
import { WithAuditSchema } from '../../common/helpers.schema.js';
import { PaymentIdSchema, PaymentPlanIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/currency.enum.schema.js';
import { PaymentMethodEnumSchema } from '../../enums/payment-method.enum.schema.js';
import { PaymentStatusEnumSchema } from '../../enums/payment-status.enum.schema.js';
import { PaymentTypeEnumSchema } from '../../enums/payment-type.enum.schema.js';

/**
 * Payment schema definition using Zod for validation.
 * Represents a payment transaction.
 */
export const PaymentSchema = WithAuditSchema.extend({
    id: PaymentIdSchema,
    /** User who made the payment */
    userId: UserIdSchema,
    /** Payment plan associated with this payment */
    paymentPlanId: PaymentPlanIdSchema,
    /** Type of payment */
    type: PaymentTypeEnumSchema,
    /** Current status of the payment */
    status: PaymentStatusEnumSchema,
    /** Payment method used */
    paymentMethod: PaymentMethodEnumSchema.optional(),
    /** Amount paid */
    amount: z
        .number({
            message: 'zodError.payment.amount.required'
        })
        .min(0, { message: 'zodError.payment.amount.min' }),
    /** Currency of the payment */
    currency: PriceCurrencyEnumSchema,
    /** Mercado Pago payment ID */
    mercadoPagoPaymentId: z
        .string()
        .min(1, { message: 'zodError.payment.mercadoPagoPaymentId.min' })
        .optional(),
    /** Mercado Pago preference ID */
    mercadoPagoPreferenceId: z
        .string()
        .min(1, { message: 'zodError.payment.mercadoPagoPreferenceId.min' })
        .optional(),
    /** External reference for tracking */
    externalReference: z
        .string()
        .min(1, { message: 'zodError.payment.externalReference.min' })
        .max(256, { message: 'zodError.payment.externalReference.max' })
        .optional(),
    /** Payment description */
    description: z.string().max(500, { message: 'zodError.payment.description.max' }).optional(),
    /** Additional metadata */
    metadata: z.record(z.unknown()).optional(),
    /** Date when payment was processed */
    processedAt: z.date().optional(),
    /** Date when payment expires (for pending payments) */
    expiresAt: z.date().optional(),
    /** Failure reason if payment was rejected */
    failureReason: z
        .string()
        .max(500, { message: 'zodError.payment.failureReason.max' })
        .optional(),
    /** Raw response from Mercado Pago */
    mercadoPagoResponse: z.record(z.unknown()).optional()
});

/**
 * Schema for creating a new payment.
 * Omits server-generated fields like id, audit fields, etc.
 */
export const CreatePaymentSchema = PaymentSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true
}).strict();

/**
 * Schema for updating an existing payment.
 * All fields optional except id (required for update).
 */
export const UpdatePaymentSchema = PaymentSchema.partial().extend({
    id: PaymentIdSchema
});

/**
 * Schema for payment webhook notifications from Mercado Pago
 */
export const PaymentWebhookSchema = z.object({
    /** Webhook action */
    action: z.string(),
    /** API version */
    api_version: z.string(),
    /** Payment data */
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

export type PaymentInput = z.infer<typeof CreatePaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof UpdatePaymentSchema>;
export type PaymentWebhookInput = z.infer<typeof PaymentWebhookSchema>;
