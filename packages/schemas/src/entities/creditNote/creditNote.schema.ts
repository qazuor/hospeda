import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { CreditNoteIdSchema, InvoiceIdSchema } from '../../common/id.schema.js';
import { numericField } from '../../utils/index.js';

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

    // Amount and currency
    amount: numericField(
        z
            .number({
                message: 'zodError.creditNote.amount.required'
            })
            .positive({ message: 'zodError.creditNote.amount.positive' })
    ),

    currency: z.string().default('USD'),

    // Reason
    reason: z.string().optional().nullable(),

    // Issue date
    issuedAt: z.date().nullable().optional(),

    // Admin metadata
    ...BaseAdminFields
});

/**
 * Type export for the main CreditNote entity
 */
export type CreditNote = z.infer<typeof CreditNoteSchema>;
