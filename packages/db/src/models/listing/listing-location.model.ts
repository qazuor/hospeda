import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import type { DrizzleClient } from '../../types.ts';

/** The verticals the one-address rule applies to (HOS-1810). Experiences are out. */
export type LocationKeyVertical = VerticalEnum.ACCOMMODATION | VerticalEnum.VENUE;

const TABLES: Record<LocationKeyVertical, string> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.VENUE]: 'venues'
};

/** The location-rule columns of one listing row. */
export interface ListingLocationState {
    readonly id: string;
    readonly ownerId: string;
    readonly locationKey: string | null;
    readonly publicationStatus: string;
    /** `true` when an admin exception is in force: granted for the key the row holds now. */
    readonly hasException: boolean;
}

/** One group of listings sharing a place key (the admin report). */
export interface LocationDuplicateGroup {
    readonly locationKey: string;
    readonly listings: readonly { readonly id: string; readonly ownerId: string }[];
    readonly ownerCount: number;
    /** `true` when every listing of the group belongs to the same owner. */
    readonly sameOwner: boolean;
}

function rowsOf<T>(result: unknown): T[] {
    return ((result as { rows?: T[] }).rows ?? []) as T[];
}

/**
 * Reads the location-rule columns of one non-deleted listing.
 *
 * @param args.vertical - Accommodation or venue.
 * @param args.id - The listing id.
 * @param args.tx - Optional transaction.
 * @returns The state, or `null` when the listing does not exist.
 */
async function getState(args: {
    readonly vertical: LocationKeyVertical;
    readonly id: string;
    readonly tx?: DrizzleClient;
}): Promise<ListingLocationState | null> {
    const result = await (args.tx ?? getDb()).execute(
        sql`SELECT id, owner_id, location_key, publication_status,
                   (location_exception_at IS NOT NULL
                    AND location_key IS NOT NULL
                    AND location_exception_key = location_key) AS has_exception
            FROM ${sql.identifier(TABLES[args.vertical])}
            WHERE id = ${args.id} AND deleted_at IS NULL LIMIT 1`
    );
    const row = rowsOf<{
        id: string;
        owner_id: string;
        location_key: string | null;
        publication_status: string;
        has_exception: boolean;
    }>(result)[0];
    if (!row) return null;
    return {
        id: row.id,
        ownerId: row.owner_id,
        locationKey: row.location_key,
        publicationStatus: row.publication_status,
        hasException: row.has_exception === true
    };
}

/**
 * The model behind the one-address rule (HOS-1810). Every method is scoped to
 * ONE vertical's table: a venue never collides with an accommodation.
 */
