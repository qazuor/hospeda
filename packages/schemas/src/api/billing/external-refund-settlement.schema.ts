import { z } from 'zod';

/**
 * Where an out-of-flow refund was settled (HOS-1540 notes H2). Mirrors
 * `REFUND_EXTERNAL_CHANNELS` in `@repo/db`, which this package cannot import;
 * the admin route test asserts both lists stay equal.
 */
export const ExternalRefundSettlementChannelSchema = z.enum(['BANK_TRANSFER', 'PROVIDER_PANEL']);

/** A channel of an out-of-flow refund settlement. */
export type ExternalRefundSettlementChannel = z.infer<typeof ExternalRefundSettlementChannelSchema>;

/**
 * The reasons an RF4 settlement is recorded with (HOS-1540 notes H10). Mirrors
 * `RF4_REASONS` in `@repo/service-core`; the admin route test asserts both
 * lists stay equal.
 */
export const ExternalRefundSettlementReasonSchema = z.enum([
    'OUT_OF_FLOW_REFUND',
    'MANUAL_PAYMENT_REFUND',
    'STALE_CHARGE_REFUND'
]);

/** A reason of an RF4 settlement. */
export type ExternalRefundSettlementReason = z.infer<typeof ExternalRefundSettlementReasonSchema>;

/**
 * Body of admin action 14 (ACC:14, RF4): settle a refund that already happened
 * outside our flow, by bank transfer or from the provider panel.
 *
 * - Exactly one of `paymentId` (a provider `payment`) and `manualPaymentId`.
 * - `amount` in cents, a positive integer.
 * - `reference`: the transfer receipt or the provider panel refund id.
 * - `refundId`: the open RF1 `REQUESTED` this settlement closes (AC:B5:41).
 * - `onAmountMismatch`: the person's choice when the amount differs from the
 *   open request (notes H5); without it a mismatch is a 409.
 * - `manualPaymentScope`: whether a manual payment refund is total (releases
 *   its coverage) or partial; required for, and only for, a manual payment (H9).
 * - `note`: optional free text kept in the audit record (H13).
 */
export const ExternalRefundSettlementRequestSchema = z
    .object({
        paymentId: z.string().uuid().optional(),
        manualPaymentId: z.string().uuid().optional(),
        amount: z.number().int().positive(),
        channel: ExternalRefundSettlementChannelSchema,
        reference: z.string().trim().min(1).max(255),
        reason: ExternalRefundSettlementReasonSchema,
        refundId: z.string().uuid().optional(),
        onAmountMismatch: z.enum(['CLOSE_WITH_SETTLED_AMOUNT', 'SETTLE_SEPARATELY']).optional(),
        manualPaymentScope: z.enum(['TOTAL', 'PARTIAL']).optional(),
        note: z.string().trim().max(2000).optional()
    })
    .refine((body) => (body.paymentId === undefined) !== (body.manualPaymentId === undefined), {
        message: 'Exactly one of paymentId and manualPaymentId is required',
        path: ['paymentId']
    });

/** Parsed body of admin action 14. */
export type ExternalRefundSettlementRequest = z.infer<typeof ExternalRefundSettlementRequestSchema>;

/**
 * What the settlement did to the payment: `P3`/`P4`/`P5` on a provider payment,
 * or one of `applyExecutedRefund`'s no-op outcomes. `null` on a manual payment.
 */
export const ExternalRefundPaymentOutcomeSchema = z.enum([
    'P3',
    'P4',
    'P5',
    'REFUND_NOT_EXECUTED',
    'NOT_A_PROVIDER_PAYMENT',
    'NOT_APPLICABLE',
    'ALREADY_APPLIED'
]);

/** An outcome of applying an executed refund to its payment. */
export type ExternalRefundPaymentOutcome = z.infer<typeof ExternalRefundPaymentOutcomeSchema>;

/**
 * Response of admin action 14: the `EXECUTED` refund row, whether it closed an
 * open request (AC:B5:41), what it did to the payment and whether a coverage
 * period was released.
 */
export const ExternalRefundSettlementResponseSchema = z.object({
    refundId: z.string().uuid(),
    status: z.literal('EXECUTED'),
    closedRequestedRefund: z.boolean(),
    paymentOutcome: ExternalRefundPaymentOutcomeSchema.nullable(),
    coverageReleased: z.boolean()
});

/** Response of admin action 14. */
export type ExternalRefundSettlementResponse = z.infer<
    typeof ExternalRefundSettlementResponseSchema
>;
