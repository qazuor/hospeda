import { isNull, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * The two columns every listing media table (`accommodation_media`,
 * `venue_media`, `experience_media`) carries that decide whether a row may
 * be shown at all.
 */
export interface ListingMediaShownColumns {
    /** Soft-delete timestamp; a set value means the photo was removed. */
    readonly deletedAt: AnyPgColumn;
    /**
     * PB12 mark (AC:V6:30); a set value means the listing was purged and the
     * photo is waiting for its remote deletion to be retried.
     */
    readonly remoteDeletionPendingAt: AnyPgColumn;
}

/**
 * The one rule for "this listing media row may be shown": not soft-deleted and
 * not marked for remote deletion (AC:V6:30, «una fila marcada no se muestra en
 * ninguna superficie»).
 *
 * Every display finder of the three listing media models spreads these
 * conditions into its `WHERE`, so a marked row never reaches a gallery, a
 * featured image, a list card or a bookmark. The retry run reads the marked rows
 * through `listingPurgeModel.listMarkedMedia`, which does not use this rule.
 *
 * @param input.table - The media table's columns.
 * @returns The conditions to spread into the finder's `and(...)`.
 */
export function listingMediaShownConditions(input: {
    readonly table: ListingMediaShownColumns;
}): readonly [SQL, SQL] {
    const { table } = input;
    return [isNull(table.deletedAt), isNull(table.remoteDeletionPendingAt)];
}
