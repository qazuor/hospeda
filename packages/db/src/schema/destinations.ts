import { StateEnum, VisibilityEnum } from '@repo/types';
import { boolean, date, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { enumToTuple } from '../utils/db-utils';

/**
 * Table: destinations
 * Stores tourist destination information.
 */
export const destinations = pgTable('destinations', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    longName: text('long_name').notNull(),
    slug: text('slug').notNull().unique(),
    summary: text('summary').notNull(),
    description: text('description').notNull(),
    media: jsonb('media').notNull(),
    tags: jsonb('tags').default([]),
    isFeatured: boolean('is_featured').default(false),
    visibility: text('visibility', { enum: enumToTuple(VisibilityEnum) }).notNull(),
    seo: jsonb('seo'),
    adminInfo: jsonb('admin_info'),
    rating: jsonb('rating'),
    reviews: jsonb('reviews').default([]),
    location: jsonb('location').notNull(),
    attractions: jsonb('attractions').default([]),

    state: text('state', { enum: enumToTuple(StateEnum) })
        .default(StateEnum.ACTIVE)
        .notNull(),

    createdAt: date('created_at').defaultNow().notNull(),
    updatedAt: date('updated_at').defaultNow().notNull(),
    deletedAt: date('deleted_at')
});
