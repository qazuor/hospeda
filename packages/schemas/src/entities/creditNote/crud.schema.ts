import { z } from 'zod';
import { IdSchema } from '../../common/id.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/index.js';

export const CreateCreditNoteSchema = z.object({
    invoiceId: IdSchema,
    clientId: IdSchema,
    creditNoteNumber: z.string().min(1).max(100),
    amount: z.number().positive(),
    currency: PriceCurrencyEnumSchema,
    reason: z.string().min(1).max(500),
    description: z.string().max(1000).optional(),
    issueDate: z.date()
});

export const UpdateCreditNoteSchema = CreateCreditNoteSchema.partial();

export const DeleteCreditNoteSchema = z.object({
    id: IdSchema
});

export const RestoreCreditNoteSchema = z.object({
    id: IdSchema
});

export const CreditNoteKeySchema = z.object({
    id: IdSchema
});

export type CreateCreditNoteInput = z.infer<typeof CreateCreditNoteSchema>;
export type UpdateCreditNoteInput = z.infer<typeof UpdateCreditNoteSchema>;
export type DeleteCreditNoteInput = z.infer<typeof DeleteCreditNoteSchema>;
export type RestoreCreditNoteInput = z.infer<typeof RestoreCreditNoteSchema>;
export type CreditNoteKey = z.infer<typeof CreditNoteKeySchema>;
