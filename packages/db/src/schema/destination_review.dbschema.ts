import type { AdminInfoType, DestinationRatingType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { destinations } from './destination.dbschema';
import { StatePgEnum } from './enums.dbschema';
import { destinationReviewRelations } from './r_destination_review.dbschema';
import { entityTagRelations } from './r_entity_tag.dbschema';
import { users } from './user.dbschema';

/**
 * destination_reviews table schema
 */
export const destinationReviews: ReturnType<typeof pgTable> = pgTable('destination_reviews', {
    /** Primary key */
    id: uuid('id').primaryKey().defaultRandom(),

    /** BaseEntity: internal name */
    name: text('name').notNull(),

    /** BaseEntity: display name */
    displayName: text('display_name').notNull(),

    /** Optional review title */
    title: text('title'),

    /** Optional review content */
    content: text('content'),

    /** Rating JSON (breakdown by categories) */
    rating: jsonb('rating').$type<DestinationRatingType>().notNull(),

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
});

/**
 * Relations for destination_reviews table
 */
export const destinationReviewsRelations = relations(destinationReviews, ({ one, many }) => ({
    /** Who created this review */
    createdBy: one(users),
    /** Who last updated this review */
    updatedBy: one(users),
    /** Who soft-deleted this review */
    deletedBy: one(users),

    /** Which destinations this review belongs to (join table) */
    destinationRelations: many(destinationReviewRelations),
    /** Shortcut to the actual Destination entities */
    destinations: many(destinations, { relationName: 'r_destination_review' }),

    /** Tags applied to this review */
    tags: many(entityTagRelations)
}));
