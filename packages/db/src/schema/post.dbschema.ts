import type { AdminInfoType, MediaType, SeoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import {
    boolean,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import { accommodations } from './accommodation.dbschema.js';
import { destinations } from './destination.dbschema.js';
import { PostCategoryPgEnum, StatePgEnum, VisibilityPgEnum } from './enums.dbschema.js';
import { events } from './event.dbschema.js';
import { postSponsorships } from './post_sponsorship.dbschema.js';
import { entityTagRelations } from './r_entity_tag.dbschema.js';
import { users } from './user.dbschema.js';

/**
 * posts table schema
 */
export const posts: ReturnType<typeof pgTable> = pgTable(
    'posts',
    {
        /** Primary key */
        id: uuid('id').primaryKey().defaultRandom(),

        /** BaseEntity: internal name */
        name: text('name').notNull(),

        /** BaseEntity: display name */
        displayName: text('display_name').notNull(),

        /** URL-friendly slug */
        slug: text('slug').notNull(),

        /** Post category (GASTRONOMY, TOURISM, etc.) */
        category: PostCategoryPgEnum('category').notNull(),

        /** Title of the post */
        title: text('title').notNull(),

        /** Short summary */
        summary: text('summary').notNull(),

        /** Full content */
        content: text('content').notNull(),

        /** Media JSONB */
        media: jsonb('media').$type<MediaType>(),

        /** Sponsorship reference (optional) */
        sponsorshipId: uuid('sponsorship_id').references(() => postSponsorships.id, {
            onDelete: 'set null'
        }),

        /** Related destination (optional) */
        relatedDestinationId: uuid('related_destination_id').references(() => destinations.id, {
            onDelete: 'set null'
        }),

        /** Related accommodation (optional) */
        relatedAccommodationId: uuid('related_accommodation_id').references(
            () => accommodations.id,
            { onDelete: 'set null' }
        ),

        /** Related event (optional) */
        relatedEventId: uuid('related_event_id').references(() => events.id, {
            onDelete: 'set null'
        }),

        /** Visibility (PUBLIC, DRAFT, PRIVATE) */
        visibility: VisibilityPgEnum('visibility').default('PUBLIC').notNull(),

        /** SEO metadata JSONB */
        seo: jsonb('seo').$type<SeoType>(),

        /** Flags for featuring or marking as news */
        isFeatured: boolean('is_featured').default(false).notNull(),
        isNews: boolean('is_news').default(false).notNull(),
        isFeaturedInWebsite: boolean('is_featured_in_website').default(false).notNull(),

        /** Expiration date (optional) */
        expiresAt: timestamp('expires_at', { withTimezone: true }),

        /** Engagement counters */
        likes: integer('likes').default(0).notNull(),
        comments: integer('comments').default(0).notNull(),
        shares: integer('shares').default(0).notNull(),

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
        /** Unique slug per post */
        uniqueSlug: uniqueIndex('posts_slug_key').on(table.slug)
    })
);

/**
 * Relations for posts table
 */
export const postsRelations = relations(posts, ({ one, many }) => ({
    /** Who created the post */
    createdBy: one(users),
    /** Who last updated the post */
    updatedBy: one(users),
    /** Who soft-deleted the post */
    deletedBy: one(users),

    /** Sponsorship details */
    sponsorship: one(postSponsorships),
    /** Related destination */
    relatedDestination: one(destinations),
    /** Related accommodation */
    relatedAccommodation: one(accommodations),
    /** Related event */
    relatedEvent: one(events),

    /** Tags applied to this post */
    tags: many(entityTagRelations)
}));
