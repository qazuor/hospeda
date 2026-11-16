/**
 * Persistence of the owner-requested location exceptions (HOS-2192): the request
 * rows, the append-only audit events, and the admin queue / history reads.
 *
 * Business rules (who may ask, what a stale request is, the revoke refusal) live
 * in `@repo/service-core`; every method here is one statement, takes an optional
 * transaction and never decides anything. Events are only ever INSERTED: there is
 * no update or delete method for them, and a static test pins that.
 */
import type { LocationExceptionEventAction, LocationExceptionRequestStatus } from '@repo/schemas';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    type LocationExceptionEntityType,
    locationExceptionEvents,
    locationExceptionRequests,
    type SelectLocationExceptionRequest
} from '../../schemas/listing/location-exception.dbschema.ts';
import { users } from '../../schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import type { LocationKeyVertical } from './listing-location.model.ts';

const TABLES: Record<LocationKeyVertical, string> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.VENUE]: 'venues'
};

function rowsOf<T>(result: unknown): T[] {
    return ((result as { rows?: T[] }).rows ?? []) as T[];
}

/** A listing row locked for the duration of a transaction. */
export interface LockedListing {
    readonly id: string;
    readonly ownerId: string;
    readonly name: string;
    readonly locationKey: string | null;
    readonly publicationStatus: string;
    /** `true` when an exception is in force for the key the row holds now. */
    readonly hasException: boolean;
}

/** One row of the admin queue, before the API names the parts. */
export interface LocationExceptionQueueRow {
    readonly requestId: string;
    readonly status: LocationExceptionRequestStatus;
    readonly listingId: string;
    readonly listingName: string;
    readonly ownerId: string;
    readonly ownerName: string;
    readonly ownerEmail: string;
    readonly street: string | null;
    readonly number: string | null;
    readonly floor: string | null;
    readonly apartment: string | null;
    readonly destinationId: string | null;
    readonly collidingListings: readonly { readonly id: string; readonly name: string }[];
    readonly reason: string;
    readonly decisionReason: string | null;
    readonly requestedAt: Date;
}

/** One audit event with the actor's display name. */
export interface LocationExceptionEventRow {
    readonly id: string;
    readonly action: LocationExceptionEventAction;
    readonly actorId: string | null;
    readonly actorName: string | null;
    readonly reason: string | null;
    readonly requestId: string | null;
    readonly createdAt: Date;
}

/** The grant columns of a listing, for the admin state read. */
export interface LocationExceptionGrant {
    readonly hasException: boolean;
    readonly by: string | null;
    readonly reason: string | null;
    readonly at: Date | null;
}

