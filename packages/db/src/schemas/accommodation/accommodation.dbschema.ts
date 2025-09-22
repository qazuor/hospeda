import type {
    AdminInfoType,
    ContactInfo,
    FullLocationType,
    Media,
    Seo,
    SocialNetwork
} from '@repo/schemas';
import { relations } from 'drizzle-orm';
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
import { destinations } from '../destination/destination.dbschema.ts';
import {
    AccommodationTypePgEnum,
    LifecycleStatusPgEnum,
    ModerationStatusPgEnum,
    VisibilityPgEnum
} from '../enums.dbschema.ts';
import { rEntityTag } from '../tag/r_entity_tag.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { accommodationFaqs } from './accommodation_faq.dbschema.ts';
import { accommodationIaData } from './accommodation_iaData.dbschema.ts';
import { accommodationReviews } from './accommodation_review.dbschema.ts';
import { rAccommodationAmenity } from './r_accommodation_amenity.dbschema.ts';
import { rAccommodationFeature } from './r_accommodation_feature.dbschema.ts';

export const accommodations: ReturnType<typeof pgTable> = pgTable(
    'accommodations',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        name: text('name').notNull(),
        summary: text('summary').notNull(),
        type: AccommodationTypePgEnum('type').notNull(),
        description: text('description').notNull(),
        contactInfo: jsonb('contact_info').$type<ContactInfo>(),
        socialNetworks: jsonb('social_networks').$type<SocialNetwork>(),
        price: jsonb('price').$type<Record<string, unknown>>(),
        location: jsonb('location').$type<FullLocationType>(),
        media: jsonb('media').$type<Media>(),
        isFeatured: boolean('is_featured').notNull().default(false),
        ownerId: uuid('owner_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        destinationId: uuid('destination_id')
            .notNull()
            .references(() => destinations.id, {
                onDelete: 'restrict'
            }),
        visibility: VisibilityPgEnum('visibility').notNull().default('PUBLIC'),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        reviewsCount: integer('reviews_count').notNull().default(0),
        averageRating: numeric('average_rating', { precision: 3, scale: 2 }).notNull().default('0'),
        seo: jsonb('seo').$type<Seo>(),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('PENDING'),
        extraInfo: jsonb('extra_info').$type<Record<string, unknown>>(),
        schedule: jsonb('schedule').$type<Record<string, unknown>>(),
        rating: jsonb('rating').$type<Record<string, unknown>>()
    },
    (table) => ({
        accommodations_isFeatured_idx: index('accommodations_isFeatured_idx').on(table.isFeatured),
        accommodations_visibility_idx: index('accommodations_visibility_idx').on(table.visibility),
        accommodations_lifecycle_idx: index('accommodations_lifecycle_idx').on(
            table.lifecycleState
        ),
        accommodations_visibility_isFeatured_idx: index(
            'accommodations_visibility_isFeatured_idx'
        ).on(table.visibility, table.isFeatured),
        accommodations_destinationId_visibility_idx: index(
            'accommodations_destinationId_visibility_idx'
        ).on(table.destinationId, table.visibility)
    })
);

export const accommodationsRelations = relations(accommodations, ({ one, many }) => ({
    owner: one(users, {
        fields: [accommodations.ownerId],
        references: [users.id]
    }),
    createdBy: one(users, {
        fields: [accommodations.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [accommodations.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [accommodations.deletedById],
        references: [users.id]
    }),
    destination: one(destinations, {
        fields: [accommodations.destinationId],
        references: [destinations.id]
    }),
    amenities: many(rAccommodationAmenity),
    features: many(rAccommodationFeature),
    reviews: many(accommodationReviews),
    faqs: many(accommodationFaqs),
    iaData: many(accommodationIaData),
    tags: many(rEntityTag)
}));
