import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { IdSchema } from '../../common/id.schema.js';
import {
    PriceCurrencyEnumSchema,
    RefundReasonEnumSchema,
    RefundStatusEnumSchema
} from '../../enums/index.js';
import { numericField } from '../../utils/index.js';

/**
 * Main Refund Schema
 * Represents a refund transaction against a payment
 */
export const RefundSchema = z.object({
    // Base fields
    id: IdSchema,
    ...BaseAuditFields,
    paymentId: IdSchema,
    clientId: IdSchema,
    refundNumber: z.string().min(1).max(100),
    amount: numericField(z.number().positive()),
    currency: PriceCurrencyEnumSchema,
    reason: RefundReasonEnumSchema,
    description: z.string().max(1000).optional(),
    status: RefundStatusEnumSchema,
    processedAt: z.date().optional().nullable(),
    processedById: IdSchema.optional().nullable(),
    providerRefundId: z.string().optional(),
    providerResponse: z.record(z.string(), z.any()).optional(),
    failureReason: z.string().max(500).optional()
});

export type RefundType = z.infer<typeof RefundSchema>;
export type Refund = RefundType; // Alias for consistency
