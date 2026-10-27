import { VerticalDeadlineValuesSchema } from '@repo/schemas';
import { type SQL, sql } from 'drizzle-orm';
import type { DrizzleClient } from '../../types.ts';
import type { ListingVertical } from './listing-publication.model.ts';

const TABLES: Record<ListingVertical, string> = {
    accommodation: 'accommodations',
    venue: 'gastronomies',
    experience: 'experiences'
};

/** Reads the latest owner-created or owner-edited event for this listing. */
export async function readLastOwnerActAt(args: {
    readonly tx: DrizzleClient;
    readonly vertical: ListingVertical;
    readonly listingId: string;
}): Promise<Date | null> {
    const result = await args.tx.execute(sql<{ occurredAt: Date | null }>`
        SELECT max(occurred_at) AS "occurredAt"
        FROM domain_event
        WHERE entity_type = ${args.vertical}
          AND entity_id = ${args.listingId}
          AND actor_type = 'owner'
          AND event_type IN ('listing.created', 'listing.edited')`);
    const occurredAt = result.rows[0]?.occurredAt;
    return occurredAt === null || occurredAt === undefined ? null : new Date(String(occurredAt));
}

/** Reads plazo 4 from the immutable deadline version used by the listing. */
export async function readRetentionNoticeDeadlines(args: {
    readonly tx: DrizzleClient;
    readonly deadlinesVersion: number;
}): Promise<{ readonly beforeArchiveDays: number; readonly beforeDeletionDays: number }> {
    const result = await args.tx.execute(
        sql<{
            values: unknown;
        }>`SELECT "values" FROM vertical_deadline_version WHERE version = ${args.deadlinesVersion} LIMIT 1`
    );
    const raw = result.rows[0]?.values;
    const parsed = VerticalDeadlineValuesSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`Invalid deadline version ${args.deadlinesVersion}`);
    return {
        beforeArchiveDays: parsed.data['4'].beforeArchiveDays,
        beforeDeletionDays: parsed.data['4'].beforeDeletionDays
    };
}

/** Cursor used by the two retention-pass prefilter populations. */
export interface RetentionScheduleCursor {
    readonly vertical: ListingVertical;
    readonly listingId: string;
}

type RetentionScheduleCandidate = {
    readonly vertical: ListingVertical;
    readonly listingId: string;
    readonly ownerId: string;
};

async function listScheduleCandidates(args: {
    readonly tx: DrizzleClient;
    readonly now: Date;
    readonly after: RetentionScheduleCursor | null;
    readonly limit: number;
    readonly predicate: () => SQL;
}): Promise<{
    readonly items: readonly RetentionScheduleCandidate[];
    readonly next: RetentionScheduleCursor | null;
}> {
    const branches = Object.entries(TABLES).map(
        ([vertical, name]) => sql`
        SELECT ${vertical}::text AS vertical, l.id::text AS "listingId", l.owner_id::text AS "ownerId"
        FROM ${sql.identifier(name)} l LEFT JOIN vertical_deadline_version v ON v.version = l.deadlines_version
        WHERE l.deleted_at IS NULL AND (${args.predicate()})`
    );
    const union = sql.join(branches, sql` UNION ALL `);
    const result = await args.tx.execute(sql<{
        vertical: string;
        listingId: string;
        ownerId: string;
    }>`
        SELECT * FROM (${union}) candidates
        WHERE ${args.after === null ? sql`true` : sql`(vertical, "listingId") > (${args.after.vertical}, ${args.after.listingId})`}
        ORDER BY vertical, "listingId" LIMIT ${args.limit + 1}`);
    const rows = result.rows.slice(0, args.limit).map((row) => ({
        vertical: row.vertical as ListingVertical,
        listingId: String(row.listingId),
        ownerId: String(row.ownerId)
    }));
    const last = rows.at(-1);
    return {
        items: rows,
        next:
            result.rows.length > args.limit && last
                ? { vertical: last.vertical, listingId: last.listingId }
                : null
    };
}

/** Superset prefilter: selects listings to inspect, never which ones are notified. */
export function listRetentionNoticeCandidates(args: {
    readonly tx: DrizzleClient;
    readonly now: Date;
    readonly after: RetentionScheduleCursor | null;
    readonly limit: number;
}) {
    return listScheduleCandidates({
        ...args,
        predicate: () => sql`(v.version IS NULL OR
          (l.publication_status IN ('PUBLISHED','UNPUBLISHED_BY_BILLING') AND
           l.inactive_since + make_interval(days => (v.values->'1'->>'days')::int - (v.values->'4'->>'beforeArchiveDays')::int) <= ${args.now}) OR
          (l.publication_status = 'DRAFT' AND
           (l.inactive_since AT TIME ZONE 'UTC') + make_interval(months => (v.values->'3'->>'months')::int) - make_interval(days => (v.values->'4'->>'beforeArchiveDays')::int)
             <= (${args.now} AT TIME ZONE 'UTC')) OR
          (l.publication_status = 'ARCHIVED' AND
           l.inactive_since + make_interval(days => (v.values->'2'->>'days')::int - (v.values->'4'->>'beforeDeletionDays')::int) <= ${args.now}))`
    });
}

/** Superset prefilter for PB9: selects archived listings to inspect, never which are purged. */
export function listPurgeCandidates(args: {
    readonly tx: DrizzleClient;
    readonly now: Date;
    readonly after: RetentionScheduleCursor | null;
    readonly limit: number;
}) {
    return listScheduleCandidates({
        ...args,
        predicate: () => sql`(l.publication_status = 'ARCHIVED' AND
          (v.version IS NULL OR l.inactive_since + make_interval(days => (v.values->'2'->>'days')::int) <= ${args.now}))`
    });
}

export const listingRetentionScheduleModel = {
    readLastOwnerActAt,
    readRetentionNoticeDeadlines,
    listRetentionNoticeCandidates,
    listPurgeCandidates
};
