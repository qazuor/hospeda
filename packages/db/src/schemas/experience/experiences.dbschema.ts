import type {
    AdminInfoType,
    ContactInfo,
    I18nText,
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
    ExperiencePriceUnitPgEnum,
    ExperienceTypePgEnum,
    LifecycleStatusPgEnum,
    ModerationStatusPgEnum,
    VisibilityPgEnum
} from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { experienceFaqs } from './experience_faq.dbschema.ts';
import { experienceReviews } from './experience_review.dbschema.ts';
import { rExperienceAmenity } from './r_experience_amenity.dbschema.ts';
import { rExperienceFeature } from './r_experience_feature.dbschema.ts';

/**
 * Experiences table — commerce listings for tourism services and experiences (SPEC-240).
 *
 * Mirrors the gastronomy table shape as closely as possible:
 * - Same audit columns (createdById, updatedById, deletedById)
 * - Same lifecycle / visibility / moderation state pg enums
 * - Same jsonb contact/social/media/seo/adminInfo pattern
 * - Same i18n columns pattern (nameI18n, summaryI18n, descriptionI18n, richDescriptionI18n)
 * - Same rating aggregate columns (reviewsCount, averageRating, rating)
 * - Same hasActiveSubscription denormalized flag (binary subscription hook from SPEC-239)
 * - Entity-specific columns: type (ExperienceTypePgEnum), priceFrom (integer centavos),
 *   priceUnit (ExperiencePriceUnitPgEnum), isPriceOnRequest (boolean)
 * - openingHours stored as jsonb on main table (same choice as gastronomy — PARITY)
 */
export const experiences = pgTable(
    'experiences',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        name: text('name').notNull(),
        summary: text('summary').notNull(),
        description: text('description').notNull(),
        richDescription: text('rich_description'),
        // I18n columns (same pattern as gastronomy — SPEC-212 style)
        nameI18n: jsonb('name_i18n').$type<I18nText>(),
        summaryI18n: jsonb('summary_i18n').$type<I18nText>(),
        descriptionI18n: jsonb('description_i18n').$type<I18nText>(),
        richDescriptionI18n: jsonb('rich_description_i18n').$type<I18nText>(),
        /** Experience sub-category (CAR_RENTAL, TOUR_GUIDE, EXCURSION, etc.). */
        type: ExperienceTypePgEnum('type').notNull(),
        /**
         * Starting price in integer centavos (project-wide "Money = integer" rule).
         * Use 0 when isPriceOnRequest is true.
         */
        priceFrom: integer('price_from').notNull().default(0),
        /** Billing unit (per_day / per_hour / per_person / per_group). */
        priceUnit: ExperiencePriceUnitPgEnum('price_unit').notNull(),
        /**
         * When true, the UI shows "Consultar precio" instead of the numeric priceFrom.
         * Store priceFrom = 0 alongside this flag.
         */
        isPriceOnRequest: boolean('is_price_on_request').notNull().default(false),
        /**
         * Denormalized flag driven by the SPEC-239 binary-subscription lifecycle hook.
         * When false, the experience is hidden from public listing and detail pages.
         * Flipped by the subscription reconciler — never edited directly via CRUD.
         */
        hasActiveSubscription: boolean('has_active_subscription').notNull().default(false),
        // Jsonb grouped columns (matching gastronomy / accommodation pattern)
        contactInfo: jsonb('contact_info').$type<ContactInfo>(),
        socialNetworks: jsonb('social_networks').$type<SocialNetwork>(),
        /**
         * Weekly opening hours — keyed by day name with open/close time strings.
         * Stored as jsonb on the main table (same choice as gastronomy — no separate hours table).
         */
        openingHours: jsonb('opening_hours').$type<Record<string, unknown>>(),
        media: jsonb('media').$type<Media>(),
        seo: jsonb('seo').$type<Seo>(),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        // FK relations
        ownerId: uuid('owner_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        destinationId: uuid('destination_id')
            .notNull()
            .references(() => destinations.id, { onDelete: 'restrict' }),
        // Visibility / lifecycle / moderation (reuse existing pg enums)
        visibility: VisibilityPgEnum('visibility').notNull().default('PUBLIC'),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('DRAFT'),
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('PENDING'),
        isFeatured: boolean('is_featured').notNull().default(false),
        // Denormalized aggregate stats (updated by trigger / service)
        reviewsCount: integer('reviews_count').notNull().default(0),
        /** Average rating across all review criteria (0.00–5.00). mode:'number' for JS coercion. */
        averageRating: numeric('average_rating', { precision: 3, scale: 2, mode: 'number' })
            .notNull()
            .default(0),
        /** Granular rating breakdown stored as JSONB (service/value/guide/overall). */
        rating: jsonb('rating').$type<Record<string, unknown>>(),
        // Full audit (mirrors gastronomy)
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        experiences_destinationId_idx: index('experiences_destinationId_idx').on(
            table.destinationId
        ),
        experiences_visibility_idx: index('experiences_visibility_idx').on(table.visibility),
        experiences_isFeatured_idx: index('experiences_isFeatured_idx').on(table.isFeatured),
        experiences_type_idx: index('experiences_type_idx').on(table.type),
        experiences_ownerId_idx: index('experiences_ownerId_idx').on(table.ownerId),
        experiences_deletedAt_idx: index('experiences_deletedAt_idx').on(table.deletedAt),
        experiences_moderationState_idx: index('experiences_moderationState_idx').on(
            table.moderationState
        ),
        // Composite: subscription flag + lifecycle state for fast public listing query
        experiences_hasActiveSubscription_lifecycleState_idx: index(
            'experiences_hasActiveSubscription_lifecycleState_idx'
        ).on(table.hasActiveSubscription, table.lifecycleState),
        // Composite: owner + soft-delete (mirrors gastronomy pattern)
        experiences_ownerId_deletedAt_idx: index('experiences_ownerId_deletedAt_idx').on(
            table.ownerId,
            table.deletedAt
        ),
        // Composite: destination + visibility (mirrors gastronomy pattern)
        experiences_destinationId_visibility_idx: index(
            'experiences_destinationId_visibility_idx'
        ).on(table.destinationId, table.visibility)
    })
);

export const experiencesRelations = relations(experiences, ({ one, many }) => ({
    owner: one(users, {
        fields: [experiences.ownerId],
        references: [users.id]
    }),
    createdBy: one(users, {
        fields: [experiences.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [experiences.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [experiences.deletedById],
        references: [users.id]
    }),
    destination: one(destinations, {
        fields: [experiences.destinationId],
        references: [destinations.id]
    }),
    amenities: many(rExperienceAmenity, { relationName: 'experienceToAmenity' }),
    features: many(rExperienceFeature, { relationName: 'experienceToFeature' }),
    reviews: many(experienceReviews),
    faqs: many(experienceFaqs)
}));

/** Type-inferred insert type for experiences rows. */
export type InsertExperience = typeof experiences.$inferInsert;
/** Type-inferred select type for experiences rows. */
export type SelectExperience = typeof experiences.$inferSelect;
