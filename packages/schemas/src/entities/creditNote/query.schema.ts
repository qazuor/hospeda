import { z } from 'zod';
import { IdSchema } from '../../common/id.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/index.js';

export const CreditNoteQuerySchema = z
    .object({
        q: z.string().min(1).optional(),
        invoiceId: IdSchema.optional(),
        clientId: IdSchema.optional(),
        creditNoteNumber: z.string().optional(),
        currency: PriceCurrencyEnumSchema.optional(),
        reason: z.string().optional(),
        isApplied: z.boolean().optional(),
        issueDate: z.date().optional(),
        appliedAt: z.date().optional(),
        amountMin: z.number().positive().optional(),
        amountMax: z.number().positive().optional(),
        issueDateFrom: z.date().optional(),
        issueDateTo: z.date().optional(),
        appliedAtFrom: z.date().optional(),
        appliedAtTo: z.date().optional(),
        createdAt: z.date().optional(),
        updatedAt: z.date().optional(),
        deletedAt: z.date().optional().nullable(),
        createdById: IdSchema.optional(),
        updatedById: IdSchema.optional(),
        deletedById: IdSchema.optional().nullable(),
        createdAtFrom: z.date().optional(),
        createdAtTo: z.date().optional(),
        updatedAtFrom: z.date().optional(),
        updatedAtTo: z.date().optional(),
        deletedAtFrom: z.date().optional(),
        deletedAtTo: z.date().optional()
    })
    .refine(
        (data) => {
            if (data.amountMin && data.amountMax) {
                return data.amountMin <= data.amountMax;
            }
            return true;
        },
        {
            message: 'amountMin must be less than or equal to amountMax',
            path: ['amountMin', 'amountMax']
        }
    )
    .refine(
        (data) => {
            if (data.issueDateFrom && data.issueDateTo) {
                return data.issueDateFrom <= data.issueDateTo;
            }
            return true;
        },
        {
            message: 'issueDateFrom must be less than or equal to issueDateTo',
            path: ['issueDateFrom', 'issueDateTo']
        }
    )
    .refine(
        (data) => {
            if (data.appliedAtFrom && data.appliedAtTo) {
                return data.appliedAtFrom <= data.appliedAtTo;
            }
            return true;
        },
        {
            message: 'appliedAtFrom must be less than or equal to appliedAtTo',
            path: ['appliedAtFrom', 'appliedAtTo']
        }
    );

export type CreditNoteQuery = z.infer<typeof CreditNoteQuerySchema>;
