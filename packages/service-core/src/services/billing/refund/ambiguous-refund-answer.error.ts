/** Why a provider refund answer could not be bound to our refund call (HOS-2007, HOS-1553 Q-5). */
export const AMBIGUOUS_REFUND_ANSWER_REASONS = [
    'NO_NEW_ORDER_REFUND',
    'SEVERAL_NEW_ORDER_REFUNDS',
    'ORDER_REFUND_AMOUNT_MISMATCH',
    'NO_UNNAMED_PAYMENT_REFUND',
    'SEVERAL_UNNAMED_PAYMENT_REFUNDS'
] as const;

/** One of {@link AMBIGUOUS_REFUND_ANSWER_REASONS}. */
export type AmbiguousRefundAnswerReason = (typeof AMBIGUOUS_REFUND_ANSWER_REASONS)[number];

/** A provider refund that could be ours. */
export interface AmbiguousRefundCandidate {
    readonly providerRefundId: string;
    readonly amountMinor: number;
}

/** Everything an operator needs to settle the ambiguous refund by hand. */
export interface AmbiguousRefundAnswerInput {
    readonly kind: 'ORDER' | 'PAYMENT';
    readonly refundId: string;
    readonly refundCallKey: string;
    readonly paymentId: string;
    readonly providerFactId: string;
    readonly orderId: string | null;
    readonly expectedAmountMinor: number;
    readonly reason: AmbiguousRefundAnswerReason;
    readonly candidates: readonly AmbiguousRefundCandidate[];
}

/**
 * A provider refund answer that names no single refund of ours (HOS-1553 Q-5:
 * fail closed). The call stays unanswered and the refund waits for a person.
 * It is logged with `capture: true`, so the API's capture hook turns it into a
 * Sentry event whose exception type is this class name (HOS-2007).
 *
 * @param input - Refund and provider details needed to investigate the answer.
 */
export class AmbiguousRefundAnswerError extends Error {
    readonly kind: AmbiguousRefundAnswerInput['kind'];
    readonly refundId: string;
    readonly refundCallKey: string;
    readonly paymentId: string;
    readonly providerFactId: string;
    readonly orderId: string | null;
    readonly expectedAmountMinor: number;
    readonly reason: AmbiguousRefundAnswerReason;
    readonly candidates: readonly AmbiguousRefundCandidate[];

    constructor(input: AmbiguousRefundAnswerInput) {
        super(
            `Refund ${input.refundId} has an ambiguous provider answer (${input.reason}); it waits for a manual settlement`
        );
        this.name = 'AmbiguousRefundAnswerError';
        this.kind = input.kind;
        this.refundId = input.refundId;
        this.refundCallKey = input.refundCallKey;
        this.paymentId = input.paymentId;
        this.providerFactId = input.providerFactId;
        this.orderId = input.orderId;
        this.expectedAmountMinor = input.expectedAmountMinor;
        this.reason = input.reason;
        this.candidates = input.candidates.map((candidate) => ({ ...candidate }));
    }
}
