import { VERTICAL_ACTIVATION_EVENT_VALUES, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { check, pgTable, varchar } from 'drizzle-orm/pg-core';
import { quotedList } from './quoted-list.ts';

/**
 * `vertical` — database mirror of `VerticalEnum` (HOS-1430, program HOS-1352).
 *
 * One row per vertical, written by the structural migration (reference data,
 * hand-written there until the SQL generator of V1.2 takes over). Lean reference
 * table: no audit columns, no soft delete, never edited at runtime.
 *
 * `activation_event` is the domain event that starts the vertical's trial
 * (DEC-TRIAL-006), from the closed `VERTICAL_ACTIVATION_EVENTS` catalog. `NULL`
 * means no event is declared and the vertical grants no trial: it fails closed,
 * with no special case in the engine. Partner is `NULL`.
 */
export const verticals = pgTable(
    'vertical',
    {
        /** The vertical's `VerticalEnum` value. Primary key. */
        id: varchar('id', { length: 32 }).primaryKey(),
        /** The activation event, or `NULL` when none is declared. */
        activationEvent: varchar('activation_event', { length: 64 })
    },
    (t) => ({
        idCheck: check(
            'ck_vertical_id',
            sql`${t.id} IN (${quotedList(Object.values(VerticalEnum))})`
        ),
        activationEventCheck: check(
            'ck_vertical_activation_event',
            sql`${t.activationEvent} IS NULL OR ${t.activationEvent} IN (${quotedList(VERTICAL_ACTIVATION_EVENT_VALUES)})`
        )
    })
);

/** Insert shape for `vertical`. */
export type InsertVertical = typeof verticals.$inferInsert;
/** Select shape for `vertical`. */
export type SelectVertical = typeof verticals.$inferSelect;
