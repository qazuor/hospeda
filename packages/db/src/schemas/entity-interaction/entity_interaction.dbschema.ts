/**
 * @file entity_interaction.dbschema.ts
 *
 * Append-only telemetry table recording what a visitor DID on a listing page
 * (tapped the phone, the map, a ticket link, WhatsApp...) (HOS-2256).
 *
 * ## Why a table of its own and not rows in `entity_views`
 *
 * The same decision HOS-1063 took for `partner_logo_clicks`: a click written
 * into `entity_views` would inflate the views number, and an `event_type`
 * column there fails OPEN (every existing aggregate would have to learn a new
 * filter). Unlike `partner_logo_clicks` this table is GENERIC by `entity_type`
 * instead of one table per entity, so the panels of venues, experiences and
 * events read one place.
 *
 * ## Lean by design
 *
 * No audit columns, no soft delete, no `BaseModelImpl`. Rows are never updated
 * and are hard-purged in bulk by the same TTL cron as `entity_views`. What
 * survives the purge is `entity_interaction_monthly_rollups`, which ships with
 * this table because the purge destroys what the rollup summarises.
 *
 * ## No `is_authenticated`, and the hash is never `user:<uuid>`
 *
 * "Tapped this venue's phone" identifies a person with a contact intention,
 * which is more sensitive than "viewed a page". The route therefore hashes a
 * logged-in visitor by IP and user agent like an anonymous one.
 *
 * @see packages/db/src/schemas/entity-view/entity_view.dbschema.ts - the mould.
 * @see .specs/HOS-2256-venue-interactions-tracking/spec.md
 */

import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { EntityInteractionKindPgEnum, EntityTypePgEnum } from '../enums.dbschema.ts';
import { venueEvents } from '../venue/venue_event.dbschema.ts';

export const entityInteractions = pgTable(
    'entity_interactions',
    {
        /** Surrogate PK. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** Entity type the interaction happened on. Reuses `entity_type_enum`. */
        entityType: EntityTypePgEnum('entity_type').notNull(),
        /** PK of the entity. Polymorphic, so no FK (same as `entity_views.entity_id`). */
        entityId: uuid('entity_id').notNull(),
        /** What the visitor did. */
        kind: EntityInteractionKindPgEnum('kind').notNull(),
        /**
         * The venue event the interaction refers to. Only for `TICKET_CLICK` and
         * `EVENT_IMPRESSION` (enforced by a CHECK in the extras carril).
         *
         * `ON DELETE SET NULL`, not CASCADE (owner decision, OQ-3): deleting an
         * event must not retroactively subtract clicks from the venue's total.
         * The total survives and only the per-event detail is lost.
         */
        eventId: uuid('event_id').references(() => venueEvents.id, { onDelete: 'set null' }),
        /** Salted daily hash of the visitor fingerprint. Never `user:<uuid>`, never a raw IP. */
        visitorHash: text('visitor_hash').notNull(),
        /** Wall-clock time of the interaction. */
        occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /** Main access pattern of the panel (HOS-2261): one entity, one kind, a time range. */
        entityInteractions_entity_kind_occurredAt_idx: index(
            'entityInteractions_entity_kind_occurredAt_idx'
        ).on(table.entityType, table.entityId, table.kind, table.occurredAt),
        /** Per-event access pattern (HOS-2265). Partial: most rows have no event. */
        entityInteractions_event_kind_occurredAt_idx: index(
            'entityInteractions_event_kind_occurredAt_idx'
        )
            .on(table.eventId, table.kind, table.occurredAt)
            .where(sql`${table.eventId} IS NOT NULL`),
        /** Global time-range scan of the TTL purge cron. */
        entityInteractions_occurredAt_idx: index('entityInteractions_occurredAt_idx').on(
            table.occurredAt
        )
    })
);

/** Row shape returned by SELECT queries. */
export type SelectEntityInteraction = typeof entityInteractions.$inferSelect;

/** Row shape expected by INSERT statements. */
export type InsertEntityInteraction = typeof entityInteractions.$inferInsert;
