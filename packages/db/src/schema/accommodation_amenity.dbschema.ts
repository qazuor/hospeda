import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import {
    boolean,
    doublePrecision,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { accommodations } from './accommodation.dbschema';
import { AmenitiesTypePgEnum, StatePgEnum } from './enums.dbschema';
import { accommodationAmenityRelations } from './r_accommodation_amenity.dbschema';
import { entityTagRelations } from './r_entity_tag.dbschema';
import { users } from './user.dbschema';

/**
 * accommodation_amenities table schema
 */
export const accommodationAmenities: ReturnType<typeof pgTable> = pgTable(
    'accommodation_amenities',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),
        displayName: text('display_name').notNull(),
        description: text('description'),
        icon: text('icon'),
        isBuiltin: boolean('is_builtin').notNull(),
        isOptional: boolean('is_optional').notNull(),
        additionalCost: jsonb('additional_cost'),
        additionalCostPercent: doublePrecision('additional_cost_percent'),
        type: AmenitiesTypePgEnum('type').notNull(),
        state: StatePgEnum('state').default('ACTIVE').notNull(),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    }
);

/**
 * Relations for accommodation_amenities table
 */
export const accommodationAmenitiesRelations = relations(
    accommodationAmenities,
    ({ one, many }) => ({
        createdBy: one(users, {
            fields: [accommodationAmenities.createdById],
            references: [users.id]
        }),
        updatedBy: one(users, {
            fields: [accommodationAmenities.updatedById],
            references: [users.id]
        }),
        deletedBy: one(users, {
            fields: [accommodationAmenities.deletedById],
            references: [users.id]
        }),
        amenityRelations: many(accommodationAmenityRelations),
        accommodations: many(accommodations, { relationName: 'r_accommodation_amenity' }),
        tags: many(entityTagRelations)
    })
);
