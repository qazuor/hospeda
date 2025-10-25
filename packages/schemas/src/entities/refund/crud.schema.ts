import { z } from 'zod';
import { IdSchema } from '../../common/id.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/index.js';
import { RefundReasonEnumSchema, RefundStatusEnumSchema } from './refund.schema.js';

export const CreateRefundSchema = z.object({
    paymentId: IdSchema,
    clientId: IdSchema,
    refundNumber: z.string().min(1).max(100),
    amount: z.number().positive(),
    currency: PriceCurrencyEnumSchema,
    reason: RefundReasonEnumSchema,
    description: z.string().max(1000).optional()
});

export const UpdateRefundSchema = z.object({
    refundNumber: z.string().min(1).max(100).optional(),
    amount: z.number().positive().optional(),
    currency: PriceCurrencyEnumSchema.optional(),
    reason: RefundReasonEnumSchema.optional(),
    description: z.string().max(1000).optional(),
    status: RefundStatusEnumSchema.optional(),
    processedAt: z.date().optional().nullable(),
    processedById: IdSchema.optional().nullable(),
    providerRefundId: z.string().optional(),
    providerResponse: z.record(z.string(), z.any()).optional(),
    failureReason: z.string().max(500).optional()
});

export const DeleteRefundSchema = z.object({
    id: IdSchema
});

export const RestoreRefundSchema = z.object({
    id: IdSchema
});

export const RefundKeySchema = z.object({
    id: IdSchema
});

export type CreateRefundInput = z.infer<typeof CreateRefundSchema>;
export type UpdateRefundInput = z.infer<typeof UpdateRefundSchema>;
export type DeleteRefundInput = z.infer<typeof DeleteRefundSchema>;
export type RestoreRefundInput = z.infer<typeof RestoreRefundSchema>;
export type RefundKey = z.infer<typeof RefundKeySchema>;
