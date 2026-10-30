import type { PublicationVertical, PurgeAfterCommit } from './publication-types';

/** Stable monitor slug shared with the daily cron registration (AC:V6:30). */
export const REMOTE_DELETION_RETRY_JOB = 'listing-remote-deletion-retry';
/** Number of marked rows read per page. */
export const REMOTE_DELETION_RETRY_PAGE_SIZE = 200;

/** Keyset cursor of the marked media population, ordered by `(vertical, mediaId)`. */
export interface MarkedMediaCursor {
    readonly vertical: PublicationVertical;
    readonly mediaId: string;
}

/** One listing media row still marked for remote deletion by PB12. */
export interface MarkedMediaRow {
    readonly vertical: PublicationVertical;
    readonly mediaId: string;
    readonly publicId: string | null;
    readonly markedAt: Date;
}

/** One calendar connection still marked for remote revocation by PB12. */
export interface MarkedCalendarConnectionRow {
    readonly connectionId: string;
    readonly accommodationId: string;
    readonly provider: string;
    readonly markedAt: Date;
}

/** Ports used by the daily retry of PB12 remote deletions; both pages use keyset cursors. */
export interface RemoteDeletionRetryPorts {
    readonly pending: {
        listMarkedMedia(args: {
            readonly after: MarkedMediaCursor | null;
            readonly limit: number;
        }): Promise<{
            readonly items: readonly MarkedMediaRow[];
            readonly next: MarkedMediaCursor | null;
        }>;
        listMarkedCalendarConnections(args: {
            readonly after: string | null;
            readonly limit: number;
        }): Promise<{
            readonly items: readonly MarkedCalendarConnectionRow[];
            readonly next: string | null;
        }>;
    };
    /** The PB12 adapters: each removes the remote copy first and the marked row after it. */
    readonly remote: Pick<PurgeAfterCommit, 'deleteRemoteMedia' | 'revokeCalendarConnection'>;
    readonly monitor: { ping(args: { readonly job: string }): Promise<void> };
}

/** One row (or population read) that the run could not finish. */
export interface RemoteDeletionRetryFailure {
    readonly kind: 'media' | 'calendar' | 'population';
    readonly id: string | null;
    readonly vertical?: PublicationVertical;
    readonly error: unknown;
}

/** Result of one daily retry run. */
export interface RemoteDeletionRetrySummary {
    readonly mediaRead: number;
    readonly mediaDeleted: number;
    readonly calendarRead: number;
    readonly calendarDeleted: number;
    readonly failures: readonly RemoteDeletionRetryFailure[];
    /** Both populations were walked to the end; a row that failed is a failure, not an incomplete run. */
    readonly complete: boolean;
    readonly pinged: boolean;
}

/**
 * Retries every remote deletion PB12 left pending: each marked row is attempted once per run,
 * a failed row stays marked and is reported in `failures`, and a complete run pings the monitor.
 */
export async function runRemoteDeletionRetry(args: {
    readonly ports: RemoteDeletionRetryPorts;
}): Promise<RemoteDeletionRetrySummary> {
    const { pending, remote, monitor } = args.ports;
    let mediaRead = 0;
    let mediaDeleted = 0;
    let calendarRead = 0;
    let calendarDeleted = 0;
    const failures: RemoteDeletionRetryFailure[] = [];
    let complete = true;

    try {
        let after: MarkedMediaCursor | null = null;
        do {
            const page = await pending.listMarkedMedia({
                after,
                limit: REMOTE_DELETION_RETRY_PAGE_SIZE
            });
            for (const row of page.items) {
                mediaRead += 1;
                try {
                    await remote.deleteRemoteMedia({
                        vertical: row.vertical,
                        mediaId: row.mediaId,
                        publicId: row.publicId
                    });
                    mediaDeleted += 1;
                } catch (error) {
                    failures.push({
                        kind: 'media',
                        id: row.mediaId,
                        vertical: row.vertical,
                        error
                    });
                }
            }
            after = page.next;
        } while (after !== null);

        let calendarAfter: string | null = null;
        do {
            const page = await pending.listMarkedCalendarConnections({
                after: calendarAfter,
                limit: REMOTE_DELETION_RETRY_PAGE_SIZE
            });
            for (const row of page.items) {
                calendarRead += 1;
                try {
                    await remote.revokeCalendarConnection({
                        connectionId: row.connectionId,
                        accommodationId: row.accommodationId,
                        provider: row.provider
                    });
                    calendarDeleted += 1;
                } catch (error) {
                    failures.push({ kind: 'calendar', id: row.connectionId, error });
                }
            }
            calendarAfter = page.next;
        } while (calendarAfter !== null);
    } catch (error) {
        complete = false;
        failures.push({ kind: 'population', id: null, error });
    }

    let pinged = false;
    if (complete) {
        try {
            await monitor.ping({ job: REMOTE_DELETION_RETRY_JOB });
            pinged = true;
        } catch {
            pinged = false;
        }
    }
    return { mediaRead, mediaDeleted, calendarRead, calendarDeleted, failures, complete, pinged };
}
