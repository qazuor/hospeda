import { z } from 'zod';
import { IdSchema } from '../../common/id.schema.js';

// Simplified relation schemas to avoid circular dependencies
export const RefundPaymentRelationSchema = z.object({
    id: IdSchema,
    amount: z.number(),
    currency: z.string(),
    status: z.string(),
    provider: z.string()
});

export const RefundClientRelationSchema = z.object({
    id: IdSchema,
    name: z.string(),
    email: z.string().email()
});

export const RefundProcessorRelationSchema = z.object({
    id: IdSchema,
    name: z.string(),
    email: z.string().email()
});

// Full refund with relations
export const RefundWithRelationsSchema = z.object({
    id: IdSchema,
    paymentId: IdSchema,
    clientId: IdSchema,
    refundNumber: z.string(),
    amount: z.number(),
    currency: z.string(),
    reason: z.string(),
    description: z.string().optional(),
    status: z.string(),
    processedAt: z.date().optional().nullable(),
    processedById: IdSchema.optional().nullable(),
    providerRefundId: z.string().optional(),
    providerResponse: z.record(z.string(), z.any()).optional(),
    failureReason: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
    deletedAt: z.date().optional().nullable(),
    createdById: IdSchema,
    updatedById: IdSchema,
    deletedById: IdSchema.optional().nullable(),

    // Relations
    payment: RefundPaymentRelationSchema.optional(),
    client: RefundClientRelationSchema.optional(),
    processedBy: RefundProcessorRelationSchema.optional()
});

export type RefundPaymentRelation = z.infer<typeof RefundPaymentRelationSchema>;
export type RefundClientRelation = z.infer<typeof RefundClientRelationSchema>;
export type RefundProcessorRelation = z.infer<typeof RefundProcessorRelationSchema>;
export type RefundWithRelations = z.infer<typeof RefundWithRelationsSchema>;
