import { z } from 'zod';
import { InvoiceLineSchema } from './invoiceLine.schema.js';

/**
 * Create Invoice Line Schema
 *
 * Schema for creating new invoice lines. Excludes auto-generated fields.
 */
export const CreateInvoiceLineSchema = InvoiceLineSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Update Invoice Line Schema
 *
 * Schema for updating existing invoice lines. All fields are optional
 * to support partial updates, except invoice ID which cannot be changed.
 */
export const UpdateInvoiceLineSchema = InvoiceLineSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    invoiceId: true // Cannot update invoice association
}).partial();

/**
 * Delete Invoice Line Schema
 *
 * Schema for soft-deleting invoice lines with optional reason and metadata.
 */
export const DeleteInvoiceLineSchema = z.object({
    reason: z
        .string()
        .min(1, { message: 'zodError.invoiceLine.deleteReason.min' })
        .max(500, { message: 'zodError.invoiceLine.deleteReason.max' })
        .optional(),

    metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Type exports for Invoice Line CRUD operations
 */
export type CreateInvoiceLine = z.infer<typeof CreateInvoiceLineSchema>;
export type UpdateInvoiceLine = z.infer<typeof UpdateInvoiceLineSchema>;
export type DeleteInvoiceLine = z.infer<typeof DeleteInvoiceLineSchema>;
