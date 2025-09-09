import { z } from 'zod';
import {
    PaymentIdSchema,
    PaymentPlanIdSchema,
    SubscriptionIdSchema
} from '../../common/id.schema.js';
import { PaymentPlanSchema } from './payment-plan.schema.js';
import { PaymentSchema } from './payment.schema.js';
import { SubscriptionSchema } from './subscription.schema.js';

/**
 * Payment CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for payments:
 * - Payment (create/update/cancel/refund)
 * - PaymentPlan (create/update/delete/activate/deactivate)
 * - Subscription (create/update/cancel/reactivate)
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
// PAYMENT PLAN CRUD SCHEMAS
// ============================================================================

/**
 * Schema for creating a new payment plan
 * Omits auto-generated fields like id and audit fields
 */
export const PaymentPlanCreateInputSchema = PaymentPlanSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Schema for payment plan creation response
 * Returns the complete payment plan object
 */
export const PaymentPlanCreateOutputSchema = PaymentPlanSchema;

/**
 * Schema for updating a payment plan (PUT - complete replacement)
 * Omits auto-generated fields and makes all fields partial
 */
export const PaymentPlanUpdateInputSchema = PaymentPlanSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial();

/**
 * Schema for partial payment plan updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const PaymentPlanPatchInputSchema = PaymentPlanUpdateInputSchema;

/**
 * Schema for payment plan update response
 * Returns the complete updated payment plan object
 */
export const PaymentPlanUpdateOutputSchema = PaymentPlanSchema;

/**
 * Schema for payment plan deletion input
 * Requires ID and optional force flag for hard delete
 */
export const PaymentPlanDeleteInputSchema = z.object({
    id: PaymentPlanIdSchema,
    force: z
        .boolean({
            message: 'zodError.paymentPlan.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for payment plan deletion response
 * Returns success status and deletion timestamp
 */
export const PaymentPlanDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.paymentPlan.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.paymentPlan.delete.deletedAt.invalidType'
        })
        .optional()
});

/**
 * Schema for payment plan activation input
 * Requires only the payment plan ID
 */
export const PaymentPlanActivateInputSchema = z.object({
    id: PaymentPlanIdSchema,
    effectiveDate: z
        .date({
            message: 'zodError.paymentPlan.activate.effectiveDate.invalidType'
        })
        .optional()
});

/**
 * Schema for payment plan activation response
 * Returns the activated payment plan object
 */
export const PaymentPlanActivateOutputSchema = PaymentPlanSchema;

/**
 * Schema for payment plan deactivation input
 * Requires payment plan ID and optional reason
 */
export const PaymentPlanDeactivateInputSchema = z.object({
    id: PaymentPlanIdSchema,
    reason: z
        .string({
            message: 'zodError.paymentPlan.deactivate.reason.invalidType'
        })
        .min(1, { message: 'zodError.paymentPlan.deactivate.reason.min' })
        .max(500, { message: 'zodError.paymentPlan.deactivate.reason.max' })
        .optional(),
    effectiveDate: z
        .date({
            message: 'zodError.paymentPlan.deactivate.effectiveDate.invalidType'
        })
        .optional()
});

/**
 * Schema for payment plan deactivation response
 * Returns the deactivated payment plan object
 */
export const PaymentPlanDeactivateOutputSchema = PaymentPlanSchema;

// ============================================================================
// SUBSCRIPTION CRUD SCHEMAS
// ============================================================================

/**
 * Schema for creating a new subscription
 * Omits auto-generated fields like id and audit fields
 */
export const SubscriptionCreateInputSchema = SubscriptionSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Schema for subscription creation response
 * Returns the complete subscription object
 */
export const SubscriptionCreateOutputSchema = SubscriptionSchema;

/**
 * Schema for updating a subscription (PUT - complete replacement)
 * Omits auto-generated fields and makes all fields partial
 */
export const SubscriptionUpdateInputSchema = SubscriptionSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial();

/**
 * Schema for partial subscription updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const SubscriptionPatchInputSchema = SubscriptionUpdateInputSchema;

/**
 * Schema for subscription update response
 * Returns the complete updated subscription object
 */
export const SubscriptionUpdateOutputSchema = SubscriptionSchema;

/**
 * Schema for subscription cancellation input
 * Requires subscription ID and optional cancellation details
 */
export const SubscriptionCancelInputSchema = z.object({
    id: SubscriptionIdSchema,
    reason: z
        .string({
            message: 'zodError.subscription.cancel.reason.invalidType'
        })
        .min(1, { message: 'zodError.subscription.cancel.reason.min' })
        .max(500, { message: 'zodError.subscription.cancel.reason.max' })
        .optional(),
    cancelAtPeriodEnd: z
        .boolean({
            message: 'zodError.subscription.cancel.cancelAtPeriodEnd.invalidType'
        })
        .optional()
        .default(true),
    effectiveDate: z
        .date({
            message: 'zodError.subscription.cancel.effectiveDate.invalidType'
        })
        .optional()
});

