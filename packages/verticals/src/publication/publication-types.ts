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

/** Deadline snapshot and clock fields persisted on a listing. */
export interface RetentionListing extends PublicationListing {
    readonly deletionAnnouncedAt: Date | null;
    readonly deadlinesVersion: number;
    readonly deadlines: {
        readonly archiveAfterDays: number;
        readonly deletionAfterDays: number;
        readonly draftArchiveMonths: number;
    };
}

/** The origin recorded when an admin takes a listing down. */
export interface PublicationModerationOrigin {
    readonly from: PublicationStatusEnum;
    readonly archiveOrigin: PublicationStatusEnum | null;
}

/** The open owner fix request, if one exists. */
export interface PublicationFixRequest {
    readonly id: string;
    readonly reason: string;
    readonly suggestedDate: string | null;
    readonly openedAt: Date;
    readonly openedById: string;
    readonly ownerReportedFixedAt: Date | null;
}

/** Billing reads needed to decide whether an inactivity clock may advance. */
export type RetentionBilling = Pick<BillingForVerticals, 'coverage' | 'retentionStopped'>;

/** All publication reads and writes happen in a locked transaction. */
export interface PublicationTransaction extends TrialStartTransaction {
    /** HOS-1744: composition evaluates candidates with the same completeness predicate as PB1. */
    readIncompleteListingIds(args: {
        readonly vertical: PublicationVertical;
        readonly listingIds: readonly string[];
    }): Promise<ReadonlyMap<string, readonly string[]>>;
    /** Deletes listing-owned content and records remote rows for post-commit deletion. */
    purgeListingContent(args: {
        readonly vertical: PublicationVertical;
        readonly listingId: string;
        readonly at: Date;
    }): Promise<{
        readonly markedMedia: readonly {
            readonly mediaId: string;
            readonly publicId: string | null;
        }[];
        readonly markedCalendar: readonly {
            readonly connectionId: string;
            readonly provider: string;
        }[];
        readonly closedAlerts: readonly {
            readonly alertId: string;
            readonly touristUserId: string;
        }[];
        readonly closedFixRequestId: string | null;
    }>;
    /** Enqueues the restitution notice in the same transaction as PB3/PB7. */
    enqueueRestitutionNotice(args: {
        readonly vertical: PublicationVertical;
        readonly ownerId: string;
        readonly payload: ListingRestitutionPayload;
        readonly correlationId: string;
    }): Promise<void>;
    /** Enqueues an arbitrary listing notice in the caller's transaction. */
    enqueueListingNotice(args: {
        readonly template: string;
        readonly recipientUserId: string;
        readonly payload: Readonly<Record<string, unknown>>;
        readonly correlationId: string;
        readonly occurrenceKey: string;
    }): Promise<void>;
    /** Reads the origin of the latest transition into MODERATED. */
    readModerationOrigin(args: {
        readonly vertical: PublicationVertical;
        readonly listingId: string;
    }): Promise<PublicationModerationOrigin | null>;
    /** Reads a listing's currently open fix request. */
    readOpenFixRequest(args: {
        readonly vertical: PublicationVertical;
        readonly listingId: string;
    }): Promise<PublicationFixRequest | null>;
    /** Opens a fix request unless one is already open. */
    openFixRequest(args: {
        readonly vertical: PublicationVertical;
        readonly listingId: string;
        readonly reason: string;
        readonly suggestedDate: string | null;
        readonly openedById: string;
        readonly openedAt: Date;
    }): Promise<
        | { readonly opened: true; readonly id: string }
        | { readonly opened: false; readonly reason: 'ALREADY_OPEN' }
    >;
    /** Closes a listing's open fix request. */
    closeOpenFixRequest(args: {
        readonly vertical: PublicationVertical;
        readonly listingId: string;
        readonly closedAt: Date;
        readonly closedById: string | null;
    }): Promise<{ readonly id: string } | null>;
    /** Writes an audit event for opening or closing a fix request. */
    insertFixRequestEvent(args: {
        readonly vertical: PublicationVertical;
        readonly listingId: string;
        readonly eventType: 'listing.fix_request_opened' | 'listing.fix_request_closed';
        readonly fixRequestId: string;
        readonly actorType: 'owner' | 'admin';
        readonly actorId: string;
        readonly reason: string;
        readonly correlationId: string;
        readonly occurredAt?: Date;
    }): Promise<void>;
    readListing(args: {
        readonly vertical: PublicationVertical;
        readonly listingId: string;
    }): Promise<PublicationListing | null>;
    readRetentionListing(args: {
        readonly vertical: PublicationVertical;
        readonly listingId: string;
    }): Promise<RetentionListing | null>;
    /** Reads the latest owner act on the listing in V9a's domain_event register, or null when absent. */
    readLastOwnerActAt(args: {
        readonly vertical: PublicationVertical;
        readonly listingId: string;
    }): Promise<Date | null>;
    /** Reads plazo 4's two values from the deadline snapshot stored by the listing. */
    readRetentionNoticeDeadlines(args: {
        readonly deadlinesVersion: number;
    }): Promise<{ readonly beforeArchiveDays: number; readonly beforeDeletionDays: number }>;
    /** Enqueues a SCHEDULE notice keyed by buildScheduleOccurrence, never by event. */
    enqueueRetentionNotice(args: {
        readonly template: string;
        readonly recipientUserId: string;
        readonly listingId: string;
        readonly milestone: string;
        readonly targetDate: string;
        readonly payload: Readonly<Record<string, unknown>>;
        readonly correlationId: string;
    }): Promise<{ readonly enqueued: boolean }>;
    readArchiveOrigins(args: {
        readonly vertical: PublicationVertical;
        readonly listingIds: readonly string[];
    }): Promise<ReadonlyMap<string, PublicationStatusEnum>>;
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
        readonly deletionAnnouncedAt?: Date;
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
        readonly actorType: 'owner' | 'job' | 'admin';
        readonly actorId?: string;
        readonly reason?: string | null;
        readonly archiveOrigin?: PublicationStatusEnum;
        readonly correlationId: string;
        readonly occurredAt?: Date;
        readonly deletionAnnouncedAt?: Date;
        readonly oldDeletionAnnouncedAt?: Date | null;
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

/** PB12-only remote effects; kept separate so existing after-commit doubles remain stable. */
export interface PurgeAfterCommit extends PublicationAfterCommit {
    emitListingPurged(event: { readonly listingId: string }): Promise<void>;
    deleteRemoteMedia(args: {
        readonly vertical: PublicationVertical;
        readonly mediaId: string;
        readonly publicId: string | null;
    }): Promise<void>;
    revokeCalendarConnection(args: {
        readonly connectionId: string;
        readonly accommodationId: string;
        readonly provider: string;
    }): Promise<void>;
}

/** The billing push and two remote deletions PB9 runs after commit (AC:V9b:3, AC:V9b:8); PB9 does not revalidate (H8). */
export type RetentionAfterCommit = Pick<
    PurgeAfterCommit,
    'emitListingPurged' | 'deleteRemoteMedia' | 'revokeCalendarConnection'
>;

/** Each effect reports failure without changing a committed result. */
export type PostCommitWarning =
    | 'COVERAGE_NOTICE_FAILED'
    | 'CACHE_INVALIDATION_FAILED'
    | 'REVALIDATION_FAILED'
    | 'REMOTE_DELETION_FAILED'
    | 'PURGE_NOTICE_FAILED';

/** Live coverage port shared by PB1 and coverage recalculation. */
export type PublicationBilling = Pick<BillingForVerticals, 'coverage'>;
