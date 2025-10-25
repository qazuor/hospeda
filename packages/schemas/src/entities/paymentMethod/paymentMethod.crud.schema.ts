import { z } from 'zod';
import { PaymentMethodSchema } from './paymentMethod.schema.js';

/**
 * Create Payment Method Schema
 *
 * Schema for creating new payment methods. Excludes auto-generated fields.
 */
export const CreatePaymentMethodSchema = PaymentMethodSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).extend({
    // Default isActive to true if not provided
    isActive: PaymentMethodSchema.shape.isActive.default(true),
    // Default isDefault to false if not provided
    isDefault: PaymentMethodSchema.shape.isDefault.default(false)
});

/**
 * Update Payment Method Schema
 *
 * Schema for updating existing payment methods. All fields are optional
 * to support partial updates, except client ID which cannot be changed.
 */
export const UpdatePaymentMethodSchema = PaymentMethodSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    clientId: true // Cannot update client association
}).partial();

/**
 * Delete Payment Method Schema
 *
 * Schema for soft-deleting payment methods with optional reason and metadata.
 */
export const DeletePaymentMethodSchema = z.object({
    reason: z
        .string()
        .min(1, { message: 'zodError.paymentMethod.deleteReason.min' })
        .max(500, { message: 'zodError.paymentMethod.deleteReason.max' })
        .optional(),

    metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Type exports for Payment Method CRUD operations
 */
export type CreatePaymentMethod = z.infer<typeof CreatePaymentMethodSchema>;
export type UpdatePaymentMethod = z.infer<typeof UpdatePaymentMethodSchema>;
export type DeletePaymentMethod = z.infer<typeof DeletePaymentMethodSchema>;
