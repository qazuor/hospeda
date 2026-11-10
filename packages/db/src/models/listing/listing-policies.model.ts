import { sql } from 'drizzle-orm';
import type { DrizzleClient } from '../../types.ts';
import type { ListingVertical } from './listing-publication.model.ts';

/** A listing vertical, as the enum or its string value. */
type PoliciesListingVertical = `${ListingVertical}`;

/** The listing table of each vertical. */
const TABLES: Readonly<Record<PoliciesListingVertical, string>> = {
    accommodation: 'accommodations',
    venue: 'venues',
    experience: 'experiences'
};

/** The result of a locked `policies` read. */
export interface LockedListingPolicies {
    /** False when no row has that id (deleted rows included: the update itself decides). */
    readonly found: boolean;
    /** The stored `policies`, or null for an empty column. */
    readonly policies: Record<string, unknown> | null;
}

/**
 * Row-locked reads of a listing's `policies` (HOS-2060).
 *
 * The update path merges a `policies` PATCH over the stored object. Two pages
 * of the owner editor send their own PATCH, so an unlocked read-merge-write
 * lets one save erase the other's key. Reading with `FOR UPDATE` inside the
 * update transaction serialises the two merges: the second waits for the
 * first to commit and then merges over its result.
 */
export const listingPoliciesModel = {
    /**
     * Reads one listing's `policies` and locks its row until the transaction ends.
     *
     * @param args.tx - The update transaction. A lock outside one is useless.
     * @param args.vertical - The listing vertical.
     * @param args.listingId - The listing id.
     * @returns `{ found, policies }`.
     */
    async readForUpdate(args: {
        readonly tx: DrizzleClient;
        readonly vertical: PoliciesListingVertical;
        readonly listingId: string;
    }): Promise<LockedListingPolicies> {
        const result = await args.tx.execute(sql<{ policies: Record<string, unknown> | null }>`
            SELECT policies FROM ${sql.identifier(TABLES[args.vertical])}
            WHERE id = ${args.listingId}
            FOR UPDATE`);
        const row = result.rows[0] as { policies?: Record<string, unknown> | null } | undefined;
        return { found: row !== undefined, policies: row?.policies ?? null };
    }
};
