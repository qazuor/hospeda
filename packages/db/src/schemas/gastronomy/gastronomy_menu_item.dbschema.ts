import { relations } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { gastronomies } from './gastronomy.dbschema.ts';
import { gastronomyMenuSections } from './gastronomy_menu_section.dbschema.ts';

/**
 * `gastronomy_menu_items` — one dish or drink on a venue's real menu (HOS-895).
 *
 * ## Why the row exists rather than a JSONB array element
 *
 * Because the two issues queued behind this one need to point AT a dish:
 * HOS-1045 hangs photos off it and HOS-1054's allergens — today declared for
 * the whole venue — become per-dish once dishes are real. Both need a stable
 * identifier that survives the owner reordering the menu, and an array index
 * is not one. That retrofit is knowingly deferred (owner decision): this table
 * carries no allergen or photo column yet, only the id they will hang off.
 *
 * ## `gastronomy_id` is denormalized ON PURPOSE
 *
 * The item's parent is its section, and the section's parent is the listing —
 * so the listing id is reachable by a join. It is stored here anyway because
 * every read and every authorisation check starts from the LISTING, never from
 * the section: "all items of this venue" is the query the public page, the
 * editor and the ownership guard all make. Carrying the column turns each of
 * those from a two-table join into an indexed single-table read, and lets the
 * write path assert that an item's section really belongs to the listing being
 * edited without a second round trip.
 *
 * Both FKs CASCADE, so a deleted section takes its dishes with it.
 */
export const gastronomyMenuItems = pgTable(
    'gastronomy_menu_items',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** FK to the owning section. CASCADE — a section deletes its dishes. */
        sectionId: uuid('section_id')
            .notNull()
            .references(() => gastronomyMenuSections.id, { onDelete: 'cascade' }),
        /** Denormalized FK to the listing. See the file docblock for why. */
        gastronomyId: uuid('gastronomy_id')
            .notNull()
            .references(() => gastronomies.id, { onDelete: 'cascade' }),
        /** Name of the dish or drink. */
        name: text('name').notNull(),
        /** Optional description — ingredients, preparation, portion. */
        description: text('description'),
        /**
         * Price in CENTAVOS, per the platform's money rule (integer, never
         * `numeric`/float). Nullable, and the nullability is the feature: a
         * menu that says "según pesca" or "consultar" is ordinary, and forcing
         * a zero there would publish a free dish.
         *
         * No per-item currency column. Every listing is priced in ARS for the
         * Litoral market, and inventing a per-dish currency would be the first
         * place in the product where two dishes on one menu could disagree.
         */
        priceCents: integer('price_cents'),
        /**
         * Whether the dish is currently on offer. `true` by default so an
         * ordinary dish needs no thought; the flag exists so a seasonal item
         * can be hidden from the public menu without the owner deleting it and
         * retyping it next season.
         */
        isAvailable: boolean('is_available').notNull().default(true),
        /** Position within its section. NOT NULL — see the section table. */
        displayOrder: integer('display_order').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        gastronomyMenuItems_sectionId_idx: index('gastronomyMenuItems_sectionId_idx').on(
            table.sectionId
        ),
        gastronomyMenuItems_gastronomyId_idx: index('gastronomyMenuItems_gastronomyId_idx').on(
            table.gastronomyId
        ),
        /** The public read: every dish of one section, in order. */
        gastronomyMenuItems_sectionId_displayOrder_idx: index(
            'gastronomyMenuItems_sectionId_displayOrder_idx'
        ).on(table.sectionId, table.displayOrder)
    })
);

export const gastronomyMenuItemsRelations = relations(gastronomyMenuItems, ({ one }) => ({
    section: one(gastronomyMenuSections, {
        fields: [gastronomyMenuItems.sectionId],
        references: [gastronomyMenuSections.id]
    }),
    gastronomy: one(gastronomies, {
        fields: [gastronomyMenuItems.gastronomyId],
        references: [gastronomies.id]
    })
}));

/** Type-inferred insert type for gastronomy_menu_items rows. */
export type InsertGastronomyMenuItem = typeof gastronomyMenuItems.$inferInsert;
/** Type-inferred select type for gastronomy_menu_items rows. */
export type SelectGastronomyMenuItem = typeof gastronomyMenuItems.$inferSelect;
