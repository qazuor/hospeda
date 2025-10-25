import { z } from 'zod';
import { InvoiceStatusEnum } from '../../enums/index.js';
import { InvoiceSchema } from './invoice.schema.js';

/**
 * Create Invoice Schema
 *
 * Schema for creating new invoices. Excludes auto-generated fields
 * and provides sensible defaults for certain fields.
 */
export const CreateInvoiceSchema = InvoiceSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    paidAt: true // Cannot be set during creation
}).extend({
    // Default status to OPEN if not provided
    status: InvoiceSchema.shape.status.default(InvoiceStatusEnum.OPEN)
});

/**
 * Update Invoice Schema
 *
 * Schema for updating existing invoices. All fields are optional
 * to support partial updates.
 */
export const UpdateInvoiceSchema = InvoiceSchema.omit({
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
 * Delete Invoice Schema
 *
 * Schema for soft-deleting invoices with optional reason and metadata.
 */
export const DeleteInvoiceSchema = z.object({
    reason: z
        .string()
        .min(1, { message: 'zodError.invoice.deleteReason.min' })
        .max(500, { message: 'zodError.invoice.deleteReason.max' })
        .optional(),

    metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Type exports for Invoice CRUD operations
 */
export type CreateInvoice = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoice = z.infer<typeof UpdateInvoiceSchema>;
export type DeleteInvoice = z.infer<typeof DeleteInvoiceSchema>;
