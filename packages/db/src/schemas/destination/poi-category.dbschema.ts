import type { AdminInfoType, I18nText, TranslationMeta } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { rPoiCategory } from './r_poi_category.dbschema.ts';

/**
 * POI categories — editable, admin-owned taxonomy catalog for
 * `points_of_interest` (HOS-139, replacing the single closed `type` enum).
 *
 * Unlike `points_of_interest.type` (a closed enum whose labels resolve
 * through `@repo/i18n`, i18n-by-slug), rows here carry their own `nameI18n`
 * content directly, mirroring `destinations.nameI18n` — a content operator
 * can create/rename a category through the same `I18nTextField.tsx` flow
 * without touching an i18n string file or redeploying (spec §6.1).
 *
 * `slug` is a machine identifier only (e.g. `winery`, `gastronomy`) — NOT an
 * i18n key, unlike HOS-113's `type` precedent.
 */
export const poiCategories = pgTable(
    'poi_categories',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        // HOS-139 §6.1: data-driven multilang content, not i18n-by-slug.
        nameI18n: jsonb('name_i18n').$type<I18nText>().notNull(),
        translationMeta: jsonb('translation_meta').$type<TranslationMeta>().default({}),
        icon: text('icon'),
        displayWeight: integer('display_weight').notNull().default(50),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        poiCategories_slug_idx: index('poiCategories_slug_idx').on(table.slug),
        poiCategories_lifecycleState_idx: index('poiCategories_lifecycleState_idx').on(
            table.lifecycleState
        )
    })
);

export const poiCategoriesRelations = relations(poiCategories, ({ many }) => ({
    pointsOfInterest: many(rPoiCategory)
}));

export type InsertPoiCategory = typeof poiCategories.$inferInsert;
export type SelectPoiCategory = typeof poiCategories.$inferSelect;
