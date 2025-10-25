import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ClientIdSchema, InvoiceIdSchema } from '../../common/id.schema.js';
import { InvoiceStatusEnumSchema, PriceCurrencyEnumSchema } from '../../enums/index.js';

/**
 * Invoice Schema - Main Entity Schema
 *
 * This schema defines the complete structure of an Invoice entity
 * representing a billing invoice in the system.
 */
export const InvoiceSchema = z.object({
    // Base fields
    id: InvoiceIdSchema,
    ...BaseAuditFields,

    // Invoice-specific core fields
    clientId: ClientIdSchema,

    // Invoice identification
    invoiceNumber: z
        .string({
            message: 'zodError.invoice.invoiceNumber.required'
        })
        .min(1, { message: 'zodError.invoice.invoiceNumber.min' })
        .max(100, { message: 'zodError.invoice.invoiceNumber.max' }),

    // Invoice status
    status: InvoiceStatusEnumSchema,

    // Amount fields
    subtotal: z
        .number({
            message: 'zodError.invoice.subtotal.required'
        })
        .nonnegative({ message: 'zodError.invoice.subtotal.nonnegative' }),

    taxes: z
        .number({
            message: 'zodError.invoice.taxes.required'
        })
        .nonnegative({ message: 'zodError.invoice.taxes.nonnegative' }),

    total: z
        .number({
            message: 'zodError.invoice.total.required'
        })
        .nonnegative({ message: 'zodError.invoice.total.nonnegative' }),

    // Currency
    currency: PriceCurrencyEnumSchema,

    // Important dates
    issueDate: z.date({
        message: 'zodError.invoice.issueDate.invalid'
    }),

    dueDate: z.date({
        message: 'zodError.invoice.dueDate.invalid'
    }),

    // Optional fields
    description: z
        .string()
        .min(1, { message: 'zodError.invoice.description.min' })
        .max(1000, { message: 'zodError.invoice.description.max' })
        .optional(),

    paymentTerms: z
        .string()
        .min(1, { message: 'zodError.invoice.paymentTerms.min' })
        .max(500, { message: 'zodError.invoice.paymentTerms.max' })
        .optional(),

    notes: z
        .string()
        .min(1, { message: 'zodError.invoice.notes.min' })
        .max(2000, { message: 'zodError.invoice.notes.max' })
        .optional(),

    // Payment tracking
    paidAt: z
        .date({
            message: 'zodError.invoice.paidAt.invalid'
        })
        .optional(),

    // Metadata
    metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Type export for the main Invoice entity
 */
export type Invoice = z.infer<typeof InvoiceSchema>;
