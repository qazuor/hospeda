import { z } from 'zod';
import { IdSchema } from '../../common/id.schema.js';

// Simplified relation schemas to avoid circular dependencies
export const CreditNoteInvoiceRelationSchema = z.object({
    id: IdSchema,
    invoiceNumber: z.string(),
    totalAmount: z.number(),
    status: z.string()
});

export const CreditNoteClientRelationSchema = z.object({
    id: IdSchema,
    name: z.string(),
    email: z.string().email()
});

// Full credit note with relations
export const CreditNoteWithRelationsSchema = z.object({
    id: IdSchema,
    invoiceId: IdSchema,
    clientId: IdSchema,
    creditNoteNumber: z.string(),
    amount: z.number(),
    currency: z.string(),
    reason: z.string(),
    description: z.string().optional(),
    issueDate: z.date(),
    isApplied: z.boolean(),
    appliedAt: z.date().optional().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    deletedAt: z.date().optional().nullable(),
    createdById: IdSchema,
    updatedById: IdSchema,
    deletedById: IdSchema.optional().nullable(),

    // Relations
    invoice: CreditNoteInvoiceRelationSchema.optional(),
    client: CreditNoteClientRelationSchema.optional()
});

export type CreditNoteInvoiceRelation = z.infer<typeof CreditNoteInvoiceRelationSchema>;
export type CreditNoteClientRelation = z.infer<typeof CreditNoteClientRelationSchema>;
export type CreditNoteWithRelations = z.infer<typeof CreditNoteWithRelationsSchema>;