/** Model of the location-exception requests and their audit trail. */
export const listingLocationExceptionModel = {
    /**
     * Reads one live listing `FOR UPDATE`, so request/approve/revoke on the same
     * listing serialize.
     *
     * @returns The row, or `null` when it does not exist or is deleted.
     */
    async lockListing(args: {
        readonly vertical: LocationKeyVertical;
        readonly id: string;
        readonly tx: DrizzleClient;
    }): Promise<LockedListing | null> {
        const result = await args.tx.execute(
            sql`SELECT id, owner_id, name, location_key, publication_status,
                       (location_exception_at IS NOT NULL
                        AND location_key IS NOT NULL
                        AND location_exception_key = location_key) AS has_exception
                FROM ${sql.identifier(TABLES[args.vertical])}
                WHERE id = ${args.id} AND deleted_at IS NULL
                FOR UPDATE`
        );
        const row = rowsOf<{
            id: string;
            owner_id: string;
            name: string;
            location_key: string | null;
            publication_status: string;
            has_exception: boolean;
        }>(result)[0];
        if (!row) return null;
        return {
            id: row.id,
            ownerId: row.owner_id,
            name: row.name,
            locationKey: row.location_key,
            publicationStatus: row.publication_status,
            hasException: row.has_exception === true
        };
    },

    /** Appends one audit event. The only write the events table has. */
    async insertEvent(args: {
        readonly vertical: LocationKeyVertical;
        readonly listingId: string;
        readonly action: LocationExceptionEventAction;
        readonly actorId: string | null;
        readonly reason?: string | null;
        readonly locationKey?: string | null;
        readonly requestId?: string | null;
        readonly tx?: DrizzleClient;
    }): Promise<void> {
        await (args.tx ?? getDb()).insert(locationExceptionEvents).values({
            entityType: args.vertical as LocationExceptionEntityType,
            entityId: args.listingId,
            action: args.action,
            actorId: args.actorId,
            reason: args.reason ?? null,
            locationKey: args.locationKey ?? null,
            requestId: args.requestId ?? null
        });
    },

    /** The pending request of a listing, locked, or `null`. */
    async findPendingForListing(args: {
        readonly vertical: LocationKeyVertical;
        readonly listingId: string;
        readonly tx: DrizzleClient;
    }): Promise<SelectLocationExceptionRequest | null> {
        const [row] = await args.tx
            .select()
            .from(locationExceptionRequests)
            .where(
                and(
                    eq(locationExceptionRequests.entityType, args.vertical),
                    eq(locationExceptionRequests.entityId, args.listingId),
                    eq(locationExceptionRequests.status, 'PENDING')
                )
            )
            .for('update')
            .limit(1);
        return row ?? null;
    },

    /** One request by id of the given vertical, locked, or `null`. */
    async findRequestForUpdate(args: {
        readonly vertical: LocationKeyVertical;
        readonly requestId: string;
        readonly tx: DrizzleClient;
    }): Promise<SelectLocationExceptionRequest | null> {
        const [row] = await args.tx
            .select()
            .from(locationExceptionRequests)
            .where(
                and(
                    eq(locationExceptionRequests.id, args.requestId),
                    eq(locationExceptionRequests.entityType, args.vertical)
                )
            )
            .for('update')
            .limit(1);
        return row ?? null;
    },

    /** Inserts a `PENDING` request. A second pending one raises `23505` on the partial index. */
    async insertRequest(args: {
        readonly vertical: LocationKeyVertical;
        readonly listingId: string;
        readonly requestedBy: string;
        readonly locationKey: string;
        readonly reason: string;
        readonly tx: DrizzleClient;
    }): Promise<SelectLocationExceptionRequest> {
        const [row] = await args.tx
            .insert(locationExceptionRequests)
            .values({
                entityType: args.vertical as LocationExceptionEntityType,
                entityId: args.listingId,
                requestedBy: args.requestedBy,
                locationKey: args.locationKey,
                reason: args.reason
            })
            .returning();
        if (!row) throw new Error('location_exception_request insert returned no row');
        return row;
    },

    /**
     * Moves a `PENDING` request to a final state. The `status = 'PENDING'` guard
     * makes a second resolution a no-op.
     *
     * @returns `true` when the row was pending and is now resolved.
     */
    async resolveRequest(args: {
        readonly requestId: string;
        readonly status: Exclude<LocationExceptionRequestStatus, 'PENDING'>;
        readonly decidedBy: string | null;
        readonly decisionReason: string | null;
        readonly at: Date;
        readonly tx: DrizzleClient;
    }): Promise<boolean> {
        const rows = await args.tx
            .update(locationExceptionRequests)
            .set({
                status: args.status,
                decidedBy: args.decidedBy,
                decidedAt: args.at,
                decisionReason: args.decisionReason
            })
            .where(
                and(
                    eq(locationExceptionRequests.id, args.requestId),
                    eq(locationExceptionRequests.status, 'PENDING')
                )
            )
            .returning({ id: locationExceptionRequests.id });
        return rows.length > 0;
    },

    /** The latest request of a listing for the owner's view, or `null`. */
    async findLatestForListing(args: {
        readonly vertical: LocationKeyVertical;
        readonly listingId: string;
        readonly locationKey: string | null;
        readonly tx?: DrizzleClient;
    }): Promise<SelectLocationExceptionRequest | null> {
        if (!args.locationKey) return null;
        const [row] = await (args.tx ?? getDb())
            .select()
            .from(locationExceptionRequests)
            .where(
                and(
                    eq(locationExceptionRequests.entityType, args.vertical),
                    eq(locationExceptionRequests.entityId, args.listingId),
                    eq(locationExceptionRequests.locationKey, args.locationKey),
                    sql`${locationExceptionRequests.status} <> 'SUPERSEDED'`
                )
            )
            .orderBy(desc(locationExceptionRequests.requestedAt))
            .limit(1);
        return row ?? null;
    },

    /** The audit history of a listing, newest first. */
    async listEvents(args: {
        readonly vertical: LocationKeyVertical;
        readonly listingId: string;
        readonly tx?: DrizzleClient;
    }): Promise<readonly LocationExceptionEventRow[]> {
        const rows = await (args.tx ?? getDb())
            .select({
                id: locationExceptionEvents.id,
                action: locationExceptionEvents.action,
                actorId: locationExceptionEvents.actorId,
                actorName: users.displayName,
                actorEmail: users.email,
                reason: locationExceptionEvents.reason,
                requestId: locationExceptionEvents.requestId,
                createdAt: locationExceptionEvents.createdAt
            })
            .from(locationExceptionEvents)
            .leftJoin(users, eq(users.id, locationExceptionEvents.actorId))
            .where(
                and(
                    eq(locationExceptionEvents.entityType, args.vertical),
                    eq(locationExceptionEvents.entityId, args.listingId)
                )
            )
            .orderBy(desc(locationExceptionEvents.createdAt), desc(locationExceptionEvents.id));
        return rows.map((row) => ({
            id: row.id,
            action: row.action,
            actorId: row.actorId,
            actorName: row.actorName ?? row.actorEmail ?? null,
            reason: row.reason,
            requestId: row.requestId,
            createdAt: row.createdAt
        }));
    },

    /** The current grant columns of a listing, for the admin state read. */
    async getGrant(args: {
        readonly vertical: LocationKeyVertical;
        readonly id: string;
        readonly tx?: DrizzleClient;
    }): Promise<LocationExceptionGrant | null> {
        const result = await (args.tx ?? getDb()).execute(
            sql`SELECT location_exception_by AS by, location_exception_reason AS reason,
                       location_exception_at AS at,
                       (location_exception_at IS NOT NULL
                        AND location_key IS NOT NULL
                        AND location_exception_key = location_key) AS has_exception
                FROM ${sql.identifier(TABLES[args.vertical])}
                WHERE id = ${args.id} AND deleted_at IS NULL LIMIT 1`
        );
        const row = rowsOf<{
            by: string | null;
            reason: string | null;
            at: Date | string | null;
            has_exception: boolean;
        }>(result)[0];
        if (!row) return null;
        return {
            hasException: row.has_exception === true,
            by: row.by,
            reason: row.reason,
            at: row.at ? new Date(row.at) : null
        };
    },

    /**
     * Pages the admin queue of one vertical and status. Each row carries the
     * listing, its owner, the address and the PUBLISHED, live, non-excepted
     * listings of the SAME owner that share its key (the ones it collides with).
     * A pending request whose key no longer matches the listing is stale and is
     * left out of the `PENDING` queue.
     */
    async listRequests(args: {
        readonly vertical: LocationKeyVertical;
        readonly status: LocationExceptionRequestStatus;
        readonly page: number;
        readonly pageSize: number;
        readonly tx?: DrizzleClient;
    }): Promise<{ readonly items: readonly LocationExceptionQueueRow[]; readonly total: number }> {
        const table = sql.identifier(TABLES[args.vertical]);
        const offset = (args.page - 1) * args.pageSize;
        const result = await (args.tx ?? getDb()).execute(
            sql`SELECT r.id AS request_id, r.status, r.reason, r.decision_reason, r.requested_at,
                       l.id AS listing_id, l.name AS listing_name,
                       l.destination_id::text AS destination_id,
                       l.location->>'street' AS street, l.location->>'number' AS number,
                       l.location->>'floor' AS floor, l.location->>'apartment' AS apartment,
                       u.id AS owner_id, COALESCE(u.display_name, u.first_name, u.email) AS owner_name,
                       u.email AS owner_email,
                       COALESCE((
                           SELECT json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.created_at)
                           FROM ${table} c
                           WHERE c.owner_id = l.owner_id AND c.location_key = l.location_key
                             AND c.id <> l.id AND c.deleted_at IS NULL
                             AND c.publication_status = ${PublicationStatusEnum.PUBLISHED}
                             AND (c.location_exception_at IS NULL
                                  OR c.location_exception_key IS DISTINCT FROM c.location_key)
                       ), '[]'::json) AS colliding,
                       count(*) OVER () AS total_rows
                FROM location_exception_request r
                JOIN ${table} l ON l.id = r.entity_id AND l.deleted_at IS NULL
                LEFT JOIN users u ON u.id = l.owner_id
                WHERE r.entity_type = ${args.vertical} AND r.status = ${args.status}
                  AND (r.status <> 'PENDING' OR r.location_key = l.location_key)
                ORDER BY r.requested_at ASC, r.id ASC
                LIMIT ${args.pageSize} OFFSET ${offset}`
        );
        const rows = rowsOf<{
            request_id: string;
            status: LocationExceptionRequestStatus;
            reason: string;
            decision_reason: string | null;
            requested_at: Date | string;
            listing_id: string;
            listing_name: string;
            destination_id: string | null;
            street: string | null;
            number: string | null;
            floor: string | null;
            apartment: string | null;
            owner_id: string;
            owner_name: string | null;
            owner_email: string | null;
            colliding: { id: string; name: string }[];
            total_rows: number | string;
        }>(result);
        return {
            items: rows.map((row) => ({
                requestId: row.request_id,
                status: row.status,
                listingId: row.listing_id,
                listingName: row.listing_name,
                ownerId: row.owner_id,
                ownerName: row.owner_name ?? '',
                ownerEmail: row.owner_email ?? '',
                street: row.street,
                number: row.number,
                floor: row.floor,
                apartment: row.apartment,
                destinationId: row.destination_id,
                collidingListings: row.colliding,
                reason: row.reason,
                decisionReason: row.decision_reason,
                requestedAt: new Date(row.requested_at)
            })),
            total: rows[0] ? Number(rows[0].total_rows) : 0
        };
    }
};
