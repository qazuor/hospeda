import { PublicationStatusEnum, type VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import type { DrizzleClient } from '../../types.ts';
import { domainEventModel } from '../domain-event/domain-event.model.ts';

/** The three verticals backed by listing tables. */
export type ListingVertical =
    | VerticalEnum.ACCOMMODATION
    | VerticalEnum.GASTRONOMY
    | VerticalEnum.EXPERIENCE;

/** A non-deleted listing as seen by the publication machine. */
export interface PublicationListing {
    readonly id: string;
    readonly ownerId: string;
    readonly publicationStatus: PublicationStatusEnum;
    readonly createdAt: Date;
    readonly inactiveSince: Date;
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

/** V6.9b: borrar esta doble escritura al retirar las columnas viejas. */
function legacyPublicationWrite(args: {
    readonly vertical: ListingVertical;
    readonly to: PublicationStatusEnum;
}) {
    const published = args.to === PublicationStatusEnum.PUBLISHED;
    const lifecycle = published ? 'ACTIVE' : 'INACTIVE';
    const visibility = published ? 'PUBLIC' : 'PRIVATE';
    return args.vertical === 'accommodation'
        ? sql`lifecycle_state = ${lifecycle}, visibility = ${visibility}, billing_unpublished_at = ${args.to === PublicationStatusEnum.UNPUBLISHED_BY_BILLING ? sql`now()` : sql`NULL`}`
        : sql`lifecycle_state = ${lifecycle}, visibility = ${visibility}`;
}

/** Transaction-bound persistence for PB1, PB2, PB3 and PB6. */
export const listingPublicationModel = {
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

    /** Conditionally changes status and writes the clock columns as a pair. */
    async setPublicationStatus(args: {
        readonly tx: DrizzleClient;
        readonly vertical: ListingVertical;
        readonly listingId: string;
        readonly from: PublicationStatusEnum;
        readonly to: PublicationStatusEnum;
        readonly inactiveSince?: Date;
        readonly actorId?: string;
    }): Promise<boolean> {
        const clock = args.inactiveSince
            ? sql`, inactive_since = ${args.inactiveSince}, deadlines_version = (SELECT max("version") FROM "vertical_deadline_version")`
            : sql``;
        const result = await args.tx.execute(sql<{ id: string }>`
            UPDATE ${table(args.vertical)}
            SET publication_status = ${args.to}, ${legacyPublicationWrite(args)} ${clock}
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
        readonly actorType: 'owner' | 'job';
        readonly actorId?: string;
        readonly correlationId: string;
    }): Promise<void> {
        await domainEventModel.insert({
            tx: args.tx,
            eventType: 'listing.status_changed',
            entityType: args.vertical,
            entityId: args.listingId,
            actorType: args.actorType,
            actorId: args.actorId,
            correlationId: args.correlationId,
            changes: [
                { field: 'publicationStatus', old: args.from, new: args.to },
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
