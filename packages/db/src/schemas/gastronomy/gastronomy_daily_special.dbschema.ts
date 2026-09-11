import { relations } from 'drizzle-orm';
import { date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { gastronomies } from './gastronomy.dbschema.ts';

/**
 * `gastronomy_daily_specials` — the menú del día (HOS-1041).
 *
 * One dish the venue is offering right now — the plato del día, the sugerencia
 * del chef — carrying **its own validity window** so it stops being shown
 * without anybody remembering to take it down.
 *
 * ## The expiry IS the feature
 *
 * Today a restaurant that wants to announce the dish of the day edits the
 * listing's description and then has to remember to remove it. Nobody
 * remembers, so the listing carries last Tuesday's fish in April. Without the
 * window this is one more free-text field that rots in public; with it, the
 * row simply stops matching the read.
 *
 * ## Why a table and not a JSONB column on `gastronomies`
 *
 * Owner decision. The validity filter runs on EVERY read of the public listing,
 * and a JSONB document cannot serve that from an index — the reader would have
 * to pull and parse the whole document to discover that none of it applies
 * today. Two `date` columns and a composite index answer the same question
 * without touching the row. It is the same reasoning
 * `gastronomy_menu_sections` gives for the carta, applied to a read that is
 * additionally CONDITIONAL rather than merely joined.
 *
 * ## Why `date` and not `timestamptz`
 *
 * A menú del día is valid for a DAY, not from an instant. `valid_from` and
 * `valid_until` are inclusive calendar dates: a special offered only today has
 * both set to today. Storing an instant would force every writer to invent a
 * time of day, and every reader to decide what "until" means at 14:37.
 *
 * The day the comparison is made against is **not** `CURRENT_DATE** and not the
 * container's UTC day: it is passed in by the caller, which resolves it through
 * `getTodayInMarketTimezone()` (AR, UTC-3). At 21:00 in Concepción del Uruguay
 * the UTC day has already rolled over, so a UTC "today" would retire the dish
 * of the day in the middle of dinner service — the precise hour it exists for.
 * See `gastronomy.daily-specials.ts` for where that value enters.
 *
 * ## What it deliberately does NOT carry
 *
 * - **No i18n columns.** Same position `gastronomy_menu_sections` takes: a
 *   multi-language menu is HOS-1043's retrofit, and columns nothing reads today
 *   would be two columns of dead weight.
 * - **No `is_available` flag.** The carta has one because a seasonal dish is
 *   hidden and brought back; a menú del día that should not be shown has simply
 *   expired, and a second way to say the same thing is a second thing to keep
 *   in sync.
 *
 * The FK CASCADEs, so a deleted listing takes its specials with it.
 */
export const gastronomyDailySpecials = pgTable(
    'gastronomy_daily_specials',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** FK to the owning listing. CASCADE — a listing deletes its specials. */
        gastronomyId: uuid('gastronomy_id')
            .notNull()
            .references(() => gastronomies.id, { onDelete: 'cascade' }),
        /** The dish, as the venue announces it. e.g. "Milanesa a la napolitana con puré". */
        title: text('title').notNull(),
        /** Optional detail — what comes with it, how it is served. */
        description: text('description'),
        /**
         * Price in CENTAVOS, per the platform's money rule (integer, never
         * `numeric`/float). Nullable, and the nullability is the feature — the
         * same one `gastronomy_menu_items.price_cents` states: a special
         * announced as "consultar" is ordinary, and a zero would publish a free
         * dish.
         */
        priceCents: integer('price_cents'),
        /**
         * First day the special is shown, INCLUSIVE.
         *
         * @see the file docblock for why this is a `date` and against which
         *   day it is compared.
         */
        validFrom: date('valid_from').notNull(),
        /**
         * Last day the special is shown, INCLUSIVE — so a one-day special has
         * `valid_until = valid_from` rather than the day after, which is what a
         * half-open window would need and what every off-by-one in this repo's
         * date handling has come from.
         */
        validUntil: date('valid_until').notNull(),
        /** Position among the listing's specials. NOT NULL — see `displayOrder` on the carta. */
        displayOrder: integer('display_order').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        gastronomyDailySpecials_gastronomyId_idx: index(
            'gastronomyDailySpecials_gastronomyId_idx'
        ).on(table.gastronomyId),
        /**
         * The read the public listing performs verbatim: the specials of ONE
         * listing whose window contains today, in order.
         *
         * Composite and in this column order on purpose — `gastronomy_id`
         * equality first, then the two range bounds — so the conditional read
         * that runs on every page view is served by the index instead of by a
         * scan of the listing's specials.
         */
        gastronomyDailySpecials_gastronomyId_validity_idx: index(
            'gastronomyDailySpecials_gastronomyId_validity_idx'
        ).on(table.gastronomyId, table.validFrom, table.validUntil)
    })
);

export const gastronomyDailySpecialsRelations = relations(gastronomyDailySpecials, ({ one }) => ({
    gastronomy: one(gastronomies, {
        fields: [gastronomyDailySpecials.gastronomyId],
        references: [gastronomies.id]
    })
}));

/** Type-inferred insert type for gastronomy_daily_specials rows. */
export type InsertGastronomyDailySpecial = typeof gastronomyDailySpecials.$inferInsert;
/** Type-inferred select type for gastronomy_daily_specials rows. */
export type SelectGastronomyDailySpecial = typeof gastronomyDailySpecials.$inferSelect;
