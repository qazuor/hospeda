import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { InvoiceIdSchema, InvoiceLineIdSchema } from '../../common/id.schema.js';
import { numericField } from '../../utils/index.js';

/**
 * Invoice Line Schema - Main Entity Schema
 *
 * This schema defines the complete structure of an InvoiceLine entity
 * representing a line item within an invoice.
 */
export const InvoiceLineSchema = z.object({
    // Base fields
    id: InvoiceLineIdSchema,
    ...BaseAuditFields,

    // Invoice Line-specific core fields
    invoiceId: InvoiceIdSchema,

    // Line item description
    description: z
        .string({
            message: 'zodError.invoiceLine.description.required'
        })
        .min(1, { message: 'zodError.invoiceLine.description.min' })
        .max(1000, { message: 'zodError.invoiceLine.description.max' }),

    // Quantity and pricing
    quantity: numericField(
        z
            .number({
                message: 'zodError.invoiceLine.quantity.required'
            })
            .positive({ message: 'zodError.invoiceLine.quantity.positive' })
    ),

    unitPrice: numericField(
        z
            .number({
                message: 'zodError.invoiceLine.unitPrice.required'
            })
            .nonnegative({ message: 'zodError.invoiceLine.unitPrice.nonnegative' })
    ),

    total: numericField(
        z
            .number({
                message: 'zodError.invoiceLine.total.required'
            })
            .nonnegative({ message: 'zodError.invoiceLine.total.nonnegative' })
    ),

    // Optional fields
    productReference: z
        .string()
        .min(1, { message: 'zodError.invoiceLine.productReference.min' })
        .max(100, { message: 'zodError.invoiceLine.productReference.max' })
        .optional(),

    // Tax information
    taxAmount: numericField(
        z.number().nonnegative({ message: 'zodError.invoiceLine.taxAmount.nonnegative' })
    ).optional(),

    taxRate: numericField(
        z
            .number()
            .nonnegative({ message: 'zodError.invoiceLine.taxRate.nonnegative' })
            .max(100, { message: 'zodError.invoiceLine.taxRate.max' })
    ).optional(),

    // Discount information
    discountRate: numericField(
        z
            .number()
            .nonnegative({ message: 'zodError.invoiceLine.discountRate.nonnegative' })
            .max(100, { message: 'zodError.invoiceLine.discountRate.max' })
    ).optional(),

    discountAmount: numericField(
        z.number().nonnegative({ message: 'zodError.invoiceLine.discountAmount.nonnegative' })
    ).optional(),

    // Additional notes
    notes: z
        .string()
        .min(1, { message: 'zodError.invoiceLine.notes.min' })
        .max(500, { message: 'zodError.invoiceLine.notes.max' })
        .optional(),

    // Metadata
    metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Type export for the main InvoiceLine entity
 */
export type InvoiceLine = z.infer<typeof InvoiceLineSchema>;
