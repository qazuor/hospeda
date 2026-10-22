/**
 * Structural provider-charge fields used to identify a rejection with no retry window.
 *
 * Declared locally instead of importing `ChargeSnapshot` from `@repo/payments`,
 * so the predicate stays outside the decision-reread guard (G17).
 */
export interface RejectedChargeTerminalInput {
    /** The provider charge as read for the fact being recorded. */
    readonly charge: {
        /** Provider record kind; only `'charge'` records can close a payment. */
        readonly purpose: string;
        /** Provider status of the charge, e.g. `'rejected'`, `'pending'`, `'approved'`. */
        readonly status: string;
        /** End of the provider retry window; `null` on the signup charge record (RC-7). */
        readonly expiresAt: string | null;
    };
}

/**
 * HOS-1734: the signup charge record has no `expire_date` (RC-7). A rejected
 * cycle with a retry window is retried by the provider under the same id (RP8/GR-1)
 * and remains open for P2 to close when that window expires.
 */
export function isRejectedWithoutRetryWindow(input: RejectedChargeTerminalInput): boolean {
    return (
        input.charge.purpose === 'charge' &&
        input.charge.status === 'rejected' &&
        input.charge.expiresAt === null
    );
}
