import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ClientIdSchema, CreditNoteIdSchema, InvoiceIdSchema } from '../../common/id.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/index.js';

/**
 * Credit Note Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a CreditNote entity
 * representing a credit note issued against an invoice.
 */
export const CreditNoteSchema = z.object({
    // Base fields
    id: CreditNoteIdSchema,
    ...BaseAuditFields,

    // Credit Note-specific core fields
    invoiceId: InvoiceIdSchema,
    clientId: ClientIdSchema,

    // Credit note identification
    creditNoteNumber: z
        .string({
            message: 'zodError.creditNote.creditNoteNumber.required'
        })
        .min(1, { message: 'zodError.creditNote.creditNoteNumber.min' })
        .max(100, { message: 'zodError.creditNote.creditNoteNumber.max' }),

    // Amount and currency
    amount: z
        .number({
            message: 'zodError.creditNote.amount.required'
        })
        .positive({ message: 'zodError.creditNote.amount.positive' }),

    currency: PriceCurrencyEnumSchema,

    // Reason and description
    reason: z
        .string({
            message: 'zodError.creditNote.reason.required'
        })
        .min(1, { message: 'zodError.creditNote.reason.min' })
        .max(500, { message: 'zodError.creditNote.reason.max' }),

    description: z
        .string()
        .min(1, { message: 'zodError.creditNote.description.min' })
        .max(1000, { message: 'zodError.creditNote.description.max' })
        .optional(),

    // Important dates
    issueDate: z.date({
        message: 'zodError.creditNote.issueDate.invalid'
    }),

    // Status
    isApplied: z.boolean({
        message: 'zodError.creditNote.isApplied.required'
    }),

    appliedAt: z
        .date({
            message: 'zodError.creditNote.appliedAt.invalid'
        })
        .optional(),

    // Metadata
    metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Type export for the main CreditNote entity
 */
export type CreditNote = z.infer<typeof CreditNoteSchema>;
