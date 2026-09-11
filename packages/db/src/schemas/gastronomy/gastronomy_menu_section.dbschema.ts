import type { I18nText } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { gastronomies } from './gastronomy.dbschema.ts';
import { gastronomyMenuItems } from './gastronomy_menu_item.dbschema.ts';

/**
 * `gastronomy_menu_sections` — the course headings of a venue's real menu (HOS-895).
 *
 * ## Why a table and not JSONB
 *
 * A menu is read on EVERY visit to the public listing, and the read is a join
 * plus an order-by — not a scan. The same reasoning the platform applies to any
 * per-read collection: JSONB would force the reader to pull and parse the whole
 * document to render a section, and would make the per-dish work HOS-1045
 * (photos per dish) and HOS-1054's per-dish allergens need impossible to hang
 * off a stable id. A section row has a UUID; a JSONB array index does not.
 *
 * ## `name_i18n` / `description_i18n` (HOS-1043)
 *
 * Additive nullable `I18nText` columns, retrofitted exactly as HOS-117
 * retrofitted `gastronomy_faqs.question_i18n`/`answer_i18n`: the legacy
 * `name`/`description` columns stay the `es` fallback source and the only
 * value ever written by an owner without the `multilingual_gastronomy_menu`
 * entitlement. Gated on WRITE (`PUT .../menu` refuses a document carrying
 * translations unless the plan grants the key) and on the PUBLIC read (the
 * public detail route withholds them live, the same mechanism
 * `MANAGE_GASTRONOMY_MENU` and `MENU_ITEM_PHOTOS` use) — never on the owner's
 * own protected read, which sees everything it typed regardless of plan.
 *
 * ## What this table deliberately does NOT carry
 *
 * - **No moderation state.** A menu section is owner-authored text on a listing
 *   that already carries its own `moderation_state`; a second, finer-grained
 *   moderation surface is not part of this issue.
 *
 * Structure mirrors `gastronomy_faqs`: FK CASCADE, `display_order` with the
 * NULLS-LAST read convention, and the full audit block.
 *
 * @see packages/db/src/schemas/gastronomy/gastronomy_menu_item.dbschema.ts
 */
export const gastronomyMenuSections = pgTable(
    'gastronomy_menu_sections',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * FK to the owning listing. ON DELETE CASCADE so the database — not a
         * check someone has to remember to write — removes the menu when the
         * listing is hard-deleted. Same choice `gastronomy_media` makes.
         */
        gastronomyId: uuid('gastronomy_id')
            .notNull()
            .references(() => gastronomies.id, { onDelete: 'cascade' }),
        /** Heading of the course, e.g. "Entradas", "Principales", "Postres". */
        name: text('name').notNull(),
        /** Optional blurb under the heading. Nullable — most sections have none. */
        description: text('description'),
        /**
         * Localized heading (HOS-1043). Additive/nullable: `name` remains the
         * `es` fallback source. See the file docblock.
         */
        nameI18n: jsonb('name_i18n').$type<I18nText>(),
        /**
         * Localized blurb (HOS-1043). Additive/nullable: `description` remains
         * the `es` fallback source. See the file docblock.
         */
        descriptionI18n: jsonb('description_i18n').$type<I18nText>(),
        /**
         * Position of the section within the menu. NOT NULL with no default:
         * the whole menu is written in one transaction by
         * `replaceGastronomyMenu`, which assigns the index of every section, so
         * there is no path that inserts a section without knowing its place.
         */
        displayOrder: integer('display_order').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        gastronomyMenuSections_gastronomyId_idx: index(
            'gastronomyMenuSections_gastronomyId_idx'
        ).on(table.gastronomyId),
        /**
         * The read the public listing performs verbatim: every section of ONE
         * listing, in order. Composite so the order-by is served by the index
         * rather than by a sort of the section rows.
         */
        gastronomyMenuSections_gastronomyId_displayOrder_idx: index(
            'gastronomyMenuSections_gastronomyId_displayOrder_idx'
        ).on(table.gastronomyId, table.displayOrder)
    })
);

export const gastronomyMenuSectionsRelations = relations(
    gastronomyMenuSections,
    ({ one, many }) => ({
        gastronomy: one(gastronomies, {
            fields: [gastronomyMenuSections.gastronomyId],
            references: [gastronomies.id]
        }),
        items: many(gastronomyMenuItems)
    })
);

/** Type-inferred insert type for gastronomy_menu_sections rows. */
export type InsertGastronomyMenuSection = typeof gastronomyMenuSections.$inferInsert;
/** Type-inferred select type for gastronomy_menu_sections rows. */
export type SelectGastronomyMenuSection = typeof gastronomyMenuSections.$inferSelect;
