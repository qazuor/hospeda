/**
 * The three preconditions of administrative action 24 (ACC:24), in the order of
 * the manual account closure (`NUCLEO/08` §1.3): first the charge (step 1), then
 * the listings and the partner presence (step 2). The account is step 3.
 */
export const ACCOUNT_CLOSURE_REJECTION_REASONS = [
    'ACCOUNT_CAN_STILL_BE_CHARGED',
    'ACCOUNT_HAS_LISTINGS',
    'ACCOUNT_HAS_PARTNER_PRESENCE'
] as const;

/** Machine-readable `error.reason` of a 409 refusal of action 24 (H11). */
export type AccountClosureRejectionReason = (typeof ACCOUNT_CLOSURE_REJECTION_REASONS)[number];

/** What action 24 re-reads, under its locks, before deciding. */
export interface AccountClosurePreconditions {
    /** `puedeCobrarle` (contract §4.1), the ONLY billing read of action 24. */
    readonly canCharge: boolean;
    /** Listings of the account with `deleted_at IS NULL` outside `PURGED` (H9). */
    readonly listingsNotPurged: number;
    /** Whether the account's live partner presence still holds content (H10). */
    readonly partnerPresenceWithContent: boolean;
}

/** The message of each refusal: which manual step is still missing. */
export const ACCOUNT_CLOSURE_REJECTION_MESSAGES: Readonly<
    Record<AccountClosureRejectionReason, string>
> = {
    ACCOUNT_CAN_STILL_BE_CHARGED:
        'The account can still be charged: cancel its subscriptions first',
    ACCOUNT_HAS_LISTINGS: 'The account still has listings outside PURGED: purge them first',
    ACCOUNT_HAS_PARTNER_PRESENCE: 'The account still has a partner presence with content'
};

/**
 * Picks the refusal of action 24: the FIRST precondition that still blocks, in
 * the order of the manual closure (charge, listings, presence), or `null` when
 * the account can be closed.
 *
 * @param input - The three preconditions, as re-read under the locks.
 * @returns `{ reason }`, `null` when nothing blocks.
 */
export function selectAccountClosureRejection(input: AccountClosurePreconditions): {
    readonly reason: AccountClosureRejectionReason | null;
} {
    const blocks: Readonly<Record<AccountClosureRejectionReason, boolean>> = {
        ACCOUNT_CAN_STILL_BE_CHARGED: input.canCharge,
        ACCOUNT_HAS_LISTINGS: input.listingsNotPurged > 0,
        ACCOUNT_HAS_PARTNER_PRESENCE: input.partnerPresenceWithContent
    };
    const reason = ACCOUNT_CLOSURE_REJECTION_REASONS.find((candidate) => blocks[candidate]);
    return { reason: reason ?? null };
}
