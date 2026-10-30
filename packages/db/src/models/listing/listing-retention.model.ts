import { type PublicationStatusEnum, VerticalDeadlineValuesSchema } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import type { DrizzleClient } from '../../types.ts';
import type { ListingVertical } from './listing-publication.model.ts';

const TABLES: Record<ListingVertical, string> = {
    accommodation: 'accommodations',
    venue: 'venues',
    experience: 'experiences'
};

/** A listing and the immutable deadline snapshot assigned to its clock. */
export interface RetentionListing {
    readonly id: string;
    readonly ownerId: string;
    readonly publicationStatus: PublicationStatusEnum;
    readonly createdAt: Date;
    readonly inactiveSince: Date;
    readonly deletionAnnouncedAt: Date | null;
    readonly deadlinesVersion: number;
    readonly deadlines: {
        readonly archiveAfterDays: number;
        readonly deletionAfterDays: number;
        readonly draftArchiveMonths: number;
    };
}

/** Cursor used to page retention candidates by vertical then listing id. */
export interface RetentionCandidateCursor {
    readonly vertical: ListingVertical;
    readonly listingId: string;
}

/** Reads an eligible listing and validates its own deadline version under a row lock. */
export async function readRetentionListing(args: {
    readonly tx: DrizzleClient;
    readonly vertical: ListingVertical;
    readonly listingId: string;
}): Promise<RetentionListing | null> {
    const result = await args.tx.execute(sql<{
        id: string;
        ownerId: string;
        publicationStatus: PublicationStatusEnum;
        createdAt: Date;
        inactiveSince: Date;
        deletionAnnouncedAt: Date | null;
        deadlinesVersion: number;
        values: unknown;
    }>`SELECT l.id, l.owner_id AS "ownerId", l.publication_status AS "publicationStatus",
        l.created_at AS "createdAt", l.inactive_since AS "inactiveSince",
        l.deletion_announced_at AS "deletionAnnouncedAt", l.deadlines_version AS "deadlinesVersion",
        v.values
      FROM ${sql.identifier(TABLES[args.vertical])} AS l
      LEFT JOIN vertical_deadline_version AS v ON v.version = l.deadlines_version
      WHERE l.id = ${args.listingId} AND l.deleted_at IS NULL
      FOR UPDATE OF l`);
    const row = result.rows[0];
    if (!row) return null;
    const parsed = VerticalDeadlineValuesSchema.safeParse(row.values);
    if (!parsed.success) throw new Error(`Invalid deadline version for listing ${row.id}`);
    return {
        id: String(row.id),
        ownerId: String(row.ownerId),
        publicationStatus: row.publicationStatus as PublicationStatusEnum,
        createdAt: new Date(String(row.createdAt)),
        inactiveSince: new Date(String(row.inactiveSince)),
        deletionAnnouncedAt: row.deletionAnnouncedAt
            ? new Date(String(row.deletionAnnouncedAt))
            : null,
        deadlinesVersion: Number(row.deadlinesVersion),
        deadlines: {
            archiveAfterDays: parsed.data['1'].days,
            deletionAfterDays: parsed.data['2'].days,
            draftArchiveMonths: parsed.data['3'].months
        }
    };
}

/** Returns a keyset page of rows whose stored clock could have reached its deadline. */
export async function listRetentionCandidates(args: {
    readonly tx: DrizzleClient;
    readonly now: Date;
    readonly after: RetentionCandidateCursor | null;
    readonly limit: number;
}): Promise<{
    readonly items: readonly {
        readonly vertical: ListingVertical;
        readonly listingId: string;
        readonly ownerId: string;
    }[];
    readonly next: RetentionCandidateCursor | null;
}> {
    const branches = Object.entries(TABLES).map(
        ([vertical, name]) => sql`
        SELECT ${vertical}::text AS vertical, l.id::text AS "listingId", l.owner_id::text AS "ownerId"
        FROM ${sql.identifier(name)} l LEFT JOIN vertical_deadline_version v ON v.version = l.deadlines_version
        WHERE l.deleted_at IS NULL AND (
          (l.publication_status IN ('PUBLISHED','UNPUBLISHED_BY_BILLING') AND
           (v.version IS NULL OR l.inactive_since + make_interval(days => (v.values->'1'->>'days')::int) <= ${args.now})) OR
          (l.publication_status = 'DRAFT' AND
           (v.version IS NULL OR (l.inactive_since AT TIME ZONE 'UTC') + make_interval(months => (v.values->'3'->>'months')::int)
             <= (${args.now} AT TIME ZONE 'UTC')))
        )`
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

/** Reads the origin of each listing's most recent transition into ARCHIVED. */
export async function readArchiveOrigins(args: {
    readonly tx: DrizzleClient;
    readonly vertical: ListingVertical;
    readonly listingIds: readonly string[];
}): Promise<ReadonlyMap<string, PublicationStatusEnum>> {
    if (args.listingIds.length === 0) return new Map();
    const result = await args.tx.execute(sql<{ entityId: string; origin: PublicationStatusEnum }>`
        SELECT DISTINCT ON (e.entity_id) e.entity_id AS "entityId", change->>'old' AS origin
        FROM domain_event e CROSS JOIN LATERAL jsonb_array_elements(e.changes) AS changes(change)
        WHERE e.entity_type = ${args.vertical} AND e.entity_id = ANY(${sql.param([...args.listingIds])}::text[])
          AND e.event_type = 'listing.status_changed' AND change->>'field' = 'publicationStatus'
          AND change->>'new' = 'ARCHIVED'
        ORDER BY e.entity_id, e.occurred_at DESC, e.id DESC`);
    return new Map<string, PublicationStatusEnum>(
        result.rows.map((row) => [String(row.entityId), row.origin as PublicationStatusEnum])
    );
}

/** Transaction-bound listing retention persistence. */
export const listingRetentionModel = {
    readRetentionListing,
    listRetentionCandidates,
    readArchiveOrigins
};
