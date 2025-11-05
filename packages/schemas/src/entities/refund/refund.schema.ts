import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { IdSchema } from '../../common/id.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/index.js';

/**
 * Refund Status Enum
 */
export enum RefundStatusEnum {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled'
}

export const RefundStatusEnumSchema = z.nativeEnum(RefundStatusEnum, {
    error: () => ({ message: 'zodError.enums.refundStatus.invalid' })
});

/**
 * Refund Reason Enum
 */
export enum RefundReasonEnum {
    CUSTOMER_REQUEST = 'customer_request',
    BILLING_ERROR = 'billing_error',
    DUPLICATE_PAYMENT = 'duplicate_payment',
    CANCELLED_SERVICE = 'cancelled_service',
    OVERPAYMENT = 'overpayment',
    FRAUDULENT_TRANSACTION = 'fraudulent_transaction',
    TECHNICAL_ERROR = 'technical_error',
    OTHER = 'other'
}

export const RefundReasonEnumSchema = z.nativeEnum(RefundReasonEnum, {
    error: () => ({ message: 'zodError.enums.refundReason.invalid' })
});

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
    amount: z.number().positive(),
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
export type RefundStatus = z.infer<typeof RefundStatusEnumSchema>;
export type RefundReason = z.infer<typeof RefundReasonEnumSchema>;
