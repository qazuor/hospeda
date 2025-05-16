import type {
    AccommodationPriceType,
    AccommodationRatingType,
    AdminInfoType,
    ContactInfoType,
    ExtraInfoType,
    FullLocationType,
    MediaType,
    ScheduleType,
    SeoType,
    SocialNetworkType
} from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { accommodationAmenities } from './accommodation_amenity.dbschema';
import { accommodationFeatures } from './accommodation_feature.dbschema';
import { destinations } from './destination.dbschema';
import { AccommodationTypePgEnum, StatePgEnum } from './enums.dbschema';
import { entityTagRelations } from './r_entity_tag.dbschema';
import { users } from './user.dbschema';

/**
 * accommodations table schema
 */
export const accommodations = pgTable(
    'accommodations',
    {
        /** Primary key */
        id: uuid('id').primaryKey().defaultRandom(),

        /** BaseEntity: internal name */
        name: text('name').notNull(),

        /** BaseEntity: display name */
        displayName: text('display_name').notNull(),

        /** URL-friendly slug */
        slug: text('slug').notNull(),

        /** Type of accommodation (APARTMENT, HOUSE, etc.) */
        type: AccommodationTypePgEnum('type').notNull(),

        /** Full description */
        description: text('description').notNull(),

        /** Contact info JSONB */
        contactInfo: jsonb('contact_info').$type<ContactInfoType>(),

        /** Social networks JSONB */
        socialNetworks: jsonb('social_networks').$type<SocialNetworkType[]>(),

        /** Price details JSONB */
        price: jsonb('price').$type<AccommodationPriceType>(),

        /** Destination reference */
        destinationId: uuid('destination_id')
            .notNull()
            .references(() => destinations.id, { onDelete: 'cascade' }),

        /** Owner (user) reference */
        ownerId: uuid('owner_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),

        /** Location JSONB */
        location: jsonb('location').$type<FullLocationType>(),

        /** Media JSONB */
        media: jsonb('media').$type<MediaType>(),

        /** Rating summary JSONB */
        rating: jsonb('rating').$type<AccommodationRatingType>(),

        /** Schedule JSONB */
        schedule: jsonb('schedule').$type<ScheduleType>(),

        /** Extra info JSONB */
        extraInfo: jsonb('extra_info').$type<ExtraInfoType>(),

        /** Whether to feature this listing */
        isFeatured: boolean('is_featured').default(false).notNull(),

        /** SEO metadata JSONB */
        seo: jsonb('seo').$type<SeoType>(),

        /** General state */
        state: StatePgEnum('state').default('ACTIVE').notNull(),

        /** Admin metadata JSONB */
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
    },
    (table) => ({
        /** Unique slug per listing */
        uniqueSlug: uniqueIndex('accommodations_slug_key').on(table.slug)
    })
);

/**
 * Relations for accommodations table
 */
export const accommodationsRelations = relations(accommodations, ({ one, many }) => ({
    /** Who created */
    createdBy: one(users),
    /** Who updated */
    updatedBy: one(users),
    /** Who soft-deleted */
    deletedBy: one(users),

    /** Owner of the listing */
    owner: one(users),

    /** Destination of the listing */
    destination: one(destinations),

    /** Amenities for this accommodation */
    amenities: many(accommodationAmenities),

    /** Features for this accommodation */
    features: many(accommodationFeatures),

    /** Tags applied to this accommodation */
    tags: many(entityTagRelations)
}));
