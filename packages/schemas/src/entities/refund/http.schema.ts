import { z } from 'zod';
import { IdSchema } from '../../common/id.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/index.js';
import { RefundReasonEnumSchema, RefundStatusEnumSchema } from './refund.schema.js';

// Helper schemas for HTTP string conversion
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
export const CreateRefundHTTPSchema = z.object({
    paymentId: IdSchema,
    clientId: IdSchema,
    refundNumber: z.string().min(1).max(100),
    amount: HTTPNumberSchema.refine((val) => val > 0, { message: 'Amount must be positive' }),
    currency: PriceCurrencyEnumSchema,
    reason: RefundReasonEnumSchema,
    description: z.string().max(1000).optional()
});

export const UpdateRefundHTTPSchema = z.object({
    refundNumber: z.string().min(1).max(100).optional(),
    amount: HTTPNumberSchema.refine((val) => val > 0, {
        message: 'Amount must be positive'
    }).optional(),
    currency: PriceCurrencyEnumSchema.optional(),
    reason: RefundReasonEnumSchema.optional(),
    description: z.string().max(1000).optional(),
    status: RefundStatusEnumSchema.optional(),
    processedAt: HTTPDateSchema.optional().nullable(),
    processedById: IdSchema.optional().nullable(),
    providerRefundId: z.string().optional(),
    failureReason: z.string().max(500).optional()
});

export const RefundQueryHTTPSchema = z
    .object({
        q: z.string().min(1).optional(),
        paymentId: IdSchema.optional(),
        clientId: IdSchema.optional(),
        refundNumber: z.string().optional(),
        currency: PriceCurrencyEnumSchema.optional(),
        reason: RefundReasonEnumSchema.optional(),
        status: RefundStatusEnumSchema.optional(),
        processedById: IdSchema.optional(),
        providerRefundId: z.string().optional(),
        amountMin: HTTPNumberSchema.refine((val) => val > 0, {
            message: 'Amount must be positive'
        }).optional(),
        amountMax: HTTPNumberSchema.refine((val) => val > 0, {
            message: 'Amount must be positive'
        }).optional(),
        processedAtFrom: HTTPDateSchema.optional(),
        processedAtTo: HTTPDateSchema.optional(),
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
            if (data.processedAtFrom && data.processedAtTo) {
                return data.processedAtFrom <= data.processedAtTo;
            }
            return true;
        },
        {
            message: 'processedAtFrom must be less than or equal to processedAtTo',
            path: ['processedAtFrom', 'processedAtTo']
        }
    )
    .refine(
        (data) => {
            if (data.createdAtFrom && data.createdAtTo) {
                return data.createdAtFrom <= data.createdAtTo;
            }
            return true;
        },
        {
            message: 'createdAtFrom must be less than or equal to createdAtTo',
            path: ['createdAtFrom', 'createdAtTo']
        }
    )
    .refine(
        (data) => {
            if (data.updatedAtFrom && data.updatedAtTo) {
                return data.updatedAtFrom <= data.updatedAtTo;
            }
            return true;
        },
        {
            message: 'updatedAtFrom must be less than or equal to updatedAtTo',
            path: ['updatedAtFrom', 'updatedAtTo']
        }
    )
    .refine(
        (data) => {
            if (data.deletedAtFrom && data.deletedAtTo) {
                return data.deletedAtFrom <= data.deletedAtTo;
            }
            return true;
        },
        {
            message: 'deletedAtFrom must be less than or equal to deletedAtTo',
            path: ['deletedAtFrom', 'deletedAtTo']
        }
    );

export type CreateRefundHTTP = z.infer<typeof CreateRefundHTTPSchema>;
export type UpdateRefundHTTP = z.infer<typeof UpdateRefundHTTPSchema>;
export type RefundQueryHTTP = z.infer<typeof RefundQueryHTTPSchema>;
