import type { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import type { DrizzleClient } from '../../types.ts';
import { domainEventModel } from '../domain-event/domain-event.model.ts';

/** The three verticals backed by listing tables. */
export type ListingVertical =
    | VerticalEnum.ACCOMMODATION
    | VerticalEnum.VENUE
    | VerticalEnum.EXPERIENCE;

/** A non-deleted listing as seen by the publication machine. */
export interface PublicationListing {
    readonly id: string;
    readonly ownerId: string;
    readonly publicationStatus: PublicationStatusEnum;
    readonly createdAt: Date;
    readonly inactiveSince: Date;
}

/** Stable cursor for the daily listing reconciler. */
export interface ListingReconcilerCursor {
    readonly userId: string;
    readonly vertical: ListingVertical;
}

/** A page of distinct owner and vertical pairs. */
export interface ListingReconcilerPage {
    readonly items: readonly { readonly userId: string; readonly vertical: ListingVertical }[];
    readonly next: ListingReconcilerCursor | null;
}

const TABLES: Record<ListingVertical, string> = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
};

function table(vertical: ListingVertical) {
    return sql.identifier(TABLES[vertical]);
}

function listingRow(row: Record<string, unknown>): PublicationListing {
    return {
        id: String(row.id),
        ownerId: String(row.ownerId),
        publicationStatus: row.publicationStatus as PublicationStatusEnum,
        createdAt: new Date(String(row.createdAt)),
        inactiveSince: new Date(String(row.inactiveSince))
    };
}

