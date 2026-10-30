/**
 * The verticals implementation of the listing entries of the contract's
 * inverse direction (contract §4.1; AC:V6:26, HOS-1483): `listingPurged`
 * (`fichaPurgada(ficha) → sí | no`) and `listing`
 * (`ficha(idDeFicha) → { vertical, dueño, admiteDestaque }`).
 *
 * Every argument and every answer crosses the contract's schemas: an answer
 * that does not validate is not delivered (contract §6.1). `@repo/verticals`
 * does not import `@repo/db` in `src`, so the row reader enters as a port.
 */
import {
    type ListingArgs,
    ListingArgsSchema,
    type ListingPurgedResponse,
    ListingPurgedResponseSchema,
    type ListingResponse,
    ListingResponseSchema,
    type VerticalsForBilling
} from '@repo/billing-verticals-contract';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';

/** One non-deleted listing row with that id, as the reader returns it. */
export interface ListingContractReaderRow {
    readonly vertical: string;
    readonly ownerId: string;
    readonly publicationStatus: string;
}

/**
 * Reads every non-deleted listing row carrying an id across the listing
 * tables (`@repo/db`'s `listingContractModel` in production).
 */
export interface ListingContractReader {
    findListingsById(args: {
        readonly listingId: string;
    }): Promise<readonly ListingContractReaderRow[]>;
}

/** The listing part of {@link VerticalsForBilling}. */
export type ListingInverse = Pick<VerticalsForBilling, 'listing' | 'listingPurged'>;

/**
 * `ficha` was asked about a listing whose row does not exist (or is
 * soft-deleted). There is no safe default for the vertical and the owner, so
 * the query refuses instead of guessing (HOS-1483 I-1).
 */
export class ListingNotFoundError extends Error {
    readonly listingId: string;

    constructor(args: { readonly listingId: string }) {
        super(`listing ${args.listingId} does not exist`);
        this.name = 'ListingNotFoundError';
        this.listingId = args.listingId;
    }
}

/**
 * The same listing id was found in more than one listing table. The query
 * fails closed instead of picking one (HOS-1483 I-4).
 */
export class AmbiguousListingIdError extends Error {
    readonly listingId: string;
    readonly rowCount: number;

    constructor(args: { readonly listingId: string; readonly rowCount: number }) {
        super(`listing id ${args.listingId} matches ${args.rowCount} listing rows`);
        this.name = 'AmbiguousListingIdError';
        this.listingId = args.listingId;
        this.rowCount = args.rowCount;
    }
}

/**
 * `admiteDestaque`: whether a listing in each state accepts a `LISTING`
 * addon. Contract §4.1: «hoy es *ni `PURGED` ni `MODERATED`*», defined by
 * verticals, not by billing (HOS-1483 I-5). Exhaustive on purpose: a new
 * state does not compile until it is classified here.
 */
export const ACCEPTS_FEATURE: Readonly<Record<PublicationStatusEnum, boolean>> = {
    [PublicationStatusEnum.DRAFT]: true,
    [PublicationStatusEnum.PUBLISHED]: true,
    [PublicationStatusEnum.UNPUBLISHED_BY_BILLING]: true,
    [PublicationStatusEnum.ARCHIVED]: true,
    [PublicationStatusEnum.MODERATED]: false,
    [PublicationStatusEnum.PURGED]: false
};

/**
 * The canonical text form of a Postgres `uuid`. An id outside it cannot name a
 * row of the listing tables (the column is `uuid`), so it is answered as a row
 * that does not exist without querying (HOS-1483 I-3).
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A resolved listing row, with its vertical and state mapped to the enums. */
interface ResolvedListing {
    readonly vertical: VerticalEnum;
    readonly ownerId: string;
    readonly status: PublicationStatusEnum;
}

/** Maps a stored vertical to the enum; an unknown value fails closed (I-8). */
function toVertical(value: string): VerticalEnum {
    const vertical = Object.values(VerticalEnum).find((candidate) => candidate === value);
    if (!vertical) throw new Error(`Unexpected listing vertical: ${value}`);
    return vertical;
}

/** Maps a stored publication status to the enum; an unknown value fails closed (I-8). */
function toStatus(value: string): PublicationStatusEnum {
    const status = Object.values(PublicationStatusEnum).find((candidate) => candidate === value);
    if (!status) throw new Error(`Unexpected listing publication status: ${value}`);
    return status;
}

/**
 * Builds the listing entries of the contract's inverse direction over a
 * listing reader.
 *
 * @param args.reader - Reads listing rows by id (`listingContractModel` in production)
 * @returns `listing` and `listingPurged`
 */
export function createListingInverse(args: {
    readonly reader: ListingContractReader;
}): ListingInverse {
    const { reader } = args;

    /** The single live row of that id, or `null` when it does not exist. */
    const resolve = async (listingId: string): Promise<ResolvedListing | null> => {
        if (!UUID_PATTERN.test(listingId)) return null;
        const rows = await reader.findListingsById({ listingId });
        if (rows.length > 1) {
            throw new AmbiguousListingIdError({ listingId, rowCount: rows.length });
        }
        const row = rows[0];
        if (!row) return null;
        return {
            vertical: toVertical(row.vertical),
            ownerId: row.ownerId,
            status: toStatus(row.publicationStatus)
        };
    };

    return {
        /**
         * `fichaPurgada` (contract §4.1): yes when the listing is in `PURGED`
         * or its row does not exist, no in any other state (AC:V6:26).
         */
        async listingPurged(input: ListingArgs): Promise<ListingPurgedResponse> {
            const { listingId } = ListingArgsSchema.parse(input);
            const listing = await resolve(listingId);
            return ListingPurgedResponseSchema.parse({
                purged: listing === null || listing.status === PublicationStatusEnum.PURGED
            });
        },

        /**
         * `ficha` (contract §4.1): the vertical, the owner and whether the
         * listing accepts a feature — a yes or no, never the state (AC:V6:26).
         * A row that does not exist throws {@link ListingNotFoundError}.
         */
        async listing(input: ListingArgs): Promise<ListingResponse> {
            const { listingId } = ListingArgsSchema.parse(input);
            const listing = await resolve(listingId);
            if (!listing) throw new ListingNotFoundError({ listingId });
            return ListingResponseSchema.parse({
                vertical: listing.vertical,
                ownerId: listing.ownerId,
                acceptsFeature: ACCEPTS_FEATURE[listing.status]
            });
        }
    };
}
