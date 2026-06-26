import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { CommerceIdentityFields } from '../../common/commerce-identity.schema.js';
import { CommerceRatingSchema } from '../../common/commerce-rating.schema.js';
import { BaseContactFields } from '../../common/contact.schema.js';
import { BaseFaqSchema } from '../../common/faq.schema.js';
import { DestinationIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { BaseMediaFields } from '../../common/media.schema.js';
import { BaseModerationFields } from '../../common/moderation.schema.js';
import { OpeningHoursFields } from '../../common/opening-hours.schema.js';
import { BaseReviewFields } from '../../common/review.schema.js';
import { BaseSeoFields } from '../../common/seo.schema.js';
import { SocialNetworkFields } from '../../common/social.schema.js';
import { TagsFields } from '../../common/tags.schema.js';
import { BaseVisibilityFields } from '../../common/visibility.schema.js';
import { ExperiencePriceUnitEnumSchema, ExperienceTypeEnumSchema } from '../../enums/index.js';

/**
 * Unique identifier schema for an experience listing.
 * A UUID that references a row in the `experiences` table.
 */
export const ExperienceIdSchema = z.string().uuid({ message: 'zodError.common.id.invalidUuid' });

/** TypeScript type for {@link ExperienceIdSchema}. */
export type ExperienceId = z.infer<typeof ExperienceIdSchema>;

/**
 * Experience Entity Schema — commerce listing for tourism services and experiences.
 *
 * Composed by spreading shared base-field const objects (same composition pattern
 * as `GastronomySchema`) plus experience-specific fields:
 * - Identity: name/slug/summary/description/richDescription + i18n via `CommerceIdentityFields`
 * - Schedule: weekly opening hours via `OpeningHoursFields`
 * - Contact: phone/email/website via `BaseContactFields`
 * - Social: social network links via `SocialNetworkFields`
 * - Media: featured image + gallery + videos via `BaseMediaFields`
 * - Reviews: aggregate reviewsCount/averageRating via `BaseReviewFields`
 * - Lifecycle: lifecycleState via `BaseLifecycleFields`
 * - Moderation: moderationState via `BaseModerationFields`
 * - Visibility: visibility via `BaseVisibilityFields`
 * - SEO: title/description via `BaseSeoFields`
 * - Admin: adminInfo via `BaseAdminFields`
 * - Tags: tags array via `TagsFields`
 * - Audit: createdAt/updatedAt/deletedAt and userId variants via `BaseAuditFields`
 *
 * Entity-specific fields (SPEC-240):
 * - `type` — experience sub-category (CAR_RENTAL, TOUR_GUIDE, EXCURSION, etc.)
 * - `priceFrom` — starting price in integer centavos (0 = free / on_request)
 * - `priceUnit` — billing unit (per_day / per_hour / per_person / per_group)
 * - `isPriceOnRequest` — when true, hides priceFrom and shows "Consultar precio"
 * - `hasActiveSubscription` — denormalized flag driven by the binary subscription
 *   lifecycle hook from the SPEC-239 core; controls public visibility.
 *
 * @example
 * ```ts
 * const experience: Experience = ExperienceSchema.parse(raw);
 * ```
 */
export const ExperienceSchema = z.object({
    // Entity ID
    id: ExperienceIdSchema,

    // Core identity fields (name/slug/summary/description/richDescription + i18n)
    ...CommerceIdentityFields,

    // Experience-specific fields
    /** Experience sub-category (CAR_RENTAL, TOUR_GUIDE, EXCURSION, etc.). */
    type: ExperienceTypeEnumSchema,

    /**
     * Starting price in integer centavos (project-wide "Money = integer" rule).
     * Must be a non-negative integer. Use 0 when `isPriceOnRequest` is true —
     * the display layer will show "Consultar precio" instead of the numeric value.
     */
    priceFrom: z
        .number()
        .int()
        .nonnegative({ message: 'zodError.experience.priceFrom.nonnegative' }),

    /**
     * Billing unit for the experience pricing.
     * Determines how `priceFrom` is presented (per day, per hour, per person, or per group).
     */
    priceUnit: ExperiencePriceUnitEnumSchema,

    /**
     * When true, the UI shows "Consultar precio" and hides the numeric `priceFrom`.
     * Store `priceFrom = 0` alongside this flag to avoid confusion.
     */
    isPriceOnRequest: z.boolean().default(false),

    /**
     * Denormalized flag driven by the SPEC-239 binary-subscription lifecycle hook.
     * When false, the experience is hidden from public listing and detail pages.
     * Flipped by the subscription reconciler — never edited directly via CRUD.
     */
    hasActiveSubscription: z.boolean().default(false),

    // Linked destination and owner
    destinationId: DestinationIdSchema,
    ownerId: UserIdSchema,

    /** Whether this experience listing is featured on the platform. */
    isFeatured: z.boolean().default(false),

    // Base field groups — spread in the same order as GastronomySchema
    ...BaseLifecycleFields,
    ...BaseModerationFields,
    ...BaseVisibilityFields,
    ...BaseReviewFields,
    ...BaseSeoFields,
    ...BaseContactFields,
    ...SocialNetworkFields,
    ...OpeningHoursFields,
    ...BaseMediaFields,
    ...BaseAdminFields,
    ...TagsFields,
    ...BaseAuditFields,

    /**
     * Inline FAQs for the listing.
     * Stored as a JSONB array on the row for fast public reads;
     * also managed through the dedicated experience_faqs table.
     */
    faqs: z.array(BaseFaqSchema).optional(),

    /**
     * Granular rating breakdown (service / value / guide / overall).
     * Aggregate of individual `ExperienceReview` records. Null when no
     * reviews have been submitted yet.
     */
    rating: CommerceRatingSchema.nullish()
});

/** TypeScript type inferred from {@link ExperienceSchema}. */
export type Experience = z.infer<typeof ExperienceSchema>;
