import { PublicationStatusEnum } from '@repo/schemas';
import {
    isRestorableArchiveOrigin,
    planRestoration,
    type RestorationPlace,
    selectSurplusToLower
} from './publication-order';

/*
 * The listing half of the MP4 confirmation preview (B13a fila 10-bis, HOS-1640): what the
 * coverage reconciler (`recalculateCoverage`, PB7) does to each of an owner's listings
 * when a reactivated row's coverage comes back. Pure and read-only; it composes the same
 * rules the reconciler runs — the archive origin rule, the surplus order, the restoration
 * order and the HOS-1810 one-address refusal — so a parity test can pin the two together.
 */

/** What happens to one listing when the reactivation's coverage comes back. */
export type ListingReturnOutcome =
    /** `UNPUBLISHED_BY_BILLING`, or archived from a public state (PB4), with a free slot (PB7). */
    | 'RETURNS'
    /** Would return, but the plan's quota leaves it out (PB7). */
    | 'NO_SLOT'
    /**
     * Would return, but another listing of the owner is (or comes back) public at the same
     * place: the HOS-1810 one-address rule refuses the write, and the slot goes on.
     */
    | 'LOCATION_CONFLICT'
    /** Would return, but fails the publish completeness predicate (HOS-1744). */
    | 'INCOMPLETE'
    /** Archived from a draft or with no public origin (PB5): never returns on its own. */
    | 'ARCHIVED_DRAFT'
    /** Final: its content was deleted (PB9 day 180, or PB12 by its owner). */
    | 'PURGED'
    /** Taken down by an admin (PB10): only an admin lifts it. */
    | 'MODERATED'
    /** Already public and within the quota: nothing changes. */
    | 'ALREADY_PUBLISHED'
    /** Public, but beyond the returning plan's quota: PB7 lowers it (surplus, V6 order). */
    | 'LOWERED_BY_SURPLUS'
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
 * @param input.publishedAt - Latest manual publish instant per listing (return and surplus order)
 * @param input.limit - The plan's declared publication limit, or null when absent
 * @param input.places - HOS-1810 place of each listing, for the verticals the rule covers
 * @returns One item per listing, in input order
 */
export function planListingReturn(input: {
    readonly listings: readonly ListingReturnFact[];
    readonly archiveOrigins: ReadonlyMap<string, PublicationStatusEnum>;
    readonly incompleteIds: ReadonlySet<string>;
    readonly publishedAt: ReadonlyMap<string, Date>;
    readonly limit: number | null;
    readonly places?: ReadonlyMap<string, RestorationPlace>;
}): readonly ListingReturnItem[] {
    const fixed = new Map<string, ListingReturnOutcome>();
    const candidates: ListingReturnFact[] = [];
    for (const listing of input.listings) {
        const outcome = fixedOutcome({ listing, archiveOrigins: input.archiveOrigins });
        if (outcome) fixed.set(listing.id, outcome);
        else if (input.incompleteIds.has(listing.id)) fixed.set(listing.id, 'INCOMPLETE');
        else candidates.push(listing);
    }
    const entry = (listing: ListingReturnFact) => ({
        id: listing.id,
        createdAt: listing.createdAt,
        publishedAt: input.publishedAt.get(listing.id) ?? null
    });
    const published = input.listings.filter(
        (listing) => listing.publicationStatus === PublicationStatusEnum.PUBLISHED
    );
    // PB7 lowers the surplus first when the returning plan's quota is below what is public.
    const lowered =
        input.limit === null
            ? []
            : selectSurplusToLower({ published: published.map(entry), limit: input.limit });
    for (const { id } of lowered) fixed.set(id, 'LOWERED_BY_SURPLUS');
    const available =
        input.limit === null ? null : input.limit - (published.length - lowered.length);
    const loweredIds = new Set(lowered.map(({ id }) => id));
    const plan = planRestoration({
        entries: candidates.map(entry),
        available,
        ...(input.places ? { places: input.places } : {}),
        publishedIds: published.map(({ id }) => id).filter((id) => !loweredIds.has(id))
    });
    const restoring = new Set(plan.restoring.map(({ id }) => id));
    const blocked = new Set(plan.locationConflict.map(({ id }) => id));
    return input.listings.map((listing) => ({
        id: listing.id,
        name: listing.name,
        publicationStatus: listing.publicationStatus,
        outcome:
            fixed.get(listing.id) ??
            (restoring.has(listing.id)
                ? 'RETURNS'
                : blocked.has(listing.id)
                  ? 'LOCATION_CONFLICT'
                  : 'NO_SLOT')
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
