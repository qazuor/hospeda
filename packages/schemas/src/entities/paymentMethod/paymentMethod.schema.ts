import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ClientIdSchema, PaymentMethodIdSchema } from '../../common/id.schema.js';
import { PaymentMethodEnumSchema } from '../../enums/index.js';

/**
 * Payment Method Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a PaymentMethod entity
 * representing a stored payment method for a client.
 */
export const PaymentMethodSchema = z.object({
    // Base fields
    id: PaymentMethodIdSchema,
    ...BaseAuditFields,

    // Payment Method-specific core fields
    clientId: ClientIdSchema,

    // Payment method type
    type: PaymentMethodEnumSchema,

    // Display information
    displayName: z
        .string({
            message: 'zodError.paymentMethod.displayName.required'
        })
        .min(1, { message: 'zodError.paymentMethod.displayName.min' })
        .max(100, { message: 'zodError.paymentMethod.displayName.max' }),

    // Status flags
    isDefault: z.boolean({
        message: 'zodError.paymentMethod.isDefault.required'
    }),

    isActive: z.boolean({
        message: 'zodError.paymentMethod.isActive.required'
    }),

    // Credit Card specific fields (optional)
    cardLast4: z
        .string()
        .regex(/^\d{4}$/, { message: 'zodError.paymentMethod.cardLast4.format' })
        .optional(),

    cardBrand: z
        .string()
        .min(1, { message: 'zodError.paymentMethod.cardBrand.min' })
        .max(20, { message: 'zodError.paymentMethod.cardBrand.max' })
        .optional(),

    cardExpiryMonth: z
        .number()
        .int()
        .min(1, { message: 'zodError.paymentMethod.cardExpiryMonth.min' })
        .max(12, { message: 'zodError.paymentMethod.cardExpiryMonth.max' })
        .optional(),

    cardExpiryYear: z
        .number()
        .int()
        .min(new Date().getFullYear(), { message: 'zodError.paymentMethod.cardExpiryYear.min' })
        .max(new Date().getFullYear() + 20, {
            message: 'zodError.paymentMethod.cardExpiryYear.max'
        })
        .optional(),

    // Bank Account specific fields (optional)
    bankName: z
        .string()
        .min(1, { message: 'zodError.paymentMethod.bankName.min' })
        .max(100, { message: 'zodError.paymentMethod.bankName.max' })
        .optional(),

    accountLast4: z
        .string()
        .regex(/^\d{4}$/, { message: 'zodError.paymentMethod.accountLast4.format' })
        .optional(),

    accountType: z
        .enum(['CHECKING', 'SAVINGS'], {
            message: 'zodError.paymentMethod.accountType.invalid'
        })
        .optional(),

    // Provider integration fields
    providerPaymentMethodId: z
        .string()
        .min(1, { message: 'zodError.paymentMethod.providerPaymentMethodId.min' })
        .max(100, { message: 'zodError.paymentMethod.providerPaymentMethodId.max' })
        .optional(),

    providerCustomerId: z
        .string()
        .min(1, { message: 'zodError.paymentMethod.providerCustomerId.min' })
        .max(100, { message: 'zodError.paymentMethod.providerCustomerId.max' })
        .optional(),

    // Metadata
    metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Type export for the main PaymentMethod entity
 */
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
