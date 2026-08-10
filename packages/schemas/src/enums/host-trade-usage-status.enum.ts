/**
 * Host Trade Benefit Usage Status Enum
 *
 * Lifecycle of a single "this host used this provider's benefit" record
 * (HOS-376 §6.1). One party declares the usage, the counterpart confirms it,
 * and only a confirmed record counts towards the provider's public numbers or
 * unlocks a review.
 *
 * ```
 *                        declared
 *                            │
 *                            ▼
 *                       [ PENDING ] ──── 30 days of silence ──▶ [ EXPIRED ]
 *                         │      │
 *              confirm ───┘      └─── reject
 *                  │                     │
 *                  ▼                     ▼
 *            [ CONFIRMED ]          [ REJECTED ]
 * ```
 *
 * There is deliberately NO auto-confirmed state. Time-based auto-confirmation
 * was considered and rejected (NG-2): it is convenient, but it turns silence
 * into consent, which is precisely the abuse door the confirmation step was
 * introduced to close. An unanswered request simply expires and counts for
 * nothing.
 *
 * `REJECTED` is not merely "not confirmed" — it is an accusation, and it
 * carries consequences the other terminal states do not: it blocks that
 * provider from declaring against that host again, and it feeds the
 * suspension threshold. `EXPIRED` carries none of that.
 */
export enum HostTradeUsageStatusEnum {
    /** Declared, awaiting the counterpart's answer. Counts for nothing yet. */
    PENDING = 'PENDING',
    /** Confirmed by the counterpart. The only state that counts. */
    CONFIRMED = 'CONFIRMED',
    /** Explicitly denied by the counterpart. Blocks and accumulates. */
    REJECTED = 'REJECTED',
    /** Never answered within the window. Silent, consequence-free. */
    EXPIRED = 'EXPIRED'
}
