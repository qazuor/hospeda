/**
 * @file partner_logo_click.dbschema.ts
 *
 * Append-only telemetry table recording clicks on a partner's logo in the home
 * carousel (HOS-1063 A-3). Feeds the "cuántos entraron desde tu logo" number the
 * commercial presentation promises at
 * `apps/web/src/pages/[lang]/presentacion/aliados/index.astro:143-147`.
 *
 * ## Why this is NOT a row in `entity_views`
 *
 * A click and a page view are different events about the same partner. Written
 * into `entity_views` they would share `(entity_type, entity_id)` and become
 * indistinguishable, so the views card would over-report by exactly however many
 * clicks the logo received — and nothing in the panel would look wrong. That is
 * OQ-2 option 1, rejected on those grounds; AC-13 asserts the rejection by
 * requiring a click to insert one row HERE and zero rows THERE.
 *
 * An `event_type` discriminator column on `entity_views` (OQ-2 option 2) was
 * rejected for the mirror-image reason: it fails OPEN. Every existing aggregate
 * query would have to learn a new filter, and any query that forgot it would
 * silently over-count while continuing to look correct.
 *
 * ## Lean by design, same as `entity_views`
 *
 * No audit columns, no soft delete, no `BaseModelImpl`. Rows are never updated;
 * they are hard-purged in bulk by the same TTL cron horizon. Nothing types into
 * this table — a browser does — so the reasoning that gave `partner_mentions`
 * its editable, soft-deletable shape does not apply here.
 *
 * @see packages/db/src/schemas/entity-view/entity_view.dbschema.ts — the mould.
 * @see .specs/HOS-1063-estadisticas-del-aliado/spec.md §6.1 A-3, OQ-2.
 */
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { PartnerLogoClickDestinationPgEnum } from '../enums.dbschema.ts';
import { partners } from './partner.dbschema.js';

export const partnerLogoClicks = pgTable(
    'partner_logo_clicks',
    {
        /** Surrogate PK. */
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * The partner whose logo was clicked.
         *
         * A real FK, unlike `entity_views.entity_id` — that column is
         * polymorphic and therefore cannot have one, while this table only ever
         * points at `partners`. Cascades: a deleted partner's clicks go with it.
         */
        partnerId: uuid('partner_id')
            .notNull()
            .references(() => partners.id, { onDelete: 'cascade' }),
        /**
         * Salted daily hash of the visitor fingerprint, or `'user:<uuid>'` for
         * an authenticated visitor. Computed by the same `computeVisitorHash`
         * the view beacon uses, from the same `HOSPEDA_VIEWS_HASH_SECRET`, so a
         * visitor's click and their page view carry the SAME hash and the two
         * numbers dedupe on comparable terms. Raw IPs are never stored.
         */
        visitorHash: text('visitor_hash').notNull(),
        /**
         * Which of `resolvePartnerLogoLink`'s two linking branches the click
         * followed. Both count toward the partner-facing number; the tag exists
         * so a future distinction (HOS-1159) does not need a backfill that
         * cannot be written.
         */
        destination: PartnerLogoClickDestinationPgEnum('destination').notNull(),
        /** Wall-clock time of the click. */
        clickedAt: timestamp('clicked_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /**
         * The primary access pattern, and the only one the panel needs: "how
         * many clicks did partner X get between times A and B?".
         */
        partnerLogoClicks_partnerId_clickedAt_idx: index(
            'partnerLogoClicks_partnerId_clickedAt_idx'
        ).on(table.partnerId, table.clickedAt),
        /**
         * Supports the global time-range scan of the TTL purge cron
         * (`DELETE WHERE clicked_at < NOW() - interval '95 days'`), which is a
         * different shape from the partner-scoped index above.
         */
        partnerLogoClicks_clickedAt_idx: index('partnerLogoClicks_clickedAt_idx').on(
            table.clickedAt
        )
    })
);

/** Row shape returned by SELECT queries. */
export type SelectPartnerLogoClick = typeof partnerLogoClicks.$inferSelect;

/** Row shape expected by INSERT statements. */
export type InsertPartnerLogoClick = typeof partnerLogoClicks.$inferInsert;
