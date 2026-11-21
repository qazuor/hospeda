import { z } from 'zod';
import { ExternalRefundPaymentOutcomeSchema } from './external-refund-settlement.schema.js';

/** Path params of the remainder settlement (HOS-2406): the partially accepted refund. */
export const RefundRemainderSettlementParamsSchema = z.object({
    refundId: z.string().uuid()
});

/** Parsed path params of the remainder settlement. */
export type RefundRemainderSettlementParams = z.infer<typeof RefundRemainderSettlementParamsSchema>;

/**
 * Body of the remainder settlement (HOS-2406, ACC:14): record the remainder of a `CONFIRMED`
 * refund the provider accepted only in part, refunded by hand from the provider panel.
 *
 * - `amount`: the remainder in cents; it must equal the refund amount minus what the provider
 *   accepted, or the service answers `REMAINDER_AMOUNT_MISMATCH`.
 * - `reference`: the provider panel refund id of the remainder.
 * - `note`: optional free text kept in the audit record.
 */
export const RefundRemainderSettlementRequestSchema = z.object({
    amount: z.number().int().positive(),
    reference: z.string().trim().min(1).max(255),
    note: z.string().trim().max(2000).optional()
});

/** Parsed body of the remainder settlement. */
export type RefundRemainderSettlementRequest = z.infer<
    typeof RefundRemainderSettlementRequestSchema
>;

/**
 * Response of the remainder settlement: the refund, now `EXECUTED`, the part the provider
 * accepted and the remainder recorded (both in cents), what it did to the payment, and whether a
 * coverage period was released.
 */
export const RefundRemainderSettlementResponseSchema = z.object({
    refundId: z.string().uuid(),
    status: z.literal('EXECUTED'),
    acceptedAmount: z.number().int().nonnegative(),
    remainderAmount: z.number().int().positive(),
    paymentOutcome: ExternalRefundPaymentOutcomeSchema,
    coverageReleased: z.boolean()
});

/** Response of the remainder settlement. */
export type RefundRemainderSettlementResponse = z.infer<
    typeof RefundRemainderSettlementResponseSchema
>;
