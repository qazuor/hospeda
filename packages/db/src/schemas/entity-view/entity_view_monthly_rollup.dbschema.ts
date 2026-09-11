/**
 * @file entity_view_monthly_rollup.dbschema.ts
 *
 * Monthly aggregate of `entity_views`, written before the 95-day purge destroys
 * the rows it summarises (HOS-1063 A-6, OQ-1 option 2).
 *
 * ## Why this ships INSIDE Phase A and not in a follow-up
 *
 * `entity-views-purge.job.ts` deletes at `ENTITY_VIEWS_RETENTION_DAYS = 95` and
 * what it deletes cannot be reconstructed. A rollup added later starts its
 * history on the day it deploys, not on the day counting began — the `batchId`
 * lesson from `partner_mention.dbschema.ts:76-78` ("it must exist from the first
 * migration or never") applied to a time series. Deferring the rollup does not
 * defer the decision; it hands the decision to a cron.
 *
 * ## Why it covers EVERY trackable entity type, not only PARTNER
 *
 * A partner-only rollup is a table that silently returns zeros the first time
 * someone reads it for accommodations, and filtering to one type costs strictly
 * more code than not filtering. AC-17 asserts this with two entity types,
 * because a rollup that covers one is indistinguishable from a correct one when
 * only that one is tested.
 *
 * ## Why the unique index matters
 *
 * The table is append-only in the sense that rows are never deleted, but a cron
 * that runs twice for the same month must CORRECT its row, not duplicate it —
 * and a re-run over a month whose source rows are still present is the normal
 * way to repair a failed run. The unique key on `(entity_type, entity_id,
 * month)` is what makes the writer idempotent via `ON CONFLICT DO UPDATE`.
 * Without it a retried run doubles every number in that month.
 *
 * ## Why this table has NO foreign key while its partner-side sibling cascades
 *
 * `partner_logo_click_monthly_rollups.partner_id` carries an `ON DELETE CASCADE`
 * to `partners` and this table carries nothing, which reads like an oversight
 * and is not one. `entity_id` here is POLYMORPHIC — it addresses an
 * accommodation, a post, an event or a partner depending on `entity_type` — and
 * Postgres has no polymorphic foreign key to declare. The sibling is
 * monomorphic, so it can and does.
 *
 * Read per family rather than across them and the treatment is consistent:
 * `entity_views` (the source) has no FK either, and `partner_logo_clicks` (the
 * other source) cascades exactly like its own rollup.
 *
 * The consequence is real and worth stating: deleting a partner removes its
 * `partner_logo_click_monthly_rollups` rows and LEAVES its `entity_type =
 * 'PARTNER'` rows here. They are counts against a uuid that no longer resolves —
 * harmless to read, since every read is keyed by an id the caller already holds,
 * but they do not disappear on their own. Making them disappear takes a sweep,
 * not a constraint.
 *
 * @see packages/db/src/schemas/partner/partner_logo_click_monthly_rollup.dbschema.ts
 * @see packages/db/src/schemas/entity-view/entity_view.dbschema.ts — the source.
 * @see .specs/HOS-1063-estadisticas-del-aliado/spec.md §6.1 A-6, OQ-1, R-4.
 */
import { date, integer, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { EntityTypePgEnum } from '../enums.dbschema.ts';

export const entityViewMonthlyRollups = pgTable(
    'entity_view_monthly_rollups',
    {
        /** Surrogate PK. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** Which entity type this aggregate is for. Reuses `entity_type_enum`. */
        entityType: EntityTypePgEnum('entity_type').notNull(),
        /** PK of the aggregated entity. Polymorphic — no DB-level FK, as in the source table. */
        entityId: uuid('entity_id').notNull(),
        /**
         * First day of the aggregated calendar month, in `MARKET_TIMEZONE`.
         *
         * A `date`, not a `timestamp`: the value is a month label, and storing it
         * with a time component invites two runs to write "the same" month at two
         * different instants and defeat the unique key.
         */
        month: date('month').notNull(),
        /**
         * Deduplicated total visits in the month, using the same 30-minute
         * bucket rule the live window uses so a rolled-up month and a live month
         * are the same measurement, not two.
         */
        total: integer('total').notNull(),
        /** Distinct visitor fingerprints in the month. */
        uniqueVisitors: integer('unique_visitors').notNull()
    },
    (table) => ({
        /**
         * Idempotency key for the writer AND the read index for "this entity's
         * history". One row per entity per month, by construction.
         */
        entityViewMonthlyRollups_entity_month_uq: uniqueIndex(
            'entityViewMonthlyRollups_entity_month_uq'
        ).on(table.entityType, table.entityId, table.month)
    })
);

/** Row shape returned by SELECT queries. */
export type SelectEntityViewMonthlyRollup = typeof entityViewMonthlyRollups.$inferSelect;

/** Row shape expected by INSERT statements. */
export type InsertEntityViewMonthlyRollup = typeof entityViewMonthlyRollups.$inferInsert;
