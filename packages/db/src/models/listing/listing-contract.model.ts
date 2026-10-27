import { sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import type { DrizzleClient } from '../../types.ts';
import type { ListingVertical } from './listing-publication.model.ts';

/**
 * One non-deleted listing row as the contract's inverse queries see it
 * (`ficha`, `fichaPurgada`; contract §4.1, AC:V6:26, HOS-1483).
 *
 * The vertical and the publication status are returned as raw strings: the
 * caller (`@repo/verticals`) maps them to its enums and fails closed on a value
 * it does not know.
 */
export interface ListingContractRow {
    readonly vertical: string;
    readonly ownerId: string;
    readonly publicationStatus: string;
}

/** The listing table of each vertical (same map as the publication model). */
const LISTING_TABLES: Readonly<Record<ListingVertical, string>> = {
    accommodation: 'accommodations',
    venue: 'gastronomies',
    experience: 'experiences'
};

/**
 * Read-only persistence behind the contract's inverse listing queries
 * (contract §4.1 `ficha(idDeFicha)` and `fichaPurgada(ficha)`; AC:V6:26,
 * HOS-1483).
 */
export const listingContractModel = {
    /**
     * Reads every non-deleted row carrying this id across the three listing
     * tables (`accommodations`, `gastronomies`, `experiences`). It is a plain
     * read: no row lock. A `PURGED` listing is still returned (PB12 keeps the
     * row with `deleted_at` NULL); a soft-deleted row is not.
     *
     * @param args.listingId - The listing id (must be a UUID; the column is `uuid`)
     * @param args.tx - Optional transaction; defaults to the shared client
     * @returns Every matching row (zero, one, or — never expected — several)
     */
    async findListingsById(args: {
        readonly listingId: string;
        readonly tx?: DrizzleClient;
    }): Promise<readonly ListingContractRow[]> {
        const db = args.tx ?? getDb();
        const branches = Object.entries(LISTING_TABLES).map(
            ([vertical, name]) => sql`SELECT ${vertical}::text AS vertical,
                    owner_id::text AS "ownerId",
                    publication_status::text AS "publicationStatus"
                FROM ${sql.identifier(name)}
                WHERE id = ${args.listingId} AND deleted_at IS NULL`
        );
        const result = await db.execute(
            sql<ListingContractRow>`${sql.join(branches, sql` UNION ALL `)}`
        );
        return result.rows.map((row) => ({
            vertical: String(row.vertical),
            ownerId: String(row.ownerId),
            publicationStatus: String(row.publicationStatus)
        }));
    }
};
