import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { isRestorableArchiveOrigin, planRestoration } from '@repo/verticals';

/**
 * Pure planners behind the MP4 confirmation (B13a fila 10-bis, HOS-1640): what the
 * S7 reactivation brings back and what it does not, per vertical, and the other three
 * S7 effects. They take facts already read and decide nothing by themselves that the
 * real path does not decide: listing return reuses `isRestorableArchiveOrigin` and
 * `planRestoration` from `@repo/verticals`, the same rules `recalculateCoverage` (PB7)
 * applies when the reactivation's `ADDED` notice reaches the coverage reconciler.
 */

/** The listing verticals that share the publication machine. */
const LISTING_VERTICALS: ReadonlySet<string> = new Set([
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
]);

/** What happens to one listing when the reactivation's coverage comes back. */
export type ListingReturnOutcome =
    /** `UNPUBLISHED_BY_BILLING`, or archived from a public state (PB4), with a free slot (PB7). */
    | 'RETURNS'
    /** Would return, but the plan's quota leaves it out (PB7). */
    | 'NO_SLOT'
    /** Would return, but fails the publish completeness predicate (HOS-1744). */
    | 'INCOMPLETE'
    /** Archived from a draft or with no public origin (PB5): never returns on its own. */
    | 'ARCHIVED_DRAFT'
    /** Final: its content was deleted (PB9 day 180, or PB12 by its owner). */
    | 'PURGED'
    /** Taken down by an admin (PB10): only an admin lifts it. */
    | 'MODERATED'
    /** Already public: nothing changes. */
    | 'ALREADY_PUBLISHED'
    /** A draft: it was never public and stays a draft. */
    | 'DRAFT';

/** One listing as the planner needs it. */
export interface ListingReturnFact {
    readonly id: string;
    readonly name: string;
    readonly publicationStatus: PublicationStatusEnum;
    readonly createdAt: Date;
}

/** One listing in the preview. */
export interface ListingReturnItem {
    readonly id: string;
    readonly name: string;
    readonly publicationStatus: PublicationStatusEnum;
    readonly outcome: ListingReturnOutcome;
}

/**
 * Decides, per listing, whether PB7 brings it back when the row's coverage returns.
 *
 * @param input.listings - The owner's non-deleted listings of the vertical
 * @param input.archiveOrigins - Origin of each archived listing's latest archive transition
 * @param input.incompleteIds - Listings failing the publish completeness predicate
 * @param input.publishedAt - Latest manual publish instant per listing (return order)
 * @param input.limit - The plan's declared publication limit, or null when absent
 * @param input.publishedCount - Listings already published
 * @returns One item per listing, in input order
 */
export function planListingReturn(input: {
    readonly listings: readonly ListingReturnFact[];
    readonly archiveOrigins: ReadonlyMap<string, PublicationStatusEnum>;
    readonly incompleteIds: ReadonlySet<string>;
    readonly publishedAt: ReadonlyMap<string, Date>;
    readonly limit: number | null;
    readonly publishedCount: number;
}): readonly ListingReturnItem[] {
    const fixed = new Map<string, ListingReturnOutcome>();
    const candidates: ListingReturnFact[] = [];
    for (const listing of input.listings) {
        const outcome = fixedOutcome({ listing, archiveOrigins: input.archiveOrigins });
        if (outcome) fixed.set(listing.id, outcome);
        else if (input.incompleteIds.has(listing.id)) fixed.set(listing.id, 'INCOMPLETE');
        else candidates.push(listing);
    }
    const available = input.limit === null ? null : input.limit - input.publishedCount;
    const plan = planRestoration({
        entries: candidates.map((listing) => ({
            id: listing.id,
            createdAt: listing.createdAt,
            publishedAt: input.publishedAt.get(listing.id) ?? null
        })),
        available
    });
    const restoring = new Set(plan.restoring.map(({ id }) => id));
    return input.listings.map((listing) => ({
        id: listing.id,
        name: listing.name,
        publicationStatus: listing.publicationStatus,
        outcome: fixed.get(listing.id) ?? (restoring.has(listing.id) ? 'RETURNS' : 'NO_SLOT')
    }));
}

function fixedOutcome(input: {
    readonly listing: ListingReturnFact;
    readonly archiveOrigins: ReadonlyMap<string, PublicationStatusEnum>;
}): ListingReturnOutcome | null {
    switch (input.listing.publicationStatus) {
        case PublicationStatusEnum.UNPUBLISHED_BY_BILLING:
            return null;
        case PublicationStatusEnum.ARCHIVED:
            return isRestorableArchiveOrigin({
                origin: input.archiveOrigins.get(input.listing.id)
            })
                ? null
                : 'ARCHIVED_DRAFT';
        case PublicationStatusEnum.PURGED:
            return 'PURGED';
        case PublicationStatusEnum.MODERATED:
            return 'MODERATED';
        case PublicationStatusEnum.PUBLISHED:
            return 'ALREADY_PUBLISHED';
        case PublicationStatusEnum.DRAFT:
            return 'DRAFT';
    }
}

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