/**
 * Schema for subscription cancellation response
 * Returns cancellation status and details
 */
export const SubscriptionCancelOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.subscription.cancel.success.required'
        })
        .default(true),
    subscription: SubscriptionSchema,
    cancellationDetails: z.object({
        cancelledAt: z.date(),
        effectiveDate: z.date(),
        refundAmount: z.number().min(0).optional(),
        accessUntil: z.date().optional()
    })
});

/**
 * Schema for subscription reactivation input
 * Requires subscription ID and optional reactivation details
 */
export const SubscriptionReactivateInputSchema = z.object({
    id: SubscriptionIdSchema,
    newPlanId: PaymentPlanIdSchema.optional(),
    effectiveDate: z
        .date({
            message: 'zodError.subscription.reactivate.effectiveDate.invalidType'
        })
        .optional(),
    prorateBilling: z
        .boolean({
            message: 'zodError.subscription.reactivate.prorateBilling.invalidType'
        })
        .optional()
        .default(true)
});

/**
 * Schema for subscription reactivation response
 * Returns reactivation status and details
 */
export const SubscriptionReactivateOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.subscription.reactivate.success.required'
        })
        .default(true),
    subscription: SubscriptionSchema,
    reactivationDetails: z.object({
        reactivatedAt: z.date(),
        effectiveDate: z.date(),
        prorationAmount: z.number().optional(),
        nextBillingDate: z.date()
    })
});

/**
 * Schema for subscription plan change input
 * Requires subscription ID and new plan details
 */
export const SubscriptionChangePlanInputSchema = z.object({
    id: SubscriptionIdSchema,
    newPlanId: PaymentPlanIdSchema,
    effectiveDate: z
        .date({
            message: 'zodError.subscription.changePlan.effectiveDate.invalidType'
        })
        .optional(),
    prorateBilling: z
        .boolean({
            message: 'zodError.subscription.changePlan.prorateBilling.invalidType'
        })
        .optional()
        .default(true)
});

/**
 * Schema for subscription plan change response
 * Returns plan change status and details
 */
export const SubscriptionChangePlanOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.subscription.changePlan.success.required'
        })
        .default(true),
    subscription: SubscriptionSchema,
    planChangeDetails: z.object({
        changedAt: z.date(),
        effectiveDate: z.date(),
        previousPlanId: PaymentPlanIdSchema,
        newPlanId: PaymentPlanIdSchema,
        prorationAmount: z.number().optional(),
        nextBillingDate: z.date()
    })
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

export type PaymentPlanCreateInput = z.infer<typeof PaymentPlanCreateInputSchema>;
export type PaymentPlanCreateOutput = z.infer<typeof PaymentPlanCreateOutputSchema>;
export type PaymentPlanUpdateInput = z.infer<typeof PaymentPlanUpdateInputSchema>;
export type PaymentPlanPatchInput = z.infer<typeof PaymentPlanPatchInputSchema>;
export type PaymentPlanUpdateOutput = z.infer<typeof PaymentPlanUpdateOutputSchema>;
export type PaymentPlanDeleteInput = z.infer<typeof PaymentPlanDeleteInputSchema>;
export type PaymentPlanDeleteOutput = z.infer<typeof PaymentPlanDeleteOutputSchema>;
export type PaymentPlanActivateInput = z.infer<typeof PaymentPlanActivateInputSchema>;
export type PaymentPlanActivateOutput = z.infer<typeof PaymentPlanActivateOutputSchema>;
export type PaymentPlanDeactivateInput = z.infer<typeof PaymentPlanDeactivateInputSchema>;
export type PaymentPlanDeactivateOutput = z.infer<typeof PaymentPlanDeactivateOutputSchema>;

export type SubscriptionCreateInput = z.infer<typeof SubscriptionCreateInputSchema>;
export type SubscriptionCreateOutput = z.infer<typeof SubscriptionCreateOutputSchema>;
export type SubscriptionUpdateInput = z.infer<typeof SubscriptionUpdateInputSchema>;
export type SubscriptionPatchInput = z.infer<typeof SubscriptionPatchInputSchema>;
export type SubscriptionUpdateOutput = z.infer<typeof SubscriptionUpdateOutputSchema>;
export type SubscriptionCancelInput = z.infer<typeof SubscriptionCancelInputSchema>;
export type SubscriptionCancelOutput = z.infer<typeof SubscriptionCancelOutputSchema>;
export type SubscriptionReactivateInput = z.infer<typeof SubscriptionReactivateInputSchema>;
export type SubscriptionReactivateOutput = z.infer<typeof SubscriptionReactivateOutputSchema>;
export type SubscriptionChangePlanInput = z.infer<typeof SubscriptionChangePlanInputSchema>;
export type SubscriptionChangePlanOutput = z.infer<typeof SubscriptionChangePlanOutputSchema>;

export type PaymentBulkOperationInput = z.infer<typeof PaymentBulkOperationInputSchema>;
export type PaymentBulkOperationOutput = z.infer<typeof PaymentBulkOperationOutputSchema>;