export const listingLocationModel = {
    getState,

    /**
     * Finds ANOTHER listing of the same owner that occupies the same place: same
     * table, same `location_key`, `PUBLISHED`, not deleted and without an exception.
     *
     * @param args.vertical - Accommodation or venue.
     * @param args.locationKey - The key to look for (never null).
     * @param args.ownerId - Only this owner's listings are considered.
     * @param args.excludeId - The listing being published or edited.
     * @param args.tx - Optional transaction.
     * @returns The id of the occupant, or `null`.
     */
    async findOwnOccupant(args: {
        readonly vertical: LocationKeyVertical;
        readonly locationKey: string;
        readonly ownerId: string;
        readonly excludeId: string;
        readonly tx?: DrizzleClient;
    }): Promise<string | null> {
        const result = await (args.tx ?? getDb()).execute(
            sql`SELECT id FROM ${sql.identifier(TABLES[args.vertical])}
                WHERE location_key = ${args.locationKey}
                  AND owner_id = ${args.ownerId}
                  AND id <> ${args.excludeId}
                  AND publication_status = ${PublicationStatusEnum.PUBLISHED}
                  AND deleted_at IS NULL
                  AND (location_exception_at IS NULL
                       OR location_exception_key IS DISTINCT FROM location_key)
                ORDER BY created_at ASC LIMIT 1`
        );
        return rowsOf<{ id: string }>(result)[0]?.id ?? null;
    },

    /**
     * Whether the listing shares its key with another listing of the SAME owner
     * that is `PUBLISHED` (the draft warning). Never reveals ids.
     */
    async hasOwnDuplicate(args: {
        readonly vertical: LocationKeyVertical;
        readonly id: string;
        readonly tx?: DrizzleClient;
    }): Promise<boolean> {
        const state = await getState(args);
        if (!state?.locationKey || state.hasException) return false;
        return (
            (await listingLocationModel.findOwnOccupant({
                vertical: args.vertical,
                locationKey: state.locationKey,
                ownerId: state.ownerId,
                excludeId: args.id,
                tx: args.tx
            })) !== null
        );
    },

    /**
     * Grants an exception, bound to the key the listing holds right now: it is in
     * force only while `location_key` still equals the stored `location_exception_key`,
     * so moving the listing to another address ends it.
     *
     * @returns `granted`; `not_found` when the listing does not exist; `no_key` when
     *   it has no comparable address (there is nothing to be exempt for).
     */
    async setException(args: {
        readonly vertical: LocationKeyVertical;
        readonly id: string;
        readonly adminId: string;
        readonly reason: string;
        readonly at: Date;
        readonly tx?: DrizzleClient;
    }): Promise<'granted' | 'not_found' | 'no_key'> {
        const result = await (args.tx ?? getDb()).execute(
            sql`UPDATE ${sql.identifier(TABLES[args.vertical])}
                SET location_exception_by = ${args.adminId},
                    location_exception_reason = ${args.reason},
                    location_exception_at = ${args.at},
                    location_exception_key = location_key
                WHERE id = ${args.id} AND deleted_at IS NULL AND location_key IS NOT NULL
                RETURNING id`
        );
        if (rowsOf(result).length > 0) return 'granted';
        return (await getState(args)) ? 'no_key' : 'not_found';
    },

    /** Removes the exception. Returns `false` when the listing does not exist. */
    async clearException(args: {
        readonly vertical: LocationKeyVertical;
        readonly id: string;
        readonly tx?: DrizzleClient;
    }): Promise<boolean> {
        const result = await (args.tx ?? getDb()).execute(
            sql`UPDATE ${sql.identifier(TABLES[args.vertical])}
                SET location_exception_by = NULL,
                    location_exception_reason = NULL,
                    location_exception_at = NULL,
                    location_exception_key = NULL
                WHERE id = ${args.id} AND deleted_at IS NULL RETURNING id`
        );
        return rowsOf(result).length > 0;
    },

    /**
     * Pages the groups of two or more `PUBLISHED`, live listings sharing a key
     * and having no exception. This is the admin flag for cross-owner duplicates.
     */
    async listDuplicateGroups(args: {
        readonly vertical: LocationKeyVertical;
        readonly page: number;
        readonly pageSize: number;
        readonly tx?: DrizzleClient;
    }): Promise<{ readonly items: readonly LocationDuplicateGroup[]; readonly total: number }> {
        const db = args.tx ?? getDb();
        const table = sql.identifier(TABLES[args.vertical]);
        const offset = (args.page - 1) * args.pageSize;
        const groups = await db.execute(
            sql`SELECT location_key,
                       count(DISTINCT owner_id)::int AS owner_count,
                       json_agg(json_build_object('id', id, 'ownerId', owner_id) ORDER BY created_at) AS listings,
                       count(*) OVER () AS total_groups
                FROM ${table}
                WHERE location_key IS NOT NULL AND deleted_at IS NULL
                  AND publication_status = ${PublicationStatusEnum.PUBLISHED}
                  AND (location_exception_at IS NULL
                       OR location_exception_key IS DISTINCT FROM location_key)
                GROUP BY location_key
                HAVING count(*) > 1
                ORDER BY location_key
                LIMIT ${args.pageSize} OFFSET ${offset}`
        );
        const rows = rowsOf<{
            location_key: string;
            owner_count: number;
            listings: { id: string; ownerId: string }[];
            total_groups: number | string;
        }>(groups);
        return {
            items: rows.map((row) => ({
                locationKey: row.location_key,
                listings: row.listings,
                ownerCount: row.owner_count,
                sameOwner: row.owner_count === 1
            })),
            total: rows[0] ? Number(rows[0].total_groups) : 0
        };
    }
};
