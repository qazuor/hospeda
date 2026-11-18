/**
 * @file entity_interaction_monthly_rollup.dbschema.ts
 *
 * Monthly aggregate of `entity_interactions`, written before the TTL purge
 * destroys the rows it summarises (HOS-2256 OQ-6).
 *
 * One row per (entity, kind, event, month). `event_id` is NULL for kinds that
 * carry no event AND for rows whose event was deleted (the FK of the source
 * table is `SET NULL`), so a venue's total for a kind is the SUM over every row
 * of that (entity, kind, month).
 *
 * `event_id` has NO foreign key here on purpose: the rollup is history, and an
 * event deleted later must not rewrite it (a `SET NULL` here would also collide
 * with the venue-wide row on the unique key below).
 *
 * The unique key needs an expression because Postgres treats NULLs as distinct
 * in a plain unique index: `coalesce(event_id, <nil uuid>)` makes "no event" a
 * single value, so a re-run corrects a month instead of duplicating it.
 *
 * DO NOT MERGE INTO `entity_view_monthly_rollups` (see the long argument in
 * `partner_logo_click_monthly_rollup.dbschema.ts`): two metrics sharing a table
 * fail open.
 */
import { sql } from 'drizzle-orm';
import { date, integer, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { EntityInteractionKindPgEnum, EntityTypePgEnum } from '../enums.dbschema.ts';

/** The "no event" sentinel used inside the unique-key expression. */
export const NIL_EVENT_ID_SQL = '00000000-0000-0000-0000-000000000000';

export const entityInteractionMonthlyRollups = pgTable(
    'entity_interaction_monthly_rollups',
    {
        /** Surrogate PK. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** Entity type the aggregate belongs to. */
        entityType: EntityTypePgEnum('entity_type').notNull(),
        /** PK of the entity. Polymorphic, no FK. */
        entityId: uuid('entity_id').notNull(),
        /** Interaction kind. */
        kind: EntityInteractionKindPgEnum('kind').notNull(),
        /** Venue event, or NULL (see file header). No FK by design. */
        eventId: uuid('event_id'),
        /** First day of the calendar month in `MARKET_TIMEZONE`. A label, hence `date`. */
        month: date('month').notNull(),
        /** Deduplicated total (same 30-minute bucket rule as the live window). */
        total: integer('total').notNull(),
        /** Distinct visitor fingerprints in the month. */
        uniqueVisitors: integer('unique_visitors').notNull()
    },
    (table) => ({
        /** Idempotency key for the writer and read index for one entity's history. */
        entityInteractionMonthlyRollups_key_uq: uniqueIndex(
            'entityInteractionMonthlyRollups_key_uq'
        ).on(
            table.entityType,
            table.entityId,
            table.kind,
            sql`coalesce(${table.eventId}, ${sql.raw(`'${NIL_EVENT_ID_SQL}'::uuid`)})`,
            table.month
        )
    })
);

/** Row shape returned by SELECT queries. */
export type SelectEntityInteractionMonthlyRollup =
    typeof entityInteractionMonthlyRollups.$inferSelect;

/** Row shape expected by INSERT statements. */
export type InsertEntityInteractionMonthlyRollup =
    typeof entityInteractionMonthlyRollups.$inferInsert;
