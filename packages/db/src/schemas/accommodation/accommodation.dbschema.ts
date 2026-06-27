import type {
    AccommodationLocationType,
    AdminInfoType,
    ContactInfo,
    I18nText,
    Media,
    Seo,
    SocialNetwork,
    TranslationMeta
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
import { accommodationExternalListings } from '../accommodation-external/accommodation_external_listings.dbschema.ts';
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
import { accommodationMedia } from './accommodation_media.dbschema.ts';
import { accommodationReviews } from './accommodation_review.dbschema.ts';
import { rAccommodationAmenity } from './r_accommodation_amenity.dbschema.ts';
import { rAccommodationFeature } from './r_accommodation_feature.dbschema.ts';

export const accommodations = pgTable(
    'accommodations',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        name: text('name').notNull(),
        summary: text('summary').notNull(),
        type: AccommodationTypePgEnum('type').notNull(),
        description: text('description').notNull(),
        /**
         * SPEC-187 P2-T2: rich-text (markdown) variant of the description.
         * Presence on the public payload is the ONLY signal the web client
         * uses to pick rich vs. plain rendering (FR-3b, FR-4). Absent on the
         * row = the owning host is not entitled, or the field has not been
         * filled in. Nullable on purpose: never backfilled (PD-3 keeps the
         * column add as a separate, additive migration from the P0 strip).
         * Bounded to 5000 chars at the API layer by the Zod schema in
         * `packages/schemas/src/entities/accommodation/accommodation.schema.ts`.
         */
        richDescription: text('rich_description'),
        // SPEC-212: I18nText columns for multi-language content
        nameI18n: jsonb('name_i18n').$type<I18nText>(),
        summaryI18n: jsonb('summary_i18n').$type<I18nText>(),
        descriptionI18n: jsonb('description_i18n').$type<I18nText>(),
        richDescriptionI18n: jsonb('rich_description_i18n').$type<I18nText>(),
        translationMeta: jsonb('translation_meta').$type<TranslationMeta>().default({}),
        contactInfo: jsonb('contact_info').$type<ContactInfo>(),
        socialNetworks: jsonb('social_networks').$type<SocialNetwork>(),
        price: jsonb('price').$type<Record<string, unknown>>(),
        location: jsonb('location').$type<AccommodationLocationType>(),
        media: jsonb('media').$type<Media>(),
        isFeatured: boolean('is_featured').notNull().default(false),
        /**
         * SPEC-237: master toggle — when false the public detail page hides all
         * external reputation blocks (links + review snippets) regardless of
         * individual listing showLink / showReviews settings. Defaults to false
         * so that the feature ships dark and the host opts in explicitly.
         */
        showExternalReputation: boolean('show_external_reputation').notNull().default(false),
        // Denormalized flag (SPEC-143 #29): true when the owner's subscription is
        // paused WITH service suspension. Public reads filter it out and the
        // accommodation write path rejects edits while true. Canonical source is
        // users.service_suspended; this column is the hot-path denormalization so
        // public queries do not join users. Flipped in bulk on pause/resume.
        ownerSuspended: boolean('owner_suspended').notNull().default(false),
        // SPEC-167: true when this accommodation was restricted by the downgrade
        // remediation flow (host exceeded their new plan's MAX_ACCOMMODATIONS cap).
        // Separate from ownerSuspended — the pause-flow flips/restores ALL of an
        // owner's accommodations in bulk; downgrade restriction is selective and
        // the two states must NOT collide. Reversible: flipped back to false on
        // re-upgrade or manual restore by the host once back under cap.
        planRestricted: boolean('plan_restricted').notNull().default(false),
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
        /** Average guest rating (0.00-5.00). Drizzle mode:'number' ensures runtime JS number type. */
        averageRating: numeric('average_rating', { precision: 3, scale: 2, mode: 'number' })
            .notNull()
            .default(0),
        seo: jsonb('seo').$type<Seo>(),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),
        lastWarnedAt: timestamp('last_warned_at', { withTimezone: true }),
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('PENDING'),
        extraInfo: jsonb('extra_info').$type<Record<string, unknown>>(),
        schedule: jsonb('schedule').$type<Record<string, unknown>>(),
        rating: jsonb('rating').$type<Record<string, unknown>>()
    },
    (table) => ({
        accommodations_isFeatured_idx: index('accommodations_isFeatured_idx').on(table.isFeatured),
        accommodations_ownerSuspended_idx: index('accommodations_ownerSuspended_idx').on(
            table.ownerSuspended
        ),
        accommodations_planRestricted_idx: index('accommodations_planRestricted_idx').on(
            table.planRestricted
        ),
        accommodations_visibility_idx: index('accommodations_visibility_idx').on(table.visibility),
        accommodations_lifecycle_idx: index('accommodations_lifecycle_idx').on(
            table.lifecycleState
        ),
        accommodations_visibility_isFeatured_idx: index(
            'accommodations_visibility_isFeatured_idx'
        ).on(table.visibility, table.isFeatured),
        accommodations_destinationId_visibility_idx: index(
            'accommodations_destinationId_visibility_idx'
        ).on(table.destinationId, table.visibility),
        accommodations_ownerId_idx: index('accommodations_ownerId_idx').on(table.ownerId),
        accommodations_type_idx: index('accommodations_type_idx').on(table.type),
        accommodations_createdAt_idx: index('accommodations_createdAt_idx').on(table.createdAt),
        accommodations_destinationId_isFeatured_visibility_idx: index(
            'accommodations_destinationId_isFeatured_visibility_idx'
        ).on(table.destinationId, table.isFeatured, table.visibility),
        // Performance indexes for soft delete and moderation queries
        accommodations_deletedAt_idx: index('accommodations_deletedAt_idx').on(table.deletedAt),
        accommodations_moderationState_idx: index('accommodations_moderationState_idx').on(
            table.moderationState
        ),
        accommodations_ownerId_deletedAt_idx: index('accommodations_ownerId_deletedAt_idx').on(
            table.ownerId,
            table.deletedAt
        )
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
    amenities: many(rAccommodationAmenity, { relationName: 'accommodationToAmenity' }),
    features: many(rAccommodationFeature, { relationName: 'accommodationToFeature' }),
    reviews: many(accommodationReviews),
    faqs: many(accommodationFaqs),
    media: many(accommodationMedia),
    iaData: many(accommodationIaData),
    tags: many(rEntityTag),
    externalListings: many(accommodationExternalListings)
}));
