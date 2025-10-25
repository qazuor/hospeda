import { z } from 'zod';
import { IdSchema } from '../../common/id.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/index.js';

// Helper schemas for HTTP string conversion
const HTTPBooleanSchema = z.union([
    z.boolean(),
    z.string().transform((val, ctx) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Value must be "true" or "false"'
        });
        return z.NEVER;
    })
]);

const HTTPNumberSchema = z.union([
    z.number(),
    z.string().transform((val, ctx) => {
        const num = Number(val);
        if (Number.isNaN(num)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Value must be a valid number'
            });
            return z.NEVER;
        }
        return num;
    })
]);

const HTTPDateSchema = z.union([
    z.date(),
    z.string().transform((val, ctx) => {
        const date = new Date(val);
        if (Number.isNaN(date.getTime())) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Value must be a valid date'
            });
            return z.NEVER;
        }
        return date;
    })
]);

// HTTP request schemas with coercion
export const CreateCreditNoteHTTPSchema = z.object({
    invoiceId: IdSchema,
    clientId: IdSchema,
    creditNoteNumber: z.string().min(1).max(100),
    amount: HTTPNumberSchema.refine((val) => val > 0, { message: 'Amount must be positive' }),
    currency: PriceCurrencyEnumSchema,
    reason: z.string().min(1).max(500),
    description: z.string().max(1000).optional(),
    issueDate: HTTPDateSchema
});

export const UpdateCreditNoteHTTPSchema = z.object({
    creditNoteNumber: z.string().min(1).max(100).optional(),
    amount: HTTPNumberSchema.refine((val) => val > 0, {
        message: 'Amount must be positive'
    }).optional(),
    currency: PriceCurrencyEnumSchema.optional(),
    reason: z.string().min(1).max(500).optional(),
    description: z.string().max(1000).optional(),
    issueDate: HTTPDateSchema.optional()
});

export const CreditNoteQueryHTTPSchema = z
    .object({
        q: z.string().min(1).optional(),
        invoiceId: IdSchema.optional(),
        clientId: IdSchema.optional(),
        creditNoteNumber: z.string().optional(),
        currency: PriceCurrencyEnumSchema.optional(),
        reason: z.string().optional(),
        isApplied: HTTPBooleanSchema.optional(),
        issueDate: HTTPDateSchema.optional(),
        appliedAt: HTTPDateSchema.optional(),
        amountMin: HTTPNumberSchema.refine((val) => val > 0, {
            message: 'Amount must be positive'
        }).optional(),
        amountMax: HTTPNumberSchema.refine((val) => val > 0, {
            message: 'Amount must be positive'
        }).optional(),
        issueDateFrom: HTTPDateSchema.optional(),
        issueDateTo: HTTPDateSchema.optional(),
        appliedAtFrom: HTTPDateSchema.optional(),
        appliedAtTo: HTTPDateSchema.optional(),
        createdAt: HTTPDateSchema.optional(),
        updatedAt: HTTPDateSchema.optional(),
        deletedAt: HTTPDateSchema.optional().nullable(),
        createdById: IdSchema.optional(),
        updatedById: IdSchema.optional(),
        deletedById: IdSchema.optional().nullable(),
        createdAtFrom: HTTPDateSchema.optional(),
        createdAtTo: HTTPDateSchema.optional(),
        updatedAtFrom: HTTPDateSchema.optional(),
        updatedAtTo: HTTPDateSchema.optional(),
        deletedAtFrom: HTTPDateSchema.optional(),
        deletedAtTo: HTTPDateSchema.optional()
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

export type CreateCreditNoteHTTP = z.infer<typeof CreateCreditNoteHTTPSchema>;
export type UpdateCreditNoteHTTP = z.infer<typeof UpdateCreditNoteHTTPSchema>;
export type CreditNoteQueryHTTP = z.infer<typeof CreditNoteQueryHTTPSchema>;
