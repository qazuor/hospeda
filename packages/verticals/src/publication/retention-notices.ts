import { marketCalendarDay } from '../quota/market-time';
import type { PublicationVertical } from './publication-types';

/** AC:V9b:10 and the retention row of outbox §6: pre-archive email. */
export const LISTING_RETENTION_BEFORE_ARCHIVE_TEMPLATE =
    'verticals.listing-retention-before-archive';
/** AC:V9b:10 and the retention row of outbox §6: pre-deletion email. */
export const LISTING_RETENTION_BEFORE_DELETION_TEMPLATE =
    'verticals.listing-retention-before-deletion';
/** AC:V9b:10 and the retention row of outbox §6: schedule milestones. */
export const RETENTION_NOTICE_MILESTONES = {
    BEFORE_ARCHIVE: 'ret:-90d',
    BEFORE_DELETION: 'ret:-180d'
} as const;

/** Payload sent for the archive deadline (AC:V9b:10, outbox §6). */
export type ListingRetentionBeforeArchivePayload = {
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly transition: 'PB4' | 'PB5';
    readonly archiveAt: string;
};
/** Payload sent for the deletion deadline (AC:V9b:10, outbox §6). */
export type ListingRetentionBeforeDeletionPayload = {
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly deletionAt: string;
};

/** Builds an ISO payload (AC:V9b:10, outbox §6). */
export function buildListingRetentionBeforeArchivePayload(args: {
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly transition: 'PB4' | 'PB5';
    readonly archiveAt: Date;
}): ListingRetentionBeforeArchivePayload {
    return {
        vertical: args.vertical,
        listingId: args.listingId,
        transition: args.transition,
        archiveAt: args.archiveAt.toISOString()
    };
}
/** Builds an ISO payload (AC:V9b:10, outbox §6). */
export function buildListingRetentionBeforeDeletionPayload(args: {
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly deletionAt: Date;
}): ListingRetentionBeforeDeletionPayload {
    return {
        vertical: args.vertical,
        listingId: args.listingId,
        deletionAt: args.deletionAt.toISOString()
    };
}
/** Returns the market-calendar target day (AC:V9b:10, outbox §6). */
export function retentionNoticeTargetDay(args: { readonly at: Date }): string {
    const { year, month, day } = marketCalendarDay(args.at);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
/** Subtracts plazo 4 exactly in milliseconds (AC:V9b:10, outbox §6). */
export function retentionNoticeAt(args: {
    readonly targetAt: Date;
    readonly daysBefore: number;
}): Date {
    return new Date(args.targetAt.getTime() - args.daysBefore * 86_400_000);
}
