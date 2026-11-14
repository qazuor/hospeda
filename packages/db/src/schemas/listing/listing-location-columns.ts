import { text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * The one-address-rule columns (HOS-1810), added identically to the
 * `accommodations` and `venues` tables.
 *
 * - `location_key`: the normalized place key derived from `location` and
 *   `destination_id` by `buildLocationKey`. It is written ONLY by the services
 *   (`_beforeCreate` / `_beforeUpdate`), never by a request body. `NULL` means
 *   the address is not specific enough to compare (no number, `s/n`).
 * - `location_exception_*`: an admin-granted exception (a cabin complex, a food
 *   court, a hotel restaurant). The exception is in force when
 *   `location_exception_at` is not null; the three are written together.
 *
 * Returns fresh column builders on every call: a Drizzle builder must not be
 * shared between two tables.
 *
 * @returns The column builders, keyed by their TypeScript property name.
 */
export function listingLocationColumns() {
    return {
        locationKey: text('location_key'),
        locationExceptionBy: uuid('location_exception_by').references(() => users.id, {
            onDelete: 'set null'
        }),
        locationExceptionReason: text('location_exception_reason'),
        locationExceptionAt: timestamp('location_exception_at', { withTimezone: true })
    };
}
