import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { destinations } from './destination.dbschema.js';
import { StatePgEnum } from './enums.dbschema.js';
import { destinationAttractionRelations } from './r_destination_attraction.dbschema.js';
import { entityTagRelations } from './r_entity_tag.dbschema.js';
import { users } from './user.dbschema.js';

/**
 * destination_attractions table schema
 */
export const destinationAttractions: ReturnType<typeof pgTable> = pgTable(
    'destination_attractions',
    {
        /** Primary key */
        id: uuid('id').primaryKey().defaultRandom(),

        /** BaseEntity: internal name */
        name: text('name').notNull(),

        /** BaseEntity: display name */
        displayName: text('display_name').notNull(),

        /** URL-friendly slug */
        slug: text('slug').notNull(),

        /** Optional description */
        description: text('description'),

        /** Optional icon (emoji, URL, etc.) */
        icon: text('icon'),

        /** General state (ACTIVE, INACTIVE, etc.) */
        state: StatePgEnum('state').default('ACTIVE').notNull(),

        /** Admin metadata (notes, favorite) */
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

        /** Audit & soft-delete timestamps */
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
        /** Ensure each slug is unique */
        uniqueSlug: uniqueIndex('destination_attractions_slug_key').on(table.slug)
    })
);

/**
 * Relations for destination_attractions table
 */
export const destinationAttractionsRelations = relations(
    destinationAttractions,
    ({ one, many }) => ({
        /** Who created this attraction */
        createdBy: one(users),
        /** Who last updated this attraction */
        updatedBy: one(users),
        /** Who soft-deleted this attraction */
        deletedBy: one(users),

        /** Which destinations include this attraction (join table) */
        destinationRelations: many(destinationAttractionRelations),
        /** Shortcut to actual Destination objects */
        destinations: many(destinations, { relationName: 'r_destination_attraction' }),

        /** Tags applied to this attraction */
        tags: many(entityTagRelations)
    })
);
