import type { AdminInfoType, CoordinatesType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { events } from './event.dbschema';
import { entityTagRelations } from './r_entity_tag.dbschema';
import { users } from './user.dbschema';

/**
 * event_locations table schema
 */
export const eventLocations: ReturnType<typeof pgTable> = pgTable(
    'event_locations',
    {
        /** Primary key */
        id: uuid('id').primaryKey().defaultRandom(),

        /** BaseEntity “name” for this location */
        name: text('name').notNull(),

        /** Display name (e.g. “Main Plaza”) */
        displayName: text('display_name').notNull(),

        /** State/province code or name */
        state: text('state').notNull(),

        /** BaseLocation: zip/postal code */
        zipCode: text('zip_code').notNull(),

        /** BaseLocation: country */
        country: text('country').notNull(),

        /** BaseLocation: optional coordinates */
        coordinates: jsonb('coordinates').$type<CoordinatesType>(),

        /** Optional street address */
        street: text('street'),

        /** Optional house/building number */
        number: text('number'),

        /** Optional floor or level */
        floor: text('floor'),

        /** Optional apartment/suite */
        apartment: text('apartment'),

        /** Optional neighborhood/district */
        neighborhood: text('neighborhood'),

        /** Optional city name */
        city: text('city'),

        /** Optional department/region */
        deparment: text('deparment'),

        /** Optional place name (e.g. venue) */
        placeName: text('place_name'),

        /** Admin metadata (notes, favorite) */
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

        /** Audit & soft-delete */
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),

        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        updatedById: uuid('updated_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),

        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, {
            onDelete: 'set null'
        })
    },
    (table) => ({
        uniqueName: uniqueIndex('event_locations_name_key').on(table.name)
    })
);

/**
 * Relations for event_locations table
 */
export const eventLocationsRelations = relations(eventLocations, ({ one, many }) => ({
    createdBy: one(users),
    updatedBy: one(users),
    deletedBy: one(users),

    /** Events that take place at this location */
    events: many(events),

    /** Tags applied to this location */
    tags: many(entityTagRelations)
}));