/** Transaction-bound persistence for PB1, PB2, PB3 and PB6. */
export const listingPublicationModel = {
    /** Pages owners with at least one eligible, non-deleted listing. */
    async listReconcilerPopulation(args: {
        readonly tx: DrizzleClient;
        readonly after: ListingReconcilerCursor | null;
        readonly limit: number;
    }): Promise<ListingReconcilerPage> {
        const branches = Object.entries(TABLES).map(
            ([
                vertical,
                name
            ]) => sql`SELECT owner_id::text AS "userId", ${vertical}::text AS vertical
                FROM ${sql.identifier(name)}
                WHERE deleted_at IS NULL
                  AND publication_status IN ('PUBLISHED', 'UNPUBLISHED_BY_BILLING', 'ARCHIVED')
                GROUP BY owner_id`
        );
        const union = sql.join(branches, sql` UNION ALL `);
        const result = await args.tx.execute(sql<{ userId: string; vertical: ListingVertical }>`
            SELECT "userId", vertical FROM (${union}) population
            WHERE ${
                args.after === null
                    ? sql`true`
                    : sql`("userId", vertical) > (${args.after.userId}, ${args.after.vertical})`
            }
            ORDER BY "userId", vertical LIMIT ${args.limit + 1}`);
        const rows = result.rows.slice(0, args.limit).map((row) => {
            const vertical = Object.keys(TABLES).find((candidate) => candidate === row.vertical);
            if (!vertical) throw new Error(`Unexpected listing vertical: ${String(row.vertical)}`);
            return { userId: String(row.userId), vertical: vertical as ListingVertical };
        });
        const last = rows.at(-1);
        return {
            items: rows,
            next:
                result.rows.length > args.limit && last
                    ? { userId: last.userId, vertical: last.vertical }
                    : null
        };
    },
    /** Reads owner listing state counts without locking rows. */
    async summarizeOwnerListings(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly ownerId: string;
    }): Promise<{
        readonly published: number;
        readonly unpublishedByBilling: number;
        readonly archived: number;
        readonly archivedReturnable: number;
    }> {
        const result = await args.tx.execute(sql<{
            published: string;
            unpublishedByBilling: string;
            archived: string;
            archivedReturnable: string;
        }>`SELECT
            count(*) FILTER (WHERE l.publication_status = 'PUBLISHED')::text AS published,
            count(*) FILTER (WHERE l.publication_status = 'UNPUBLISHED_BY_BILLING')::text AS "unpublishedByBilling",
            count(*) FILTER (WHERE l.publication_status = 'ARCHIVED')::text AS archived,
            count(*) FILTER (WHERE l.publication_status = 'ARCHIVED' AND EXISTS (
                SELECT 1 FROM (
                    SELECT (change->>'old') AS origin
                    FROM domain_event AS e
                    CROSS JOIN LATERAL jsonb_array_elements(e.changes) AS changes(change)
                    WHERE e.entity_type = ${args.vertical} AND e.entity_id = l.id::text
                      AND e.event_type = 'listing.status_changed'
                      AND change->>'field' = 'publicationStatus'
                      AND change->>'new' = 'ARCHIVED'
                    ORDER BY e.occurred_at DESC, e.id DESC LIMIT 1
                ) latest WHERE origin IN ('PUBLISHED', 'UNPUBLISHED_BY_BILLING')
            ))::text AS "archivedReturnable"
          FROM ${table(args.vertical)} AS l
          WHERE l.owner_id = ${args.ownerId} AND l.deleted_at IS NULL`);
        const row = result.rows[0];
        return {
            published: Number(row?.published ?? 0),
            unpublishedByBilling: Number(row?.unpublishedByBilling ?? 0),
            archived: Number(row?.archived ?? 0),
            archivedReturnable: Number(row?.archivedReturnable ?? 0)
        };
    },
    /** Pages distinct owners with a live Partner row. */
    async listPartnerPresenceUsers(args: {
        readonly tx: DrizzleClient;
        readonly after: string | null;
        readonly limit: number;
    }): Promise<{ readonly items: readonly string[]; readonly next: string | null }> {
        const result = await args.tx.execute(sql<{ userId: string }>`
            SELECT owner_user_id::text AS "userId" FROM partners
            WHERE owner_user_id IS NOT NULL AND deleted_at IS NULL
              AND (${args.after}::text IS NULL OR owner_user_id::text > ${args.after})
            GROUP BY owner_user_id ORDER BY owner_user_id LIMIT ${args.limit + 1}`);
        const items = result.rows.slice(0, args.limit).map((row) => String(row.userId));
        return { items, next: result.rows.length > args.limit ? (items.at(-1) ?? null) : null };
    },
    /** Reads the latest owner-initiated publication instant for each requested listing. */
    async readPublicationInstants(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly listingIds: readonly string[];
    }): Promise<ReadonlyMap<string, Date>> {
        if (args.listingIds.length === 0) return new Map();
        const result = await args.tx.execute(sql<{ entityId: string; occurredAt: Date }>`
            SELECT entity_id AS "entityId", max(occurred_at) AS "occurredAt"
            FROM domain_event
            WHERE entity_type = ${args.vertical}
              AND entity_id = ANY(${sql.param([...args.listingIds])}::text[])
              AND event_type = 'listing.status_changed'
              AND actor_type = 'owner'
              AND changes @> '[{"field":"publicationStatus","new":"PUBLISHED"}]'::jsonb
            GROUP BY entity_id`);
        return new Map<string, Date>(
            result.rows.map((row) => [String(row.entityId), new Date(String(row.occurredAt))])
        );
    },
    /** Serializes every transition for one owner and vertical. The caller supplies the key. */
    async lock(args: { readonly tx: DrizzleClient; readonly key: string }): Promise<void> {
        await args.tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${args.key}, 0))`);
    },

    /** Reads one non-deleted listing and locks its row until commit. */
    async readListing(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly listingId: string;
    }): Promise<PublicationListing | null> {
        const result = await args.tx.execute(sql<PublicationListing>`
            SELECT id, owner_id AS "ownerId", publication_status AS "publicationStatus",
                   created_at AS "createdAt", inactive_since AS "inactiveSince"
            FROM ${table(args.vertical)} WHERE id = ${args.listingId} AND deleted_at IS NULL
            FOR UPDATE`);
        return result.rows[0] ? listingRow(result.rows[0]) : null;
    },

    /** Counts published listings in the owner's vertical. */
    async countPublished(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly ownerId: string;
    }): Promise<number> {
        const result = await args.tx.execute(sql<{ count: string }>`
            SELECT count(*)::text AS count FROM ${table(args.vertical)}
            WHERE owner_id = ${args.ownerId} AND deleted_at IS NULL
              AND publication_status = 'PUBLISHED'`);
        return Number(result.rows[0]?.count ?? 0);
    },

    /** Lists the owner's non-deleted listings for coverage recalculation. */
    async listByOwner(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly ownerId: string;
    }): Promise<readonly PublicationListing[]> {
        const result = await args.tx.execute(sql<PublicationListing>`
            SELECT id, owner_id AS "ownerId", publication_status AS "publicationStatus",
                   created_at AS "createdAt", inactive_since AS "inactiveSince"
            FROM ${table(args.vertical)}
            WHERE owner_id = ${args.ownerId} AND deleted_at IS NULL`);
        return result.rows.map(listingRow);
    },

    /**
     * Reports whether the owner completed PB1 for this vertical. PB1 is the
     * activation event for listing verticals; job-driven PB3/PB7 events do not count.
     * Deleted listings still count because the append-only domain event remains.
     */
    async hasOwnerPublished(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly userId: string;
    }): Promise<boolean> {
        const result = await args.tx.execute(sql<{ readonly found: boolean }>`
            SELECT EXISTS (
                SELECT 1
                FROM ${table(args.vertical)} AS l
                INNER JOIN domain_event AS e ON l.id::text = e.entity_id
                WHERE l.owner_id = ${args.userId}
                  AND e.event_type = 'listing.status_changed'
                  AND e.entity_type = ${args.vertical}
                  AND e.actor_type = 'owner'
                  AND (
                    e.changes @> '[{"field":"publicationStatus","old":"DRAFT","new":"PUBLISHED"}]'::jsonb
                    OR e.changes @> '[{"field":"publicationStatus","old":"UNPUBLISHED_BY_BILLING","new":"PUBLISHED"}]'::jsonb
                  )
                LIMIT 1
            ) AS found`);
        return result.rows[0]?.found === true;
    },

    /** Conditionally changes status and writes the clock columns as a pair. */
    async setPublicationStatus(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly listingId: string;
        readonly from: PublicationStatusEnum;
        readonly to: PublicationStatusEnum;
        readonly inactiveSince?: Date;
        readonly deletionAnnouncedAt?: Date;
        readonly actorId?: string;
    }): Promise<boolean> {
        const clock = args.inactiveSince
            ? sql`, inactive_since = ${args.inactiveSince}, deadlines_version = (SELECT max("version") FROM "vertical_deadline_version")`
            : sql``;
        const deletion = args.deletionAnnouncedAt
            ? sql`, deletion_announced_at = ${args.deletionAnnouncedAt}`
            : sql``;
        const result = await args.tx.execute(sql<{ id: string }>`
            UPDATE ${table(args.vertical)}
            SET publication_status = ${args.to} ${clock} ${deletion}
            WHERE id = ${args.listingId} AND publication_status = ${args.from}
              AND deleted_at IS NULL RETURNING id`);
        return result.rows.length === 1;
    },

    /** Stamps a coverage fact without changing publication status. */
    async stampInactiveSince(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly listingIds: readonly string[];
        readonly at: Date;
    }): Promise<void> {
        if (args.listingIds.length === 0) return;
        await args.tx.execute(sql`
            UPDATE ${table(args.vertical)}
            SET inactive_since = ${args.at},
                deadlines_version = (SELECT max("version") FROM "vertical_deadline_version")
            WHERE id = ANY(${sql.param([...args.listingIds])}::uuid[]) AND deleted_at IS NULL`);
    },

    /** Appends the transition audit in the same transaction as its update. */
    async insertStatusChangedEvent(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly listingId: string;
        readonly from: PublicationStatusEnum;
        readonly to: PublicationStatusEnum;
        readonly oldInactiveSince?: Date;
        readonly inactiveSince?: Date;
        readonly actorType: 'owner' | 'job' | 'admin';
        readonly actorId?: string;
        readonly correlationId: string;
        readonly occurredAt?: Date;
        readonly deletionAnnouncedAt?: Date;
        readonly oldDeletionAnnouncedAt?: Date | null;
        readonly reason?: string | null;
        readonly archiveOrigin?: PublicationStatusEnum;
    }): Promise<void> {
        await domainEventModel.insert({
            tx: args.tx,
            eventType: 'listing.status_changed',
            entityType: args.vertical,
            entityId: args.listingId,
            actorType: args.actorType,
            actorId: args.actorId,
            correlationId: args.correlationId,
            occurredAt: args.occurredAt,
            reason: args.reason,
            changes: [
                { field: 'publicationStatus', old: args.from, new: args.to },
                ...(args.archiveOrigin
                    ? [{ field: 'archiveOrigin', new: args.archiveOrigin }]
                    : []),
                ...(args.deletionAnnouncedAt
                    ? [
                          {
                              field: 'deletionAnnouncedAt',
                              old: args.oldDeletionAnnouncedAt,
                              new: args.deletionAnnouncedAt
                          }
                      ]
                    : []),
                ...(args.inactiveSince
                    ? [
                          {
                              field: 'inactiveSince',
                              old: args.oldInactiveSince,
                              new: args.inactiveSince
                          }
                      ]
                    : [])
            ]
        });
    }
};
