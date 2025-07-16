import type { AdminInfoType, MediaType, SeoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { accommodations } from '../accommodation/accommodation.dbschema.ts';
import { destinations } from '../destination/destination.dbschema.ts';
import {
    LifecycleStatusPgEnum,
    ModerationStatusPgEnum,
    PostCategoryPgEnum,
    VisibilityPgEnum
} from '../enums.dbschema.ts';
import { events } from '../event/event.dbschema.ts';
import { rEntityTag } from '../tag/r_entity_tag.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { postSponsorships } from './post_sponsorship.dbschema.ts';

export const posts: ReturnType<typeof pgTable> = pgTable(
    'posts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        category: PostCategoryPgEnum('category').notNull(),
        title: text('title').notNull(),
        summary: text('summary').notNull(),
        content: text('content').notNull(),
        media: jsonb('media').$type<MediaType>().notNull(),
        authorId: uuid('author_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        sponsorshipId: uuid('sponsorship_id').references(() => postSponsorships.id, {
            onDelete: 'set null'
        }),
        relatedAccommodationId: uuid('related_accommodation_id').references(
            () => accommodations.id,
            {
                onDelete: 'set null'
            }
        ),
        relatedDestinationId: uuid('related_destination_id').references(() => destinations.id, {
            onDelete: 'set null'
        }),
        relatedEventId: uuid('related_event_id').references(() => events.id, {
            onDelete: 'set null'
        }),
        visibility: VisibilityPgEnum('visibility').notNull().default('PUBLIC'),
        isNews: boolean('is_news').notNull().default(false),
        isFeaturedInWebsite: boolean('is_featured_in_website').notNull().default(false),

        expiresAt: timestamp('expires_at', { withTimezone: true }),
        likes: integer('likes').notNull().default(0),
        comments: integer('comments').notNull().default(0),
        shares: integer('shares').notNull().default(0),

        isFeatured: boolean('is_featured').notNull().default(false),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('PENDING'),
        seo: jsonb('seo').$type<SeoType>()
    },
    (table) => ({
        posts_isNews_idx: index('posts_isNews_idx').on(table.isNews),
        posts_visibility_idx: index('posts_visibility_idx').on(table.visibility),
        posts_lifecycle_idx: index('posts_lifecycle_idx').on(table.lifecycleState),
        posts_relatedAccommodationId_idx: index('posts_relatedAccommodationId_idx').on(
            table.relatedAccommodationId
        ),
        posts_relatedDestinationId_idx: index('posts_relatedDestinationId_idx').on(
            table.relatedDestinationId
        ),
        posts_relatedEventId_idx: index('posts_relatedEventId_idx').on(table.relatedEventId)
    })
);

export const postsRelations = relations(posts, ({ one, many }) => ({
    author: one(users, {
        fields: [posts.authorId],
        references: [users.id]
    }),
    createdBy: one(users, {
        fields: [posts.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [posts.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [posts.deletedById],
        references: [users.id]
    }),
    relatedAccommodation: one(accommodations, {
        fields: [posts.relatedAccommodationId],
        references: [accommodations.id]
    }),
    relatedDestination: one(destinations, {
        fields: [posts.relatedDestinationId],
        references: [destinations.id]
    }),
    relatedEvent: one(events, {
        fields: [posts.relatedEventId],
        references: [events.id]
    }),
    sponsorship: one(postSponsorships, {
        fields: [posts.sponsorshipId],
        references: [postSponsorships.id]
    }),
    tags: many(rEntityTag)
}));
