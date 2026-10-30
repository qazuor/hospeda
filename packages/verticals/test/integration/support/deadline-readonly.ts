import type { DrizzleClient } from '@repo/db';
import { sql } from 'drizzle-orm';
import { expect } from 'vitest';
import type { PublicationVertical } from '../../../src/publication/publication-types';

export interface DeadlineListingRef {
    readonly vertical: PublicationVertical;
    readonly listingId: string;
}

export interface DeadlineSourcesSnapshot {
    readonly versions: readonly Record<string, unknown>[];
    readonly listings: readonly {
        readonly vertical: DeadlineListingRef['vertical'];
        readonly listingId: string;
        readonly inactive_since: Date | null;
        readonly deadlines_version: number | null;
        readonly deletion_announced_at: Date | null;
    }[];
}

const LISTING_TABLES: Readonly<Record<DeadlineListingRef['vertical'], string>> = {
    accommodation: 'accommodations',
    venue: 'venues',
    experience: 'experiences'
};

/**
 * Captures every deadline version and the stored deadline source fields for the supplied listings.
 * HOS-1504 reuses this in its notice job test to prove the prior-notice job also reads deadlines
 * without writing them (AC:V9b:11).
 */
export async function snapshotDeadlineSources(args: {
    readonly db: DrizzleClient;
    readonly listings: readonly DeadlineListingRef[];
}): Promise<DeadlineSourcesSnapshot> {
    const versions = await args.db.execute(sql<Record<string, unknown>>`
        SELECT * FROM vertical_deadline_version ORDER BY version
    `);
    const listings = await Promise.all(
        args.listings.map(async ({ vertical, listingId }) => {
            const table = LISTING_TABLES[vertical];
            const result = await args.db.execute(sql<{
                inactive_since: Date | null;
                deadlines_version: number | null;
                deletion_announced_at: Date | null;
            }>`
                SELECT inactive_since, deadlines_version, deletion_announced_at
                FROM ${sql.identifier(table)} WHERE id = ${listingId}::uuid
            `);
            const row = result.rows[0];
            if (!row) throw new Error(`Deadline fixture not found: ${vertical}/${listingId}`);
            return {
                vertical,
                listingId,
                inactive_since: row.inactive_since as Date | null,
                deadlines_version: row.deadlines_version as number | null,
                deletion_announced_at: row.deletion_announced_at as Date | null
            };
        })
    );
    return { versions: versions.rows, listings };
}

/** Compares complete snapshots, including every column in the immutable deadline catalog. */
export function expectDeadlineSourcesUnchanged(args: {
    readonly before: DeadlineSourcesSnapshot;
    readonly after: DeadlineSourcesSnapshot;
}): void {
    expect(args.after).toEqual(args.before);
}
