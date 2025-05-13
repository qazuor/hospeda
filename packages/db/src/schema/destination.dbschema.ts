import type { AdminInfoType, BaseLocationType, MediaType, SeoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { StatePgEnum, VisibilityPgEnum } from './enums.dbschema';
import { entityTagRelations } from './r_entity_tag.dbschema';
import { users } from './user.dbschema';

/**
 * destinations table schema
 */
export const destinations: ReturnType<typeof pgTable> = pgTable(
    'destinations',
    {
        /** Primary key */
        id: uuid('id').primaryKey().defaultRandom(),

        /** BaseEntity: internal name */
        name: text('name').notNull(),

        /** BaseEntity: display name */
        displayName: text('display_name').notNull(),

        /** URL-friendly slug */
        slug: text('slug').notNull(),

        /** Short summary of the destination */
        summary: text('summary').notNull(),

        /** Full description */
        description: text('description').notNull(),

        /** Media JSON blob (images, gallery, etc.) */
        media: jsonb('media').$type<MediaType>(),

        /** Whether to feature this destination on the homepage */
        isFeatured: boolean('is_featured').default(false).notNull(),

        /** Public / draft / private */
        visibility: VisibilityPgEnum('visibility').default('PUBLIC').notNull(),

        /** SEO metadata */
        seo: jsonb('seo').$type<SeoType>(),

        /** Location info JSON */
        location: jsonb('location').$type<BaseLocationType>().notNull(),

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
        /** Enforce unique slug per destination */
        uniqueSlug: uniqueIndex('destinations_slug_key').on(table.slug)
    })
);

/**
 * Relations for destinations table
 */
export const destinationsRelations = relations(destinations, ({ one, many }) => ({
    /** Who created this destination */
    createdBy: one(users),
    /** Who last updated this destination */
    updatedBy: one(users),
    /** Who soft-deleted this destination */
    deletedBy: one(users),

    /** All tag relations for this destination */
    tags: many(entityTagRelations)
}));
