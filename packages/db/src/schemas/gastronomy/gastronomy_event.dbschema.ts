import { relations } from 'drizzle-orm';
import {
    boolean,
    date,
    index,
    integer,
    pgEnum,
    pgTable,
    text,
    time,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { gastronomies } from './gastronomy.dbschema.ts';

/**
 * How a venue event repeats (HOS-1042).
 *
 * Exactly two values, and the shortness is the design rather than a first
 * iteration of it. The owner decision (2026-09-01) was explicit: **«todos los
 * jueves» alcanza; un motor tipo iCal RRULE no**. Two values are what that
 * sentence describes —
 *
 * - `once` — a dated one-off. The Thursday of the visiting band, a closing
 *   party, a set menu for one night.
 * - `weekly` — the same weekday, every week, until the owner turns it off. The
 *   happy hour, the Tuesday deal, the Friday live music.
 *
 * ## What is deliberately NOT here
 *
 * `monthly`, `biweekly`, `daily`, an end date, an exception list, a
 * several-days-a-week set. Each of those is one more branch in the "when does
 * this next happen" computation that the public page runs on every render, and
 * none of them is the thing the issue asks for. The absent shapes are a
 * follow-up, not an oversight — and adding one later is an enum value plus a
 * branch, not a rewrite, precisely because nothing here pretends to be a
 * general recurrence engine.
 *
 * A pg enum rather than free text, on the same grounds
 * {@link GastronomyMenuFileKindPgEnum} states: the renderer switches on this
 * value, and a switch over an unconstrained column is a switch with a silent
 * default.
 */
export const GastronomyEventRecurrencePgEnum = pgEnum('gastronomy_event_recurrence_enum', [
    'once',
    'weekly'
]);

/**
 * `gastronomy_events` — the venue's OWN agenda (HOS-1042).
 *
 * Live music night, happy hour, dinner show, the Tuesday deal: things that
 * happen AT the venue and that a diner may show up for.
 *
 * ## Three things in this codebase are called "events". This is the third.
 *
 * - The platform's `events` table is the DESTINATION's agenda — a festival, a
 *   popular fiesta — curated by staff, with its own moderation, media, organizer
 *   and location. A happy hour does not belong there, and putting it there would
 *   mean either flooding a curated calendar or building a second visibility rule
 *   inside it.
 * - `GastronomyEventsCta` (HOS-1055) is the "we host YOUR event" toggle:
 *   birthdays, corporate dinners, weddings. That is the venue offering itself for
 *   hire and is free on every tier.
 * - This table is neither. It is owner-authored, tier-gated
 *   (`manage_gastronomy_events`, `gastronomy-pro` and up) content on a listing
 *   the owner already controls.
 *
 * ## Why the two recurrence shapes share ONE table
 *
 * A dated one-off and a weekly repeat differ by exactly two nullable columns
 * ({@link gastronomyEvents.date} and {@link gastronomyEvents.weekday}), and the
 * reader wants them INTERLEAVED — "what's on at this venue" is one list, sorted
 * by when it next happens, not two. Two tables would make every read a union and
 * every ordering decision a merge.
 *
 * The invariant that exactly one of the two is set for a given `recurrence` is
 * enforced by {@link GastronomyEventInputSchema} (a Zod discriminated refinement)
 * and by the service that writes the rows, NOT by a database CHECK: cross-column
 * constraints belong to the extras carril, and this one has a single writer that
 * already validates. See the schema module for the exact rule.
 *
 * ## What this table deliberately does NOT carry
 *
 * - **No i18n columns.** Same position `gastronomy_menu_sections` takes: a
 *   multi-language agenda is a retrofit when someone asks for one, not two
 *   columns nothing reads today.
 * - **No moderation state.** The parent listing carries one; a finer-grained
 *   moderation surface is not part of this issue.
 * - **No price, no capacity, no ticketing.** An agenda entry announces that
 *   something happens. Selling a seat for it is a different product.
 *
 * Structure otherwise mirrors `gastronomy_menu_sections`: FK CASCADE,
 * `display_order` assigned by the whole-document writer, and the full audit
 * block.
 *
 * @see packages/schemas/src/entities/gastronomy/subtypes/gastronomy.event.schema.ts
 */
export const gastronomyEvents = pgTable(
    'gastronomy_events',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * FK to the owning listing. ON DELETE CASCADE so the database removes
         * the agenda when the listing is hard-deleted — the same choice
         * `gastronomy_menu_sections` and `gastronomy_media` make.
         */
        gastronomyId: uuid('gastronomy_id')
            .notNull()
            .references(() => gastronomies.id, { onDelete: 'cascade' }),
        /** What the event is called, e.g. "Noche de música en vivo". */
        title: text('title').notNull(),
        /** Optional blurb. Nullable — a happy hour rarely needs a paragraph. */
        description: text('description'),
        /** Whether this entry repeats. See {@link GastronomyEventRecurrencePgEnum}. */
        recurrence: GastronomyEventRecurrencePgEnum('recurrence').notNull(),
        /**
         * The calendar day, for a `once` event. `NULL` for a `weekly` one.
         *
         * A `date` and not a `timestamp`: the time of day lives in
         * {@link gastronomyEvents.startTime}, and a venue's "Friday the 12th"
         * is a local calendar day, not an instant. Storing it as a timestamp
         * would drag the row through a timezone conversion that can only ever
         * move it to the wrong day — the exact `toISOString()` hazard that has
         * bitten date windows in this repo before.
         */
        date: date('date'),
        /**
         * The day of the week, for a `weekly` event: `0` = Sunday … `6` =
         * Saturday. `NULL` for a `once` one.
         *
         * Numeric and Sunday-based to match JavaScript's `Date#getDay()`, which
         * is what every consumer computing "is it on today" already holds. A
         * string weekday would need a map at both ends, and the two maps would
         * be free to disagree.
         */
        weekday: integer('weekday'),
        /** When it starts, local venue time, `HH:MM`. */
        startTime: time('start_time').notNull(),
        /**
         * When it ends, or `NULL` when the venue does not say.
         *
         * Nullable rather than defaulted: "de 18 a 20" and "desde las 21" are
         * both things a venue announces, and inventing an end for the second
         * would publish a claim nobody made.
         */
        endTime: time('end_time'),
        /**
         * Whether the entry is currently shown.
         *
         * Exists so a seasonal event can be parked without retyping it — the
         * winter cena show comes back every year. Not a moderation flag: only
         * the owner sets it.
         */
        isActive: boolean('is_active').default(true).notNull(),
        /**
         * Position within the agenda. NOT NULL with no default: the whole
         * agenda is written in one transaction by `replaceGastronomyEvents`,
         * which assigns the index of every entry.
         */
        displayOrder: integer('display_order').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        gastronomyEvents_gastronomyId_idx: index('gastronomyEvents_gastronomyId_idx').on(
            table.gastronomyId
        ),
        /**
         * The read the public listing performs verbatim: every entry of ONE
         * listing, in order. Composite so the order-by is served by the index
         * rather than by a sort of the event rows.
         */
        gastronomyEvents_gastronomyId_displayOrder_idx: index(
            'gastronomyEvents_gastronomyId_displayOrder_idx'
        ).on(table.gastronomyId, table.displayOrder)
    })
);

export const gastronomyEventsRelations = relations(gastronomyEvents, ({ one }) => ({
    gastronomy: one(gastronomies, {
        fields: [gastronomyEvents.gastronomyId],
        references: [gastronomies.id]
    })
}));

/** Type-inferred insert type for gastronomy_events rows. */
export type InsertGastronomyEvent = typeof gastronomyEvents.$inferInsert;
/** Type-inferred select type for gastronomy_events rows. */
export type SelectGastronomyEvent = typeof gastronomyEvents.$inferSelect;
