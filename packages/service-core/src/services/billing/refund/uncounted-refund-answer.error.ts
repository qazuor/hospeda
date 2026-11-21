/**
 * Why a provider refund answer moved money we do not count (HOS-2538).
 * `ANSWER_FOR_SETTLED_EXTERNALLY_CALL`: the provider answered, with a refund id, a call that
 * action 14 had already answered `SETTLED_EXTERNALLY` from the provider panel. That provider refund
 * is real money returned on top of the panel refund the settlement cited, and nothing records it.
 */
export const UNCOUNTED_REFUND_ANSWER_REASONS = ['ANSWER_FOR_SETTLED_EXTERNALLY_CALL'] as const;

/** One of {@link UNCOUNTED_REFUND_ANSWER_REASONS}. */
export type UncountedRefundAnswerReason = (typeof UNCOUNTED_REFUND_ANSWER_REASONS)[number];

/** What an operator needs to find the uncounted provider refund. */
export interface UncountedRefundAnswerInput {
    readonly reason: UncountedRefundAnswerReason;
    readonly refundCallKey: string;
    /** The refund the call belongs to; null if the call row could not be read. */
    readonly refundId: string | null;
    /** The provider refund id the late answer named. */
    readonly providerRefundId: string;
    /** The panel refund id the settlement cited for this call. */
    readonly panelReference: string | null;
}

/**
 * A provider refund answer that arrived after its call was settled from the provider panel
 * (HOS-2538). The answer is NOT written (`completeCall` never overwrites `SETTLED_EXTERNALLY`), so
 * the money it names is not counted anywhere. It is logged with `capture: true`, so the API's
 * capture hook turns it into a Sentry event whose exception type is this class name; the refunds
 * runbook (§8.4) says how to handle it.
 *
 * @param input - The call, its refund and the provider refund the answer named.
 */
export class UncountedRefundAnswerError extends Error {
    readonly reason: UncountedRefundAnswerReason;
    readonly refundCallKey: string;
    readonly refundId: string | null;
    readonly providerRefundId: string;
    readonly panelReference: string | null;

    constructor(input: UncountedRefundAnswerInput) {
        super(
            `Refund call ${input.refundCallKey} was answered with provider refund ${input.providerRefundId} after action 14 settled it (${input.reason}); that money is not counted`
        );
        this.name = 'UncountedRefundAnswerError';
        this.reason = input.reason;
        this.refundCallKey = input.refundCallKey;
        this.refundId = input.refundId;
        this.providerRefundId = input.providerRefundId;
        this.panelReference = input.panelReference;
    }
}
