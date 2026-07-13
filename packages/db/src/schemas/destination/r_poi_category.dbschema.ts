import { relations, sql } from 'drizzle-orm';
import { boolean, index, pgTable, primaryKey, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { poiCategories } from './poi-category.dbschema.ts';
import { pointsOfInterest } from './point-of-interest.dbschema.ts';

/**
 * Point of Interest <-> Category join table (M2M, HOS-139 §6.2). A POI can
 * belong to several categories (e.g. a winery that is also a restaurant);
 * exactly one of them is marked `isPrimary`. Mirrors
 * `r_destination_point_of_interest`'s composite-PK + dual-index shape, with
 * one addition: the `isPrimary` per-POI invariant.
 */
export const rPoiCategory = pgTable(
    'r_poi_category',
    {
        pointOfInterestId: uuid('point_of_interest_id')
            .notNull()
            .references(() => pointsOfInterest.id, { onDelete: 'cascade' }),
        categoryId: uuid('category_id')
            .notNull()
            .references(() => poiCategories.id, { onDelete: 'cascade' }),
        isPrimary: boolean('is_primary').notNull().default(false)
    },
    (table) => ({
        pk: primaryKey({ columns: [table.pointOfInterestId, table.categoryId] }),
        pointOfInterestId_categoryId_idx: index('pointOfInterestId_categoryId_idx').on(
            table.pointOfInterestId,
            table.categoryId
        ),
        categoryId_idx: index('r_poi_category_categoryId_idx').on(table.categoryId),
        /**
         * Single-primary invariant (spec §6.2): a partial unique index
         * guarantees at most one `isPrimary = true` row per POI at the DB
         * level. A POI with zero category rows, or with category rows but
         * none marked primary, is not caught here (a "least one primary once
         * non-empty" rule is enforced at the service layer instead — see
         * spec §6.2's alternatives-considered discussion).
         */
        r_poi_category_primary_idx: uniqueIndex('r_poi_category_primary_idx')
            .on(table.pointOfInterestId)
            .where(sql`is_primary = true`)
    })
);

export const rPoiCategoryRelations = relations(rPoiCategory, ({ one }) => ({
    pointOfInterest: one(pointsOfInterest, {
        fields: [rPoiCategory.pointOfInterestId],
        references: [pointsOfInterest.id]
    }),
    category: one(poiCategories, {
        fields: [rPoiCategory.categoryId],
        references: [poiCategories.id]
    })
}));

export type InsertRPoiCategory = typeof rPoiCategory.$inferInsert;
export type SelectRPoiCategory = typeof rPoiCategory.$inferSelect;
