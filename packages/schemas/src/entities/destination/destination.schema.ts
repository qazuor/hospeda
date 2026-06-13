import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { BaseFaqSchema } from '../../common/faq.schema.js';
import { I18nTextSchema, TranslationMetaSchema } from '../../common/i18n.schema.js';
import { DestinationIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { BaseLocationFields } from '../../common/location.schema.js';
import { BaseMediaFields } from '../../common/media.schema.js';
import { BaseModerationFields } from '../../common/moderation.schema.js';
import { BaseReviewFields } from '../../common/review.schema.js';
import { BaseSeoFields } from '../../common/seo.schema.js';
import { BaseVisibilityFields } from '../../common/visibility.schema.js';
import { DestinationTypeEnumSchema } from '../../enums/destination-type.schema.js';
import { AttractionSummarySchema } from '../attraction/attraction.schema.js';
import { DestinationReviewSchema } from '../destinationReview/destinationReview.schema.js';
import { TagSchema } from '../tag/tag.schema.js';
import { DestinationRatingSchema } from './subtypes/destination.rating.schema.js';

/**
 * Destination Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a Destination entity
 * using base field objects for consistency and maintainability.
 *
 * NOTE: Reviews are handled by separate DestinationReviewSchema entity.
 * This schema only contains review aggregation fields (reviewsCount, averageRating).
 */
export const DestinationSchema = z.object({
    // Base fields
    id: DestinationIdSchema,
    ...BaseAuditFields,
    // Hierarchy fields
    parentDestinationId: z.string().uuid().nullable(),
    destinationType: DestinationTypeEnumSchema,
    level: z.number().int().min(0).max(6),
    path: z
        .string()
        .min(1, { message: 'zodError.destination.path.min' })
        .max(500, { message: 'zodError.destination.path.max' })
        .regex(/^\/[a-z0-9-/]+$/, { message: 'zodError.destination.path.format' }),
    pathIds: z.string().max(2000),

    // Entity fields - specific to destination
    slug: z
        .string()
        .min(3, { message: 'zodError.destination.slug.min' })
        .max(50, { message: 'zodError.destination.slug.max' }),
    name: z
        .string()
        .min(3, { message: 'zodError.destination.name.min' })
        .max(100, { message: 'zodError.destination.name.max' }),
    summary: z
        .string()
        .min(10, { message: 'zodError.destination.summary.min' })
        .max(300, { message: 'zodError.destination.summary.max' }),
    description: z
        .string()
        .min(30, { message: 'zodError.destination.description.min' })
        .max(8000, { message: 'zodError.destination.description.max' }),

    // SPEC-212: I18nText translations for multi-language content.
    // Mirror the plain text fields above (name/summary/description).
    // Nullish: DB columns are nullable jsonb with no default. Surfaced on
    // public + admin responses so web/admin can render en/pt.
    nameI18n: I18nTextSchema.nullish(),
    summaryI18n: I18nTextSchema.nullish(),
    descriptionI18n: I18nTextSchema.nullish(),

    /**
     * Per-field, per-locale translation curation metadata (SPEC-212).
     * Internal: exposed on admin responses only, never on public payloads.
     */
    translationMeta: TranslationMetaSchema.nullish(),

    isFeatured: z.boolean().default(false),
    ...BaseLifecycleFields,
    ...BaseAdminFields,
    ...BaseModerationFields,
    ...BaseVisibilityFields,
    ...BaseReviewFields,
    ...BaseSeoFields,
    // Tags
    tags: z.array(TagSchema).optional(),

    // Location (required for destinations)
    ...BaseLocationFields,

    // Media (using base object)
    ...BaseMediaFields,

    // Destination-specific fields
    accommodationsCount: z.number().int().min(0).default(0),

    // Attractions (lightweight summary — destinations only carry attraction
    // identifiers and display metadata, not the full audit/lifecycle entity).
    attractions: z.array(AttractionSummarySchema).optional(),
    reviews: z.array(DestinationReviewSchema).optional(),
    rating: DestinationRatingSchema.nullish(),

    // FAQs (1-to-N child entity, included in detail responses)
    faqs: z.array(BaseFaqSchema).optional()
});

/**
 * Type export for the main Destination entity
 */
export type Destination = z.infer<typeof DestinationSchema>;
