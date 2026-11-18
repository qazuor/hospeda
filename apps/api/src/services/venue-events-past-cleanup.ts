/**
 * Cleanup of past one-off venue events (HOS-2254, owner decision 2026-11-16).
 *
 * Hard-deletes the `once` agenda entries whose END passed more than
 * {@link VENUE_EVENT_PAST_RETENTION_DAYS} days ago, so owners never have to
 * clear their past events by hand and the table does not grow without bound.
 *
 * ## What it touches, and what it never does
 *
 * - Only `recurrence = 'once'` rows. A `weekly` entry has no end and is never
 *   selected: the SQL pre-filter excludes it and `isVenueEventPast` says "never
 *   past" for it as a second, independent line.
 * - "Past by 60 days" is NOT re-implemented here: every candidate is judged by
 *   `isVenueEventPast({ olderThanDays })` from `@repo/schemas`, the single
 *   definition of an event's end (venue zone, midnight crossing, no-end grace).
 *   The SQL `date <=` predicate is only a conservative superset used to keep the
 *   scan small; it can never select something the function would keep.
 * - References to an event are respected by the database, not by this job:
 *   `venue_interaction.event_id` (HOS-2256) is `ON DELETE SET NULL`, so clicks
 *   survive without the event. Nothing else points at `venue_events` today.
 *
 * Idempotent (a second run finds nothing), batched, and a failure only skips a
 * run: the public read never depends on this job (it filters past events
 * itself).
 *
 * @module apps/api/services/venue-events-past-cleanup
 */

import { getDb, venueEvents } from '@repo/db';
import {
    getVenueEventZonedNow,
    isVenueEventPast,
    VENUE_EVENT_PAST_RETENTION_DAYS
} from '@repo/schemas';
import { and, asc, eq, gt, inArray, lte } from 'drizzle-orm';

/** Rows read and deleted per statement: bounded locks and memory. */
export const VENUE_EVENTS_CLEANUP_BATCH_SIZE = 500;

/** A stored one-off event, the fields the end rule reads. */
export interface PastEventCandidate {
    readonly id: string;
    readonly date: string | null;
    readonly startTime: string;
    readonly endTime: string | null;
}

/** Storage access, injectable so the selection rule is testable without a DB. */
export interface VenueEventsCleanupPorts {
    /** Next page of `once` rows with `date <= maxDate`, ascending by id, after `afterId`. */
    readonly readCandidates: (input: {
        readonly maxDate: string;
        readonly afterId: string | null;
        readonly limit: number;
    }) => Promise<readonly PastEventCandidate[]>;
    /** Hard-deletes the given ids; returns how many rows went away. */
    readonly deleteByIds: (ids: readonly string[]) => Promise<number>;
}

/** Input of {@link purgePastVenueEvents}. */
export interface PurgePastVenueEventsInput {
    /** Reference instant (injectable for tests). */
    readonly now?: Date;
    /** Rows per statement (injectable for tests). */
    readonly batchSize?: number;
    /** Storage access (defaults to Drizzle). */
    readonly ports?: VenueEventsCleanupPorts;
}

/** Output of {@link purgePastVenueEvents}. */
export interface PurgePastVenueEventsOutput {
    /** Rows deleted. */
    readonly deleted: number;
    /** Rows examined (a superset of `deleted`). */
    readonly scanned: number;
    /** Newest `date` the scan considered, `YYYY-MM-DD`. */
    readonly maxDate: string;
}

/** `YYYY-MM-DD` shifted by whole days, UTC arithmetic only. */
function shiftDay(input: { readonly date: string; readonly days: number }): string {
    const [year = 0, month = 1, day = 1] = input.date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day) + input.days * 86_400_000)
        .toISOString()
        .slice(0, 10);
}

/** Drizzle-backed storage access. */
export function createDrizzleCleanupPorts(): VenueEventsCleanupPorts {
    return {
        readCandidates: async ({ maxDate, afterId, limit }) => {
            const rows = await getDb()
                .select({
                    id: venueEvents.id,
                    date: venueEvents.date,
                    startTime: venueEvents.startTime,
                    endTime: venueEvents.endTime
                })
                .from(venueEvents)
                .where(
                    and(
                        eq(venueEvents.recurrence, 'once'),
                        lte(venueEvents.date, maxDate),
                        afterId ? gt(venueEvents.id, afterId) : undefined
                    )
                )
                .orderBy(asc(venueEvents.id))
                .limit(limit);
            return rows;
        },
        deleteByIds: async (ids) => {
            if (ids.length === 0) return 0;
            const deleted = await getDb()
                .delete(venueEvents)
                .where(inArray(venueEvents.id, [...ids]))
                .returning({ id: venueEvents.id });
            return deleted.length;
        }
    };
}

/**
 * Deletes the one-off events that ended more than the retention window ago.
 *
 * @param input - Optional reference instant, batch size and ports.
 * @returns Counts and the date bound used.
 */
export async function purgePastVenueEvents(
    input: PurgePastVenueEventsInput = {}
): Promise<PurgePastVenueEventsOutput> {
    const now = input.now ?? new Date();
    const batchSize = input.batchSize ?? VENUE_EVENTS_CLEANUP_BATCH_SIZE;
    const ports = input.ports ?? createDrizzleCleanupPorts();

    // An event ends on its `date` or the day after, so anything the function
    // would delete has `date <= today - retention`. Reading up to that day is a
    // superset; the function below makes the real decision.
    const maxDate = shiftDay({
        date: getVenueEventZonedNow({ now }).date,
        days: -VENUE_EVENT_PAST_RETENTION_DAYS
    });

    let afterId: string | null = null;
    let scanned = 0;
    let deleted = 0;
    for (;;) {
        const page = await ports.readCandidates({ maxDate, afterId, limit: batchSize });
        if (page.length === 0) break;
        scanned += page.length;
        afterId = page[page.length - 1]?.id ?? null;

        const expired = page.filter((row) =>
            isVenueEventPast({
                event: {
                    recurrence: 'once',
                    date: row.date,
                    // A Postgres `time` comes back as `HH:MM:SS`.
                    startTime: row.startTime.slice(0, 5),
                    endTime: row.endTime ? row.endTime.slice(0, 5) : null
                },
                now,
                olderThanDays: VENUE_EVENT_PAST_RETENTION_DAYS
            })
        );
        deleted += await ports.deleteByIds(expired.map((row) => row.id));
        if (page.length < batchSize) break;
    }

    return { deleted, scanned, maxDate };
}
