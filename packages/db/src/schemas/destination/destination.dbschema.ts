import type { AdminInfoType, BaseLocationType, MediaType, SeoType } from '@repo/types';
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
import {
    LifecycleStatusPgEnum,
    ModerationStatusPgEnum,
    VisibilityPgEnum
} from '../enums.dbschema.ts';
import { rEntityTag } from '../tag/r_entity_tag.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { destinationReviews } from './destination_review.dbschema.ts';
import { rDestinationAttraction } from './r_destination_attraction.dbschema.ts';

export const destinations: ReturnType<typeof pgTable> = pgTable(
    'destinations',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        name: text('name').notNull(),
        summary: text('summary').notNull(),
        description: text('description').notNull(),
        location: jsonb('location').$type<BaseLocationType>().notNull(),
        media: jsonb('media').$type<MediaType>().notNull(),
        isFeatured: boolean('is_featured').notNull().default(false),
        visibility: VisibilityPgEnum('visibility').notNull().default('PUBLIC'),
        lifecycle: LifecycleStatusPgEnum('lifecycle').notNull().default('ACTIVE'),
        reviewsCount: integer('reviews_count').notNull().default(0),
        averageRating: integer('average_rating').notNull().default(0),
        accommodationsCount: integer('accommodations_count').notNull().default(0),
        seo: jsonb('seo').$type<SeoType>(),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('PENDING')
    },
    (table) => ({
        destinations_isFeatured_idx: index('destinations_isFeatured_idx').on(table.isFeatured),
        destinations_visibility_idx: index('destinations_visibility_idx').on(table.visibility),
        destinations_lifecycle_idx: index('destinations_lifecycle_idx').on(table.lifecycle),
        destinations_visibility_isFeatured_idx: index('destinations_visibility_isFeatured_idx').on(
            table.visibility,
            table.isFeatured
        )
    })
);

export const destinationsRelations = relations(destinations, ({ one, many }) => ({
    createdBy: one(users, {
        fields: [destinations.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [destinations.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [destinations.deletedById],
        references: [users.id]
    }),
    accommodations: many(accommodations),
    reviews: many(destinationReviews),
    tags: many(rEntityTag),
    attractions: many(rDestinationAttraction)
}));
