import type { AccommodationRatingType, AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from './accommodation.dbschema.js';
import { StatePgEnum } from './enums.dbschema.js';
import { accommodationReviewRelations } from './r_accommodation_review.dbschema.js';
import { entityTagRelations } from './r_entity_tag.dbschema.js';
import { users } from './user.dbschema.js';

/**
 * accommodation_reviews table schema
 */
export const accommodationReviews: ReturnType<typeof pgTable> = pgTable('accommodation_reviews', {
    /** Primary key */
    id: uuid('id').primaryKey().defaultRandom(),

    /** BaseEntity: internal name */
    name: text('name').notNull(),

    /** BaseEntity: display name */
    displayName: text('display_name').notNull(),

    /** Optional title */
    title: text('title'),

    /** Optional content */
    content: text('content'),

    /** Rating breakdown JSON */
    rating: jsonb('rating').$type<AccommodationRatingType>().notNull(),

    /** General state (ACTIVE, INACTIVE, etc.) */
    state: StatePgEnum('state').default('ACTIVE').notNull(),

    /** Admin metadata (notes, favorite) */
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

    /** Audit & soft-delete timestamps */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});

/**
 * Relations for accommodation_reviews table
 */
export const accommodationReviewsRelations = relations(accommodationReviews, ({ one, many }) => ({
    /** Who created this review */
    createdBy: one(users),
    /** Who last updated this review */
    updatedBy: one(users),
    /** Who soft-deleted this review */
    deletedBy: one(users),

    /** Link to join table entries */
    reviewRelations: many(accommodationReviewRelations),
    /** Shortcut to the actual Accommodation entities */
    accommodations: many(accommodations, { relationName: 'r_accommodation_review' }),

    /** Tags applied to this review */
    tags: many(entityTagRelations)
}));
