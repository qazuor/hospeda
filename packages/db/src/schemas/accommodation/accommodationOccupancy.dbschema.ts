import { relations } from 'drizzle-orm';
import { boolean, date, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { OccupancySourcePgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { accommodations } from './accommodation.dbschema.ts';

/**
 * `accommodation_occupancy` — one row per occupied day for an accommodation
 * (HOS-43 Phase 1).
 *
 * `date` is a native Postgres `date` column — the FIRST one in this codebase
 * (HOS-43 R8). Every other date-bearing column in the schema is `timestamptz`;
 * this one is intentionally hour-less, which lets the search integration's
 * `NOT EXISTS` range filter (spec section 5) stay a clean date comparison.
 *
 * No `deletedAt`/`deletedById` — unlike most entities in this codebase, rows
 * here are hard-deleted: un-toggling a `MANUAL` day removes the row outright,
 * and sync sources (Phase 2/3) reconcile by deleting their own stale rows.
 */
export const accommodationOccupancy = pgTable(
    'accommodation_occupancy',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
        /** The occupied day, native Postgres `date` (no time component). */
        date: date('date').notNull(),
        /** Always `true` in Phase 1; reserved for a future free/blocked distinction. */
        isBlocked: boolean('is_blocked').notNull().default(true),
        source: OccupancySourcePgEnum('source').notNull(),
        /** Event/booking id in the external source (Phase 2/3). `null` for MANUAL rows. */
        externalEventId: varchar('external_event_id', { length: 255 }),
        /** Optional internal note the host can attach to a blocked day. */
        note: varchar('note', { length: 500 }),
        createdById: uuid('created_by_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        // One row per day per accommodation. Also serves the search integration's
        // `NOT EXISTS (... WHERE accommodation_id = ? AND date >= ? AND date < ?)`
        // range query (spec section 5, R10) — no separate index needed.
        accommodationOccupancy_accommodationId_date_uq: uniqueIndex(
            'accommodationOccupancy_accommodationId_date_uq'
        ).on(table.accommodationId, table.date)
    })
);

export const accommodationOccupancyRelations = relations(accommodationOccupancy, ({ one }) => ({
    accommodation: one(accommodations, {
        fields: [accommodationOccupancy.accommodationId],
        references: [accommodations.id]
    }),
    createdBy: one(users, {
        fields: [accommodationOccupancy.createdById],
        references: [users.id]
    })
}));
