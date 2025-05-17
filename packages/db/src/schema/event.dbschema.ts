import type {
    AdminInfoType,
    ContactInfoType,
    EventDateType,
    EventPriceType,
    MediaType,
    SeoType
} from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { EventCategoryPgEnum, StatePgEnum, VisibilityPgEnum } from './enums.dbschema.js';
import { eventLocations } from './event_location.dbschema.js';
import { eventOrganizers } from './event_organizer.dbschema.js';
import { entityTagRelations } from './r_entity_tag.dbschema.js';
import { users } from './user.dbschema.js';

/**
 * events table schema
 */
export const events: ReturnType<typeof pgTable> = pgTable(
    'events',
    {
        /** Primary key */
        id: uuid('id').primaryKey().defaultRandom(),

        /** BaseEntity: internal name */
        name: text('name').notNull(),

        /** BaseEntity: display name */
        displayName: text('display_name').notNull(),

        /** URL-friendly slug */
        slug: text('slug').notNull(),

        /** Short summary */
        summary: text('summary').notNull(),

        /** Full description */
        description: text('description'),

        /** Media JSONB (images, videos, etc.) */
        media: jsonb('media').$type<MediaType>(),

        /** Event category (MUSIC, CULTURE, etc.) */
        category: EventCategoryPgEnum('category').notNull(),

        /** Date/time and recurrence JSONB */
        date: jsonb('date').$type<EventDateType>().notNull(),

        /** Author (user) reference */
        authorId: uuid('author_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),

        /** Location reference (optional) */
        locationId: uuid('location_id').references(() => eventLocations.id, {
            onDelete: 'set null'
        }),

        /** Organizer reference (optional) */
        organizerId: uuid('organizer_id').references(() => eventOrganizers.id, {
            onDelete: 'set null'
        }),

        /** Pricing rules JSONB */
        pricing: jsonb('pricing').$type<EventPriceType>(),

        /** Contact info JSONB (optional) */
        contact: jsonb('contact').$type<ContactInfoType>(),

        /** Visibility (PUBLIC, PRIVATE, etc.) */
        visibility: VisibilityPgEnum('visibility').default('PUBLIC').notNull(),

        /** SEO metadata JSONB */
        seo: jsonb('seo').$type<SeoType>(),

        /** Feature flag */
        isFeatured: boolean('is_featured').default(false).notNull(),

        /** General state */
        state: StatePgEnum('state').default('ACTIVE').notNull(),

        /** Admin metadata JSONB */
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
        /** Unique slug per event */
        uniqueSlug: uniqueIndex('events_slug_key').on(table.slug)
    })
);

/**
 * Relations for events table
 */
export const eventsRelations = relations(events, ({ one, many }) => ({
    /** Who created this event */
    createdBy: one(users),
    /** Who last updated this event */
    updatedBy: one(users),
    /** Who soft-deleted this event */
    deletedBy: one(users),

    /** Event author (host) */
    author: one(users),

    /** Event location */
    location: one(eventLocations),

    /** Event organizer */
    organizer: one(eventOrganizers),

    /** Tags applied to this event */
    tags: many(entityTagRelations)
}));
