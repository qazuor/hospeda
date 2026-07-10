import type { AdminInfoType } from '@repo/schemas';
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

/**
 * Points of interest — coordinate-bearing landmarks associated with one or
 * more destinations (M2M via `r_destination_point_of_interest`, HOS-113
 * OQ-1). Unlike `attractions`, POIs carry NO `name` column (HOS-113 OQ-2):
 * display names resolve via `@repo/i18n` keyed by `slug`
 * (`destinations.poiNames.<slug>`), mirroring the amenities/features
 * i18n-by-slug pattern (SPEC-266).
 */
export const pointsOfInterest = pgTable(
    'points_of_interest',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        lat: doublePrecision('lat').notNull(),
        long: doublePrecision('long').notNull(),
        type: PointOfInterestTypePgEnum('type').notNull(),
        icon: text('icon'),
        description: text('description'),
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
        pointsOfInterest_type_idx: index('pointsOfInterest_type_idx').on(table.type)
    })
);

export const pointsOfInterestRelations = relations(pointsOfInterest, ({ many }) => ({
    destinations: many(rDestinationPointOfInterest)
}));

export type InsertPointOfInterest = typeof pointsOfInterest.$inferInsert;
export type SelectPointOfInterest = typeof pointsOfInterest.$inferSelect;
