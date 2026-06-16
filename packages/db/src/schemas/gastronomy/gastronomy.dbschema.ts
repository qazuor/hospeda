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
    GastronomyTypePgEnum,
    LifecycleStatusPgEnum,
    ModerationStatusPgEnum,
    PriceRangePgEnum,
    VisibilityPgEnum
} from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { gastronomyFaqs } from './gastronomy_faq.dbschema.ts';
import { gastronomyReviews } from './gastronomy_review.dbschema.ts';
import { rGastronomyAmenity } from './r_gastronomy_amenity.dbschema.ts';
import { rGastronomyFeature } from './r_gastronomy_feature.dbschema.ts';

/**
 * Gastronomy table — commerce listings for food and beverage venues (SPEC-239).
 *
 * Mirrors the accommodation table shape as closely as possible:
 * - Same audit columns (createdById, updatedById, deletedById)
 * - Same lifecycle / visibility / moderation state pg enums
 * - Same jsonb contact/social/media/seo/adminInfo pattern
 * - Additional columns specific to gastronomy: type, priceRange, menuUrl, openingHours
 */
export const gastronomies = pgTable(
    'gastronomies',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        name: text('name').notNull(),
        summary: text('summary').notNull(),
        description: text('description').notNull(),
        richDescription: text('rich_description'),
        // I18n columns (same pattern as accommodations — SPEC-212 style)
        nameI18n: jsonb('name_i18n').$type<I18nText>(),
        summaryI18n: jsonb('summary_i18n').$type<I18nText>(),
        descriptionI18n: jsonb('description_i18n').$type<I18nText>(),
        richDescriptionI18n: jsonb('rich_description_i18n').$type<I18nText>(),
        /** Gastronomy sub-category (RESTAURANT, BAR, CAFE, PARRILLA, etc.). */
        type: GastronomyTypePgEnum('type').notNull(),
        /** Price-range tier for the venue (BUDGET/MID/HIGH/PREMIUM). Nullable until owner sets it. */
        priceRange: PriceRangePgEnum('price_range'),
        /** Optional URL to the venue's online menu. */
        menuUrl: text('menu_url'),
        // Jsonb grouped columns (matching accommodation pattern)
        contactInfo: jsonb('contact_info').$type<ContactInfo>(),
        socialNetworks: jsonb('social_networks').$type<SocialNetwork>(),
        /** Weekly opening hours — keyed by day name with open/close time strings. */
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
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('PENDING'),
        isFeatured: boolean('is_featured').notNull().default(false),
        // Denormalized aggregate stats (updated by trigger / service)
        reviewsCount: integer('reviews_count').notNull().default(0),
        /** Average rating across all review criteria (0.00–5.00). mode:'number' for JS coercion. */
        averageRating: numeric('average_rating', { precision: 3, scale: 2, mode: 'number' })
            .notNull()
            .default(0),
        /** Granular rating breakdown stored as JSONB (food/service/ambiance/value). */
        rating: jsonb('rating').$type<Record<string, unknown>>(),
        // Full audit (mirrors accommodation)
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        gastronomies_destinationId_idx: index('gastronomies_destinationId_idx').on(
            table.destinationId
        ),
        gastronomies_visibility_idx: index('gastronomies_visibility_idx').on(table.visibility),
        gastronomies_isFeatured_idx: index('gastronomies_isFeatured_idx').on(table.isFeatured),
        gastronomies_type_idx: index('gastronomies_type_idx').on(table.type),
        gastronomies_ownerId_idx: index('gastronomies_ownerId_idx').on(table.ownerId),
        gastronomies_deletedAt_idx: index('gastronomies_deletedAt_idx').on(table.deletedAt),
        gastronomies_moderationState_idx: index('gastronomies_moderationState_idx').on(
            table.moderationState
        ),
        // Composite indexes (same pattern as accommodations)
        gastronomies_destinationId_visibility_idx: index(
            'gastronomies_destinationId_visibility_idx'
        ).on(table.destinationId, table.visibility),
        gastronomies_ownerId_deletedAt_idx: index('gastronomies_ownerId_deletedAt_idx').on(
            table.ownerId,
            table.deletedAt
        )
    })
);

export const gastronomiesRelations = relations(gastronomies, ({ one, many }) => ({
    owner: one(users, {
        fields: [gastronomies.ownerId],
        references: [users.id]
    }),
    createdBy: one(users, {
        fields: [gastronomies.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [gastronomies.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [gastronomies.deletedById],
        references: [users.id]
    }),
    destination: one(destinations, {
        fields: [gastronomies.destinationId],
        references: [destinations.id]
    }),
    amenities: many(rGastronomyAmenity, { relationName: 'gastronomyToAmenity' }),
    features: many(rGastronomyFeature, { relationName: 'gastronomyToFeature' }),
    reviews: many(gastronomyReviews),
    faqs: many(gastronomyFaqs)
}));

/** Type-inferred insert type for gastronomy rows. */
export type InsertGastronomy = typeof gastronomies.$inferInsert;
/** Type-inferred select type for gastronomy rows. */
export type SelectGastronomy = typeof gastronomies.$inferSelect;
