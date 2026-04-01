import type {
    AdminInfoType,
    BaseLocationType,
    DestinationRatingInput,
    Media,
    Seo
} from '@repo/schemas';
import { relations } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
    boolean,
    index,
    integer,
    jsonb,
    numeric,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { accommodations } from '../accommodation/accommodation.dbschema.ts';
import {
    DestinationTypePgEnum,
    LifecycleStatusPgEnum,
    ModerationStatusPgEnum,
    VisibilityPgEnum
} from '../enums.dbschema.ts';
import { rEntityTag } from '../tag/r_entity_tag.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { destinationReviews } from './destination_review.dbschema.ts';
import { rDestinationAttraction } from './r_destination_attraction.dbschema.ts';

export const destinations = pgTable(
    'destinations',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        // Hierarchy fields
        parentDestinationId: uuid('parent_destination_id').references(
            (): AnyPgColumn => destinations.id,
            {
                onDelete: 'restrict'
            }
        ),
        destinationType: DestinationTypePgEnum('destination_type').notNull(),
        level: integer('level').notNull().default(0),
        path: text('path').notNull().unique(),
        pathIds: text('path_ids').notNull().default(''),
        // Entity fields
        slug: text('slug').notNull().unique(),
        name: text('name').notNull(),
        summary: text('summary').notNull(),
        description: text('description').notNull(),
        location: jsonb('location').$type<BaseLocationType>().notNull(),
        media: jsonb('media').$type<Media>().notNull(),
        isFeatured: boolean('is_featured').notNull().default(false),
        visibility: VisibilityPgEnum('visibility').notNull().default('PUBLIC'),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        reviewsCount: integer('reviews_count').notNull().default(0),
        /** Average guest rating (0.00-5.00). Drizzle mode:'number' ensures runtime JS number type. */
        averageRating: numeric('average_rating', { precision: 3, scale: 2, mode: 'number' })
            .notNull()
            .default(0),
        accommodationsCount: integer('accommodations_count').notNull().default(0),
        seo: jsonb('seo').$type<Seo>(),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('PENDING'),
        rating: jsonb('rating').$type<DestinationRatingInput>()
    },
    (table) => ({
        destinations_isFeatured_idx: index('destinations_isFeatured_idx').on(table.isFeatured),
        destinations_visibility_idx: index('destinations_visibility_idx').on(table.visibility),
        destinations_lifecycle_idx: index('destinations_lifecycle_idx').on(table.lifecycleState),
        destinations_visibility_isFeatured_idx: index('destinations_visibility_isFeatured_idx').on(
            table.visibility,
            table.isFeatured
        ),
        // Performance indexes for common query patterns
        destinations_createdById_idx: index('destinations_createdById_idx').on(table.createdById),
        destinations_deletedAt_idx: index('destinations_deletedAt_idx').on(table.deletedAt),
        destinations_moderationState_idx: index('destinations_moderationState_idx').on(
            table.moderationState
        ),
        // Hierarchy indexes
        destinations_parentDestinationId_idx: index('destinations_parentDestinationId_idx').on(
            table.parentDestinationId
        ),
        destinations_destinationType_idx: index('destinations_destinationType_idx').on(
            table.destinationType
        ),
        destinations_level_idx: index('destinations_level_idx').on(table.level),
        destinations_path_idx: index('destinations_path_idx').on(table.path),
        destinations_pathIds_idx: index('destinations_pathIds_idx').on(table.pathIds)
    })
);

export const destinationsRelations = relations(destinations, ({ one, many }) => ({
    // Self-referencing hierarchy relations
    parent: one(destinations, {
        fields: [destinations.parentDestinationId],
        references: [destinations.id],
        relationName: 'destination_hierarchy'
    }),
    children: many(destinations, {
        relationName: 'destination_hierarchy'
    }),
    // User relations
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
    // Entity relations
    accommodations: many(accommodations),
    reviews: many(destinationReviews),
    tags: many(rEntityTag),
    attractions: many(rDestinationAttraction)
}));
