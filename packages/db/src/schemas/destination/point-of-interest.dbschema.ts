import type { AdminInfoType, I18nText, TranslationMeta } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import {
    boolean,
    doublePrecision,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum, PointOfInterestTypePgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { rDestinationPointOfInterest } from './r_destination_point_of_interest.dbschema.ts';
import { rPoiCategory } from './r_poi_category.dbschema.ts';

/**
 * Points of interest — landmarks associated with one or more destinations
 * (M2M via `r_destination_point_of_interest`, HOS-113 OQ-1).
 *
 * HOS-138 (POI v2): the model moved from HOS-113's closed, seed-only,
 * i18n-by-slug catalog to admin-editable multilang content. Display names now
 * resolve from `nameI18n` (SPEC-212 `I18nText`) as the single source — the
 * legacy `@repo/i18n` `destinations.poiNames.<slug>` keys were removed in
 * HOS-138 (see spec §6.1). Coordinates (`lat`/`long`) are nullable — a
 * coordinate-less POI is valid, not an error (§6.2). `type` is
 * deprecated-transitional pending the HOS-139 category model.
 */
export const pointsOfInterest = pgTable(
    'points_of_interest',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        // HOS-138: nullable coordinates — 78% of the v2 dataset has no coords
        // yet (geocoding is a separate enrichment pipeline). Consumers must treat
        // null lat/long as "no coordinate, not an error" (see spec §6.2).
        lat: doublePrecision('lat'),
        long: doublePrecision('long'),
        /**
         * @deprecated HOS-138 marks `type` deprecated-transitional. The source of
         * truth for a POI's category moves to the M2M category model in HOS-139;
         * this column stays fully functional (kept in sync from the primary
         * category by HOS-139) until every consumer migrates. Do not build new
         * logic on `type` — use the category relation instead once HOS-139 lands.
         */
        type: PointOfInterestTypePgEnum('type').notNull(),
        icon: text('icon'),
        description: text('description'),
        // HOS-138 / SPEC-212: I18nText columns for multi-language content.
        // POI never had a plain `name` column (HOS-113 was i18n-by-slug), so
        // `nameI18n` is the sole name source going forward; `descriptionI18n`
        // co-exists with the legacy plain `description` column (fallback),
        // mirroring `destinations` exactly.
        nameI18n: jsonb('name_i18n').$type<I18nText>(),
        descriptionI18n: jsonb('description_i18n').$type<I18nText>(),
        translationMeta: jsonb('translation_meta').$type<TranslationMeta>().default({}),
        // HOS-138: v2 content columns.
        address: text('address'),
        keywords: text('keywords').array(),
        hasOwnPage: boolean('has_own_page').notNull().default(false),
        // HOS-138: editorial curation metadata (dedicated indexed columns rather
        // than `adminInfo` jsonb, so a correction pipeline can scan `verified`).
        verified: boolean('verified').notNull().default(false),
        verifiedAt: timestamp('verified_at', { withTimezone: true }),
        source: text('source'),
        notes: text('notes'),
        isBuiltin: boolean('is_builtin').notNull().default(false),
        isFeatured: boolean('is_featured').notNull().default(false),
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
        pointsOfInterest_slug_idx: index('pointsOfInterest_slug_idx').on(table.slug),
        pointsOfInterest_isFeatured_idx: index('pointsOfInterest_isFeatured_idx').on(
            table.isFeatured
        ),
        pointsOfInterest_lifecycleState_idx: index('pointsOfInterest_lifecycleState_idx').on(
            table.lifecycleState
        ),
        pointsOfInterest_type_idx: index('pointsOfInterest_type_idx').on(table.type),
        pointsOfInterest_verified_idx: index('pointsOfInterest_verified_idx').on(table.verified)
    })
);

export const pointsOfInterestRelations = relations(pointsOfInterest, ({ many }) => ({
    destinations: many(rDestinationPointOfInterest),
    categories: many(rPoiCategory)
}));

export type InsertPointOfInterest = typeof pointsOfInterest.$inferInsert;
export type SelectPointOfInterest = typeof pointsOfInterest.$inferSelect;
