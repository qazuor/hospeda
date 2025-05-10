import { EventCategoryEnum, StateEnum, VisibilityEnum } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, date, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { enumToTuple } from '../utils/db-utils';
import { users } from './users';

/**
 * Table: events
 * Public-facing event listings: concerts, workshops, festivals, etc.
 */
export const events = pgTable('events', {
    id: uuid('id').primaryKey().defaultRandom(),

    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    summary: text('summary'),

    category: text('category', {
        enum: enumToTuple(EventCategoryEnum)
    }).notNull(),

    media: jsonb('media').notNull(),
    tags: jsonb('tags').default([]),

    location: jsonb('location').notNull(),
    date: jsonb('date').notNull(),
    pricing: jsonb('pricing'),
    organizer: jsonb('organizer'),
    contact: jsonb('contact'),

    authorId: uuid('author_id').notNull(),
    isFeatured: boolean('is_featured').default(false),
    visibility: text('visibility', {
        enum: enumToTuple(VisibilityEnum)
    }).notNull(),

    seo: jsonb('seo'),
    adminInfo: jsonb('admin_info'),
    state: text('state', {
        enum: enumToTuple(StateEnum)
    })
        .default(StateEnum.ACTIVE)
        .notNull(),

    createdAt: date('created_at').defaultNow().notNull(),
    updatedAt: date('updated_at').defaultNow().notNull(),
    deletedAt: date('deleted_at')
});

/**
 * Relations: events → users (author)
 */
export const eventRelations = relations(events, ({ one }) => ({
    author: one(users, {
        fields: [events.authorId],
        references: [users.id]
    })
}));
