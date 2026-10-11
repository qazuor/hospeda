import type { BillingForVerticals, CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { LIMIT_KEY_DEFINITIONS, type PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import type { TrialStartTransaction } from '../trial/trial-start-types';
import type { ListingRestitutionPayload } from './publication-notices';

/** The verticals whose listings share the publication machine. */
export type PublicationVertical =
    | VerticalEnum.ACCOMMODATION
    | VerticalEnum.GASTRONOMY
    | VerticalEnum.EXPERIENCE;

/** Listing counts are resolved from these catalog keys in the same order as the catalog. */
export const PUBLICATION_LIMIT_KEYS: Readonly<Record<PublicationVertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: publicationKey(0),
    [VerticalEnum.GASTRONOMY]: publicationKey(1),
    [VerticalEnum.EXPERIENCE]: publicationKey(2)
};

function publicationKey(index: number): string {
    const definition = LIMIT_KEY_DEFINITIONS[index];
    if (!definition) throw new Error(`publication limit key at ${index} is missing`);
    return definition.key;
}

/** The fields needed by publication transitions. */
export interface PublicationListing {
    readonly id: string;
    readonly ownerId: string;
    readonly publicationStatus: PublicationStatusEnum;
    readonly createdAt: Date;
    readonly inactiveSince: Date;
}

/** All publication reads and writes happen in a locked transaction. */
export interface PublicationTransaction extends TrialStartTransaction {
    /** Enqueues the restitution notice in the same transaction as PB3/PB7. */
    enqueueRestitutionNotice(args: {
        readonly vertical: PublicationVertical;
        readonly ownerId: string;
        readonly payload: ListingRestitutionPayload;
        readonly correlationId: string;
    }): Promise<void>;
    readListing(args: {
        readonly vertical: PublicationVertical;
        readonly listingId: string;
    }): Promise<PublicationListing | null>;
    countPublished(args: {
        readonly vertical: PublicationVertical;
        readonly ownerId: string;
    }): Promise<number>;
    listByOwner(args: {
        readonly vertical: PublicationVertical;
        readonly ownerId: string;
    }): Promise<readonly PublicationListing[]>;
    readPublicationInstants(args: {
        readonly vertical: PublicationVertical;
        readonly listingIds: readonly string[];
    }): Promise<ReadonlyMap<string, Date>>;
    readDeclaredPublishLimit(args: {
        readonly userId: string;
        readonly vertical: PublicationVertical;
    }): Promise<number | null>;
    readPublishLimit(args: {
        readonly userId: string;
        readonly vertical: PublicationVertical;
    }): Promise<number>;
    setPublicationStatus(args: {
        readonly vertical: PublicationVertical;
        readonly listingId: string;
        readonly from: PublicationStatusEnum;
        readonly to: PublicationStatusEnum;
        readonly inactiveSince?: Date;
        readonly actorId?: string;
    }): Promise<boolean>;
    stampInactiveSince(args: {
        readonly vertical: PublicationVertical;
        readonly listingIds: readonly string[];
        readonly at: Date;
    }): Promise<void>;
    insertStatusChangedEvent(args: {
        readonly vertical: PublicationVertical;
        readonly listingId: string;
        readonly from: PublicationStatusEnum;
        readonly to: PublicationStatusEnum;
        readonly oldInactiveSince?: Date;
        readonly inactiveSince?: Date;
        readonly actorType: 'owner' | 'job';
        readonly actorId?: string;
        readonly correlationId: string;
        readonly occurredAt?: Date;
    }): Promise<void>;
}

/** Transaction and lock boundary shared by all PB transitions. */
export interface PublicationUnitOfWork {
    runLocked<T>(
        args: { readonly userId: string; readonly vertical: PublicationVertical },
        work: (tx: PublicationTransaction) => Promise<T>
    ): Promise<T>;
}

/** Effects that run only after a committed transition. */
export interface PublicationAfterCommit {
    emitCoverageChanged(event: CoverageChangedEvent): Promise<void>;
    invalidateUser(args: { readonly userId: string }): Promise<void>;
    revalidate(args: {
        readonly vertical: PublicationVertical;
        readonly listingIds: readonly string[];
    }): Promise<void>;
}

/** Each effect reports failure without changing a committed result. */
export type PostCommitWarning =
    | 'COVERAGE_NOTICE_FAILED'
    | 'CACHE_INVALIDATION_FAILED'
    | 'REVALIDATION_FAILED';

/** Live coverage port shared by PB1 and coverage recalculation. */
export type PublicationBilling = Pick<BillingForVerticals, 'coverage'>;
