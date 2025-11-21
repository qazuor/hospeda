import { z } from 'zod';
import { PaymentIdSchema } from '../../common/id.schema.js';
import { BaseSearchSchema } from '../../common/pagination.schema.js';
import { PaymentStatusEnumSchema } from '../../enums/index.js';
import { PaymentSchema } from './payment.schema.js';

/**
 * Payment CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for payments:
 * - Payment (create/update/cancel/refund)
 */

// ============================================================================
// PAYMENT CRUD SCHEMAS
// ============================================================================

/**
 * Schema for creating a new payment
 * Omits auto-generated fields like id and audit fields
 */
export const PaymentCreateInputSchema = PaymentSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Schema for payment creation response
 * Returns the complete payment object
 */
export const PaymentCreateOutputSchema = PaymentSchema;

/**
 * Schema for updating a payment (PUT - complete replacement)
 * Omits auto-generated fields and makes all fields partial
 */
export const PaymentUpdateInputSchema = PaymentSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial();

/**
 * Schema for partial payment updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const PaymentPatchInputSchema = PaymentUpdateInputSchema;

/**
 * Schema for payment update response
 * Returns the complete updated payment object
 */
export const PaymentUpdateOutputSchema = PaymentSchema;

/**
 * Schema for payment cancellation input
 * Requires payment ID and optional cancellation reason
 */
export const PaymentCancelInputSchema = z.object({
    id: PaymentIdSchema,
    reason: z
        .string({
            message: 'zodError.payment.cancel.reason.invalidType'
        })
        .min(1, { message: 'zodError.payment.cancel.reason.min' })
        .max(500, { message: 'zodError.payment.cancel.reason.max' })
        .optional(),
    refundAmount: z
        .number({
            message: 'zodError.payment.cancel.refundAmount.invalidType'
        })
        .min(0, { message: 'zodError.payment.cancel.refundAmount.min' })
        .optional()
});

/**
 * Schema for payment cancellation response
 * Returns cancellation status and details
 */
export const PaymentCancelOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.payment.cancel.success.required'
        })
        .default(true),
    payment: PaymentSchema,
    refundDetails: z
        .object({
            refundId: z.string().optional(),
            refundAmount: z.number().min(0),
            refundStatus: z.enum(['pending', 'processing', 'completed', 'failed']),
            estimatedRefundDate: z.date().optional()
        })
        .optional()
});

/**
 * Schema for payment refund input
 * Requires payment ID and refund details
 */
export const PaymentRefundInputSchema = z.object({
    id: PaymentIdSchema,
    refundAmount: z
        .number({
            message: 'zodError.payment.refund.refundAmount.required'
        })
        .min(0.01, { message: 'zodError.payment.refund.refundAmount.min' }),
    reason: z
        .string({
            message: 'zodError.payment.refund.reason.required'
        })
        .min(1, { message: 'zodError.payment.refund.reason.min' })
        .max(500, { message: 'zodError.payment.refund.reason.max' }),
    isPartialRefund: z
        .boolean({
            message: 'zodError.payment.refund.isPartialRefund.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for payment refund response
 * Returns refund status and details
 */
export const PaymentRefundOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.payment.refund.success.required'
        })
        .default(true),
    refundId: z.string(),
    refundAmount: z.number().min(0),
    refundStatus: z.enum(['pending', 'processing', 'completed', 'failed']),
    estimatedRefundDate: z.date().optional(),
    updatedPayment: PaymentSchema
});

// ============================================================================
// BULK OPERATIONS SCHEMAS
// ============================================================================

/**
 * Schema for bulk payment operations input
 * Requires array of payment IDs and operation type
 */
export const PaymentBulkOperationInputSchema = z.object({
    ids: z
        .array(PaymentIdSchema, {
            message: 'zodError.payment.bulkOperation.ids.required'
        })
        .min(1, { message: 'zodError.payment.bulkOperation.ids.min' })
        .max(100, { message: 'zodError.payment.bulkOperation.ids.max' }),
    operation: z.enum(['cancel', 'refund'], {
        message: 'zodError.payment.bulkOperation.operation.enum'
    }),
    reason: z
        .string({
            message: 'zodError.payment.bulkOperation.reason.invalidType'
        })
        .min(1, { message: 'zodError.payment.bulkOperation.reason.min' })
        .max(500, { message: 'zodError.payment.bulkOperation.reason.max' })
        .optional()
});

/**
 * Schema for bulk payment operations response
 * Returns operation results for each payment
 */
export const PaymentBulkOperationOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.payment.bulkOperation.success.required'
        })
        .default(true),
    results: z.array(
        z.object({
            id: PaymentIdSchema,
            success: z.boolean(),
            error: z.string().optional(),
            refundAmount: z.number().min(0).optional()
        })
    ),
    summary: z.object({
        total: z.number().int().min(0),
        successful: z.number().int().min(0),
        failed: z.number().int().min(0),
        totalRefundAmount: z.number().min(0).optional()
    })
});

// ============================================================================
// PAYMENT SEARCH SCHEMA
// ============================================================================

/**
 * Schema for searching/filtering payments
 * Extends base search with payment-specific filters
 */
export const PaymentSearchSchema = BaseSearchSchema.extend({
    status: PaymentStatusEnumSchema.optional(),
    userId: z.string().uuid().optional(),
    pricingPlanId: z.string().uuid().optional(),
    minAmount: z.number().min(0).optional(),
    maxAmount: z.number().min(0).optional(),
    fromDate: z.date().optional(),
    toDate: z.date().optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PaymentCreateInput = z.infer<typeof PaymentCreateInputSchema>;
export type PaymentCreateOutput = z.infer<typeof PaymentCreateOutputSchema>;
export type PaymentUpdateInput = z.infer<typeof PaymentUpdateInputSchema>;
export type PaymentPatchInput = z.infer<typeof PaymentPatchInputSchema>;
export type PaymentUpdateOutput = z.infer<typeof PaymentUpdateOutputSchema>;
export type PaymentCancelInput = z.infer<typeof PaymentCancelInputSchema>;
export type PaymentCancelOutput = z.infer<typeof PaymentCancelOutputSchema>;
export type PaymentRefundInput = z.infer<typeof PaymentRefundInputSchema>;
export type PaymentRefundOutput = z.infer<typeof PaymentRefundOutputSchema>;

export type PaymentBulkOperationInput = z.infer<typeof PaymentBulkOperationInputSchema>;
export type PaymentBulkOperationOutput = z.infer<typeof PaymentBulkOperationOutputSchema>;
export type PaymentSearchInput = z.infer<typeof PaymentSearchSchema>;

// ============================================================================
// Compatibility Aliases (for service naming conventions)
// ============================================================================

/**
 * Alias for PaymentUpdateInputSchema to match service naming convention
 * @deprecated Use PaymentUpdateInputSchema instead
 */
export const UpdatePaymentSchema = PaymentUpdateInputSchema;
