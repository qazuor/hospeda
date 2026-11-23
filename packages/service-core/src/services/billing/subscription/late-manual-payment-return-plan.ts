import { VerticalEnum } from '@repo/schemas';

export {
    type ListingReturnFact,
    type ListingReturnItem,
    type ListingReturnOutcome,
    planListingReturn
} from '@repo/verticals';

/**
 * Pure planners behind the MP4 confirmation (B13a fila 10-bis, HOS-1640): what the
 * S7 reactivation brings back and what it does not, per vertical, and the other three
 * S7 effects. They take facts already read and decide nothing by themselves that the
 * real path does not decide: listing return is `planListingReturn` from `@repo/verticals`,
 * which composes the rules `recalculateCoverage` (PB7) applies when the reactivation's
 * `ADDED` notice reaches the coverage reconciler, and is pinned to it by a parity test.
 */

/** The listing verticals that share the publication machine. */
const LISTING_VERTICALS: ReadonlySet<string> = new Set([
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
]);

/** What the reactivation brings back for a partner. */
export type PartnerReturnOutcome =
    /** The plan grants `partner_public_page` and the partner is not revoked. */
    | 'GOLD_PAGE_RETURNS'
    /** The plan grants carousel presence only (silver): no page comes back. */
    | 'CAROUSEL_RETURNS'
    /** `partner.revokedAt` is set: its page answers 410 and the payment does not clear it. */
    | 'REVOKED'
    /** The account has no partner row. */
    | 'NO_PARTNER'
    /** The plan grants no partner presence at all. */
    | 'NO_PRESENCE';

/**
 * Decides what comes back for a partner subscription.
 *
 * @param input.partner - The account's partner row, or null
 * @param input.grantsPublicPage - Whether the plan version grants `partner_public_page`
 * @param input.grantsCarousel - Whether it grants `partner_carousel_presence`
 * @returns The partner outcome
 */
export function planPartnerReturn(input: {
    readonly partner: { readonly revokedAt: Date | null } | null;
    readonly grantsPublicPage: boolean;
    readonly grantsCarousel: boolean;
}): PartnerReturnOutcome {
    if (!input.partner) return 'NO_PARTNER';
    if (input.partner.revokedAt) return 'REVOKED';
    if (input.grantsPublicPage) return 'GOLD_PAGE_RETURNS';
    return input.grantsCarousel ? 'CAROUSEL_RETURNS' : 'NO_PRESENCE';
}

/** Which presence branch of fila 10-bis a vertical takes. */
export type ReturnPresenceKind = 'LISTINGS' | 'PARTNER' | 'NONE';

/**
 * Maps a subscription vertical to its presence branch: listings (a), Partner (b), or
 * none (a vertical with no public presence, such as Tourist). The commercial agreement
 * branch (c, HOS-2211) has no code yet, so it has no kind.
 *
 * @param input.vertical - The subscription's vertical
 * @returns The presence kind
 */
export function returnPresenceKind(input: {
    readonly vertical: string | null;
}): ReturnPresenceKind {
    if (input.vertical && LISTING_VERTICALS.has(input.vertical)) return 'LISTINGS';
    return input.vertical === VerticalEnum.PARTNER ? 'PARTNER' : 'NONE';
}

/** One paused complement S33 selects on return. */
export interface PausedComplementFact {
    readonly complementSubscriptionId: string;
    readonly resumableAtProvider: boolean;
}

/** The other three S7 effects, as the confirmation states them. */
export interface S7SideEffects {
    /** S33: paused recurring complements resumed (card with provider link) or skipped. */
    readonly complements: {
        readonly resumed: readonly string[];
        readonly skipped: readonly string[];
    };
    /** The inherited Tourist VIP cancellation (`:359`). */
    readonly touristVip: { readonly cancels: boolean; readonly subscriptionIds: readonly string[] };
    /** The overdue scheduled plan change S38 applies (`:317`), or null. */
    readonly scheduledChange: { readonly effectiveAt: Date } | null;
}

/**
 * Builds the three S7 side effects from facts already read.
 *
 * @param input.pausedComplements - The S33 selection (`RESUME`, `PAUSED`)
 * @param input.inheritsTouristVip - Whether the account inherits Tourist VIP once ACTIVE
 * @param input.cancellableTouristVipIds - Paid Tourist VIP rows the clause would cancel
 * @param input.dueScheduledChange - The queued change whose date already passed
 * @returns The effects
 */
export function planS7SideEffects(input: {
    readonly pausedComplements: readonly PausedComplementFact[];
    readonly inheritsTouristVip: boolean;
    readonly cancellableTouristVipIds: readonly string[];
    readonly dueScheduledChange: { readonly effectiveAt: Date } | null;
}): S7SideEffects {
    const cancels = input.inheritsTouristVip && input.cancellableTouristVipIds.length > 0;
    return {
        complements: {
            resumed: input.pausedComplements
                .filter((complement) => complement.resumableAtProvider)
                .map((complement) => complement.complementSubscriptionId),
            skipped: input.pausedComplements
                .filter((complement) => !complement.resumableAtProvider)
                .map((complement) => complement.complementSubscriptionId)
        },
        touristVip: {
            cancels,
            subscriptionIds: cancels ? [...input.cancellableTouristVipIds] : []
        },
        scheduledChange: input.dueScheduledChange
            ? { effectiveAt: input.dueScheduledChange.effectiveAt }
            : null
    };
}
