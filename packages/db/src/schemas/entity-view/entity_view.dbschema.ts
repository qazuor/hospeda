/**
 * @file entity_view.dbschema.ts
 *
 * Append-only telemetry table that records every view event for any trackable
 * entity (ACCOMMODATION, POST, EVENT). Used by SPEC-159 to power per-entity
 * "view count" aggregates and deduplication logic.
 *
 * **Lean by design**: this table intentionally omits the standard audit columns
 * (`createdById`, `updatedById`, `deletedAt`, `adminInfo`) and does NOT extend
 * the BaseModel soft-delete convention. The user approved this deviation
 * explicitly (SPEC-159 tech-analysis §5). Rows are never updated or soft-deleted;
 * they are hard-purged in bulk by a TTL retention cron (T-011, 95 days).
 *
 * **No DB-level FK on entityId**: polymorphic references cannot use real FKs
 * (one column must reference multiple tables). This mirrors the `user_bookmarks`
 * and `entity_comments` precedents. Referential integrity is enforced at the
 * service layer.
 *
 * **Enum reuse**: `EntityTypePgEnum` already exists in `enums.dbschema.ts` and
 * covers ACCOMMODATION, POST, and EVENT. No new pg enum is created.
 *
 * @see SPEC-159 tech-analysis §5 for the full column specification.
 */
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { EntityTypePgEnum } from '../enums.dbschema.ts';

export const entityViews = pgTable(
    'entity_views',
    {
        /** Surrogate PK — enables idempotent upserts and easy pagination. */
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * Which entity type was viewed (ACCOMMODATION, POST, EVENT).
         * Reuses the existing `entity_type_enum` pg enum — no new enum created.
         */
        entityType: EntityTypePgEnum('entity_type').notNull(),
        /**
         * PK of the viewed entity. Polymorphic — no DB-level FK (same pattern
         * as `user_bookmarks.entity_id` and `entity_comments.entity_id`).
         */
        entityId: uuid('entity_id').notNull(),
        /**
         * Salted daily hash of visitor fingerprint, or the string `'user:<uuid>'`
         * for authenticated users. Used for deduplication within the TTL window.
         */
        visitorHash: text('visitor_hash').notNull(),
        /** Whether the viewer was logged in at the time of the view. */
        isAuthenticated: boolean('is_authenticated').notNull().default(false),
        /** Wall-clock time of the view event (with timezone, defaulting to NOW). */
        viewedAt: timestamp('viewed_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /**
         * Primary access pattern: "how many views did entity X get between
         * times A and B?" and "all views for entity X ordered by time".
         * Also supports the TTL purge cron when combined with a time range.
         * SPEC-159 §5.
         */
        entityTimeIdx: index('idx_entity_views_entity_time').on(
            table.entityType,
            table.entityId,
            table.viewedAt
        ),
        /**
         * Supports global time-range scans by the TTL purge cron
         * (delete WHERE viewed_at < NOW() - interval '95 days').
         * SPEC-159 §5.
         */
        timeIdx: index('idx_entity_views_time').on(table.viewedAt)
    })
);

/** Row shape returned by SELECT queries. */
export type SelectEntityView = typeof entityViews.$inferSelect;

/** Row shape expected by INSERT statements. */
export type InsertEntityView = typeof entityViews.$inferInsert;
