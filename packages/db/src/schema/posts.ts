import { ClientTypeEnum, PostCategoryEnum, StateEnum, VisibilityEnum } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, date, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { enumToTuple } from '../utils/db-utils';
import { users } from './users';

/**
 * Table: post_sponsors
 * A business or individual that pays to sponsor a post.
 */
export const postSponsors = pgTable('post_sponsors', {
    id: uuid('id').primaryKey().defaultRandom(),

    type: text('type', { enum: enumToTuple(ClientTypeEnum) }).notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    logo: jsonb('logo'),
    social: jsonb('social'),
    contact: jsonb('contact'),
    tags: jsonb('tags').default([]),
    state: text('state', { enum: enumToTuple(StateEnum) })
        .default(StateEnum.ACTIVE)
        .notNull(),
    adminInfo: jsonb('admin_info'),

    createdAt: date('created_at').defaultNow().notNull(),
    updatedAt: date('updated_at').defaultNow().notNull(),
    deletedAt: date('deleted_at')
});

/**
 * Table: post_sponsorships
 * Specific sponsorship record for a post, linked to a sponsor.
 */
export const postSponsorships = pgTable('post_sponsorships', {
    id: uuid('id').primaryKey().defaultRandom(),

    sponsorId: uuid('sponsor_id').notNull(),
    description: text('description').notNull(),
    message: text('message'),
    tags: jsonb('tags').default([]),
    paid: jsonb('paid').notNull(),
    paidAt: date('paid_at'),
    fromDate: date('from_date'),
    toDate: date('to_date'),
    isHighlighted: boolean('is_highlighted').default(false),
    adminInfo: jsonb('admin_info'),

    createdAt: date('created_at').defaultNow().notNull(),
    updatedAt: date('updated_at').defaultNow().notNull(),
    deletedAt: date('deleted_at')
});

/**
 * Table: posts
 * Blog post, news, or promoted article published on the platform.
 */
export const posts = pgTable('posts', {
    id: uuid('id').primaryKey().defaultRandom(),

    slug: text('slug').notNull().unique(),
    category: text('category', { enum: enumToTuple(PostCategoryEnum) }).notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    content: text('content').notNull(),

    media: jsonb('media').notNull(),
    tags: jsonb('tags').default([]),
    authorId: uuid('author_id').notNull(),
    isFeatured: boolean('is_featured').default(false),
    visibility: text('visibility', { enum: enumToTuple(VisibilityEnum) }).notNull(),

    seo: jsonb('seo'),
    adminInfo: jsonb('admin_info'),
    sponsorship: jsonb('sponsorship'),
    expiresAt: date('expires_at'),

    createdAt: date('created_at').defaultNow().notNull(),
    updatedAt: date('updated_at').defaultNow().notNull(),
    deletedAt: date('deleted_at')
});

/**
 * Relations: posts → users
 */
export const postRelations = relations(posts, ({ one }) => ({
    author: one(users, {
        fields: [posts.authorId],
        references: [users.id]
    })
}));

/**
 * Relations: postSponsorships → postSponsors
 */
export const postSponsorshipRelations = relations(postSponsorships, ({ one }) => ({
    sponsor: one(postSponsors, {
        fields: [postSponsorships.sponsorId],
        references: [postSponsors.id]
    })
}));
