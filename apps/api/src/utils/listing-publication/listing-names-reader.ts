/**
 * Reads listing names for the vertical listing notice mails (HOS-1492, H9).
 *
 * The outbox payloads carry listing ids, not names. One query per vertical on
 * its own table, `WHERE id = ANY(...)`, with no filter on publication state or
 * `deleted_at`: a `PURGED` listing keeps its name, and its purge mail names it.
 *
 * @module utils/listing-publication/listing-names-reader
 */

import { accommodations, experiences, getDb, venues } from '@repo/db';
import type { ListingNamesReader, ListingNoticeVertical } from '@repo/notifications';
import { inArray } from 'drizzle-orm';

type ListingNameRow = { readonly id: string; readonly name: string };

/** One query per vertical, each on its own listing table. */
const READ_NAMES: Readonly<
    Record<ListingNoticeVertical, (ids: string[]) => Promise<readonly ListingNameRow[]>>
> = {
    accommodation: (ids) =>
        getDb()
            .select({ id: accommodations.id, name: accommodations.name })
            .from(accommodations)
            .where(inArray(accommodations.id, ids)),
    venue: (ids) =>
        getDb()
            .select({ id: venues.id, name: venues.name })
            .from(venues)
            .where(inArray(venues.id, ids)),
    experience: (ids) =>
        getDb()
            .select({ id: experiences.id, name: experiences.name })
            .from(experiences)
            .where(inArray(experiences.id, ids))
};

/**
 * Production {@link ListingNamesReader}: the names of the given listings of one
 * vertical, whatever their state. Ids not found are simply absent from the map
 * (the renderer throws on them).
 *
 * @param input - The vertical and the listing ids.
 * @returns The names by listing id.
 */
export const readListingNames: ListingNamesReader = async ({ vertical, ids }) => {
    if (ids.length === 0) return new Map();
    const rows = await READ_NAMES[vertical]([...ids]);
    return new Map(rows.map((row) => [row.id, row.name]));
};
