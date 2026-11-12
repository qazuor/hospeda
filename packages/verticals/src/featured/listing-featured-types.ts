import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import type { PlanCatalogReader } from '../plan-catalog/catalog-reader';
import type { PublicationAfterCommit, PublicationVertical } from '../publication/publication-types';

/** One listing of the owner in the vertical, with its stored featured flag. */
export interface ListingFeaturedRow {
    readonly id: string;
    readonly featured: boolean;
}

/** Writes of the listing featured sync, bound to the caller's transaction. */
export interface ListingFeaturedTransaction {
    /** Every non-deleted listing of the owner in the vertical, any publication status. */
    listOwnerListings(args: {
        readonly vertical: PublicationVertical;
        readonly ownerId: string;
    }): Promise<readonly ListingFeaturedRow[]>;
    /** Compare-and-set of the flag; false means it was already `to` or the row is gone. */
    setFeatured(args: {
        readonly vertical: PublicationVertical;
        readonly listingId: string;
        readonly from: boolean;
        readonly to: boolean;
    }): Promise<boolean>;
}

/** Lock boundary using the same `(user, vertical)` key as publication transitions. */
export interface ListingFeaturedUnitOfWork {
    /** Runs work atomically while holding the owner and vertical lock. */
    runLocked<T>(
        args: { readonly userId: string; readonly vertical: PublicationVertical },
        work: (tx: ListingFeaturedTransaction) => Promise<T>
    ): Promise<T>;
}

/** Ports required to synchronize listing featured flags from live billing coverage. */
export interface ListingFeaturedPorts {
    readonly billing: Pick<BillingForVerticals, 'coverage'>;
    readonly reader: Pick<PlanCatalogReader, 'findAddonVersionEffects'>;
    readonly unitOfWork: ListingFeaturedUnitOfWork;
    readonly afterCommit: Pick<PublicationAfterCommit, 'revalidate'>;
}

/** Lists of listing ids whose featured flag changed. */
export interface ListingFeaturedSyncResult {
    readonly featuredOn: readonly string[];
    readonly featuredOff: readonly string[];
}
