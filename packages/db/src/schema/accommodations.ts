import { AccommodationTypeEnum, type RatingType, StateEnum } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, date, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { destinations } from 'src/schema/destinations';
import { enumToTuple } from '../utils/db-utils';
import { users } from './users';

/**
 * Table: accommodations
 * Main public listing of lodging offered by hosts.
 */
export const accommodations = pgTable('accommodations', {
    id: uuid('id').primaryKey().defaultRandom(),

    slug: text('slug').notNull().unique(),
    type: text('type', { enum: enumToTuple(AccommodationTypeEnum) }).notNull(),
    state: text('state', { enum: enumToTuple(StateEnum) })
        .default(StateEnum.ACTIVE)
        .notNull(),

    description: text('description').notNull(),

    contactInfo: jsonb('contact_info').notNull(),
    socialNetworks: jsonb('social_networks'),
    price: jsonb('price').notNull(),
    location: jsonb('location').notNull(),
    features: jsonb('features').notNull(),
    amenities: jsonb('amenities').notNull(),
    media: jsonb('media').notNull(),
    rating: jsonb('rating')
        .$type<RatingType>()
        .default(null as unknown as RatingType),
    reviews: jsonb('reviews').default([]),
    schedule: jsonb('schedule').notNull(),
    extraInfo: jsonb('extra_info').notNull(),

    isFeatured: boolean('is_featured').default(false),
    tags: jsonb('tags').default([]),
    seo: jsonb('seo'),
    adminInfo: jsonb('admin_info'),

    ownerId: uuid('owner_id').notNull(),
    destinationId: uuid('destination_id').notNull(),

    createdAt: date('created_at').defaultNow().notNull(),
    updatedAt: date('updated_at').defaultNow().notNull(),
    deletedAt: date('deleted_at')
});

/**
 * Table: accommodation_faqs
 * Frequently asked questions for an accommodation.
 */
export const accommodationFaqs = pgTable('accommodation_faqs', {
    id: uuid('id').primaryKey().defaultRandom(),
    accommodationId: uuid('accommodation_id').notNull(),

    question: text('question').notNull(),
    answer: text('answer').notNull(),
    adminInfo: jsonb('admin_info'),
    state: text('state', { enum: enumToTuple(StateEnum) })
        .default(StateEnum.ACTIVE)
        .notNull(),

    createdAt: date('created_at').defaultNow().notNull(),
    updatedAt: date('updated_at').defaultNow().notNull(),
    deletedAt: date('deleted_at')
});

/**
 * Table: accommodation_ia_data
 * AI-generated insights or summaries linked to a listing.
 */
export const accommodationIaData = pgTable('accommodation_ia_data', {
    id: uuid('id').primaryKey().defaultRandom(),
    accommodationId: uuid('accommodation_id').notNull(),

    title: text('title').notNull(),
    content: text('content').notNull(),
    adminInfo: jsonb('admin_info'),
    state: text('state', { enum: enumToTuple(StateEnum) })
        .default(StateEnum.ACTIVE)
        .notNull(),

    createdAt: date('created_at').defaultNow().notNull(),
    updatedAt: date('updated_at').defaultNow().notNull(),
    deletedAt: date('deleted_at')
});

/**
 * Relations: accommodations → users (owner), faqs, iaData
 */
export const accommodationRelations = relations(accommodations, ({ one, many }) => ({
    owner: one(users, {
        fields: [accommodations.ownerId],
        references: [users.id]
    }),
    destination: one(destinations, {
        fields: [accommodations.destinationId],
        references: [destinations.id]
    }),
    faqs: many(accommodationFaqs),
    iaData: many(accommodationIaData)
}));

export const accommodationFaqRelations = relations(accommodationFaqs, ({ one }) => ({
    accommodation: one(accommodations, {
        fields: [accommodationFaqs.accommodationId],
        references: [accommodations.id]
    })
}));

export const accommodationIaDataRelations = relations(accommodationIaData, ({ one }) => ({
    accommodation: one(accommodations, {
        fields: [accommodationIaData.accommodationId],
        references: [accommodations.id]
    })
}));
