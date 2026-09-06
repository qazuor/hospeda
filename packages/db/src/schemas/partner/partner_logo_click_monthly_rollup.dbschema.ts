/**
 * @file partner_logo_click_monthly_rollup.dbschema.ts
 *
 * Monthly aggregate of `partner_logo_clicks`, written before the TTL purge
 * destroys the rows it summarises (HOS-1063 A-6).
 *
 * ## Why this table exists when the spec only named one rollup
 *
 * A-6 was written against `entity_views` because that is where R-4 was measured.
 * The argument is not about that table though — it is that a 95-day purge makes
 * the "do we keep history?" decision on the owner's behalf, irreversibly. Logo
 * clicks are purged on the same horizon for the same GDPR-lite reason
 * (`visitor_hash` is a fingerprint and must not be retained forever), so leaving
 * them un-rolled-up would reintroduce R-4 for exactly one of the two numbers the
 * panel shows — and it is the number the partner is most likely to ask about a
 * season later.
 *
 * ## Why a second table rather than a `metric` column on the view rollup
 *
 * **DO NOT MERGE THIS TABLE INTO `entity_view_monthly_rollups`.** The two are
 * ~80% identical and that similarity is the trap, not the argument: it is the
 * same 80% that made "just put the clicks in `entity_views`" look reasonable,
 * and OQ-2 rejected it one level up for the reason that applies here unchanged.
 *
 * A discriminator column shared by two metrics fails OPEN. Every read has to
 * remember the filter; a read that forgets it silently SUMS views and clicks
 * into a single number that looks entirely plausible, on a panel whose whole
 * purpose is to report two separate figures honestly. Nothing goes red, and the
 * partner is shown a number that is the addition of two things they were told
 * are different. Two tables cannot be mixed up by omission — the wrong query
 * does not compile against a table that has no such column.
 *
 * This decision was reviewed and approved (HOS-1063, tech lead 2026-09-05) as a
 * deliberate extension of A-6 beyond its literal text. It is recorded here, in
 * the code, and not only in a PR description, because a future contributor
 * tidying up two near-identical tables will read this file and not that thread.
 *
 * @see packages/db/src/schemas/partner/partner_logo_click.dbschema.ts — the source.
 * @see packages/db/src/schemas/entity-view/entity_view_monthly_rollup.dbschema.ts — the sibling.
 */
import { date, integer, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { partners } from './partner.dbschema.js';

export const partnerLogoClickMonthlyRollups = pgTable(
    'partner_logo_click_monthly_rollups',
    {
        /** Surrogate PK. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** The partner this aggregate belongs to. Cascades with the partner. */
        partnerId: uuid('partner_id')
            .notNull()
            .references(() => partners.id, { onDelete: 'cascade' }),
        /**
         * First day of the aggregated calendar month, in `MARKET_TIMEZONE`.
         * A `date` for the same reason as the sibling table: it is a label.
         */
        month: date('month').notNull(),
        /**
         * Total clicks in the month, across BOTH destinations.
         *
         * Not split by destination, because the promise the number answers
         * ("cuántos entraron desde tu logo") draws no distinction. The split
         * survives in the source rows for as long as they live; if HOS-1159
         * makes it load-bearing, the rollup is where it would have to be added —
         * and only from that month forward, which is the honest outcome.
         */
        total: integer('total').notNull(),
        /** Distinct visitor fingerprints that clicked in the month. */
        uniqueVisitors: integer('unique_visitors').notNull()
    },
    (table) => ({
        /** Idempotency key for the writer and read index for one partner's history. */
        partnerLogoClickMonthlyRollups_partner_month_uq: uniqueIndex(
            'partnerLogoClickMonthlyRollups_partner_month_uq'
        ).on(table.partnerId, table.month)
    })
);

/** Row shape returned by SELECT queries. */
export type SelectPartnerLogoClickMonthlyRollup =
    typeof partnerLogoClickMonthlyRollups.$inferSelect;

/** Row shape expected by INSERT statements. */
export type InsertPartnerLogoClickMonthlyRollup =
    typeof partnerLogoClickMonthlyRollups.$inferInsert;
