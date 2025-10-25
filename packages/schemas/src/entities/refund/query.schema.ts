import { z } from 'zod';
import { IdSchema } from '../../common/id.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/index.js';
import { RefundReasonEnumSchema, RefundStatusEnumSchema } from './refund.schema.js';

export const RefundQuerySchema = z
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
        amountMin: z.number().positive().optional(),
        amountMax: z.number().positive().optional(),
        processedAtFrom: z.date().optional(),
        processedAtTo: z.date().optional(),
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

export type RefundQuery = z.infer<typeof RefundQuerySchema>;
