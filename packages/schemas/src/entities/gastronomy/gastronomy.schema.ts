import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { CommerceIdentityFields } from '../../common/commerce-identity.schema.js';
import { CommerceRatingSchema } from '../../common/commerce-rating.schema.js';
import { BaseContactFields } from '../../common/contact.schema.js';
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
import { GastronomyTypeEnumSchema, PriceRangeEnumSchema } from '../../enums/index.js';
import { GastronomyFaqSchema } from './subtypes/gastronomy.faq.schema.js';

/**
 * Gastronomy Entity Schema — commerce listing for food and beverage venues.
 *
 * Composed by spreading shared base-field const objects (same composition pattern
 * as `AccommodationSchema`) plus gastronomy-specific fields:
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
 * @example
 * ```ts
 * const gastronomy: Gastronomy = GastronomySchema.parse(raw);
 * ```
 */
export const GastronomySchema = z.object({
    // Entity ID
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    // Core identity fields (name/slug/summary/description/richDescription + i18n)
    ...CommerceIdentityFields,

    // Gastronomy-specific fields
    /** Gastronomy sub-category (RESTAURANT, BAR, CAFE, PARRILLA, etc.). */
    type: GastronomyTypeEnumSchema,

    /**
     * Price-range tier for this venue.
     * Nullish: a new listing may not have a price range assigned yet.
     */
    priceRange: PriceRangeEnumSchema.nullish(),

    /**
     * URL linking to the venue's online menu.
     * Must be a valid HTTPS URL when provided.
     */
    menuUrl: z
        .string()
        .url({ message: 'zodError.gastronomy.menuUrl.invalid' })
        .startsWith('https://', { message: 'zodError.gastronomy.menuUrl.httpsRequired' })
        .nullish(),

    // Linked destination and owner
    destinationId: DestinationIdSchema,
    ownerId: UserIdSchema,

    /** Whether this gastronomy listing is featured on the platform. */
    isFeatured: z.boolean().default(false),

    // Base field groups — spread in the same order as AccommodationSchema
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
     * FAQs belonging to this entity, loaded from the dedicated `gastronomy_faqs`
     * table and embedded in the detail payload.
     *
     * Built from `GastronomyFaqSchema` with its identity fields made OPTIONAL, which is
     * doing two jobs at once:
     *
     *  - It DECLARES `id`, so Zod stops stripping it. The field used to be typed
     *    `z.array(BaseFaqSchema)`, and that base is deliberately identity-less —
     *    it is what `FaqCreatePayloadSchema` and `BaseFaqPublicSchema` are picked
     *    from, and what the per-entity subtypes extend by ADDING `id` + the owner
     *    FK. Undeclared meant stripped, so every embedded FAQ came out with no
     *    id even though the rows carry a real UUID. Consumers key their rows and
     *    their "which one am I editing" state off that id, so a blank one made
     *    all FAQs indistinguishable.
     *  - It keeps both fields OPTIONAL rather than adopting the subtype whole,
     *    because requiring them would TIGHTEN a published schema — forbidden by
     *    the additive-only compatibility policy (see `packages/schemas/CLAUDE.md`
     *    and `docs/guides/schema-compat-policy.md`). Historic payloads without an
     *    id must keep parsing; the same call was made for `pointsOfInterest`'s
     *    `relation` in HOS-146.
     */
    faqs: z.array(GastronomyFaqSchema.partial({ id: true, gastronomyId: true })).optional(),

    /**
     * Granular rating breakdown (food / service / ambiance / value).
     * Aggregate of individual `GastronomyReview` records. Null when no
     * reviews have been submitted yet.
     */
    rating: CommerceRatingSchema.nullish()
});

/** TypeScript type inferred from {@link GastronomySchema}. */
export type Gastronomy = z.infer<typeof GastronomySchema>;
