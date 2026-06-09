import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { BaseContactFields } from '../../common/contact.schema.js';
import { BaseFaqSchema } from '../../common/faq.schema.js';
import {
    AccommodationIdSchema,
    DestinationIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { AccommodationEntityMediaFields } from '../../common/media.schema.js';
import { BaseModerationFields } from '../../common/moderation.schema.js';
import { BaseReviewFields } from '../../common/review.schema.js';
import { BaseSeoFields } from '../../common/seo.schema.js';
import { TagsFields } from '../../common/tags.schema.js';
import { BaseVisibilityFields } from '../../common/visibility.schema.js';
import { AccommodationTypeEnumSchema } from '../../enums/index.js';
import { AccommodationLocationFields } from './accommodation.location.schema.js';
import { AccommodationIaDataSchema } from './subtypes/accommodation.ia.schema.js';
import { AccommodationPriceSchema } from './subtypes/accommodation.price.schema.js';
import { AccommodationRatingSchema } from './subtypes/accommodation.rating.schema.js';

/**
 * Accommodation Schema - Main Entity Schema
 *
 * This schema defines the complete structure of an Accommodation entity
 * using base field objects for consistency and maintainability.
 */
export const AccommodationSchema = z.object({
    // Base fields
    id: AccommodationIdSchema,
    ...BaseAuditFields,

    // Entity fields - specific to accommodation
    slug: z
        .string()
        .min(3, { message: 'zodError.accommodation.slug.min' })
        .max(50, { message: 'zodError.accommodation.slug.max' }),
    name: z
        .string()
        .min(3, { message: 'zodError.accommodation.name.min' })
        .max(100, { message: 'zodError.accommodation.name.max' }),
    summary: z
        .string()
        .min(10, { message: 'zodError.accommodation.summary.min' })
        .max(300, { message: 'zodError.accommodation.summary.max' }),
    description: z
        .string()
        .min(30, { message: 'zodError.accommodation.description.min' })
        .max(2000, { message: 'zodError.accommodation.description.max' }),
    /**
     * Rich-text (markdown) variant of the description used when the owning host
     * has the `CAN_USE_RICH_DESCRIPTION` entitlement. Presence on the public
     * payload is the ONLY signal the web client uses to pick rich vs. plain
     * rendering — see FR-3b and FR-4 in SPEC-187. Optional: missing means
     * the owner is not entitled, or the field has not been filled in.
     * Max length is 5000 chars of markdown (rendered HTML can be longer but
     * is bounded by the admin editor and the `sanitize-html` allowlist).
     */
    richDescription: z
        .string()
        .max(5000, { message: 'zodError.accommodation.richDescription.max' })
        .nullish(),
    isFeatured: z.boolean().default(false),

    // Base field groups
    ...BaseLifecycleFields,
    ...BaseModerationFields,
    ...BaseVisibilityFields,
    ...BaseReviewFields,
    ...BaseSeoFields,
    ...BaseContactFields,
    ...AccommodationLocationFields,
    ...AccommodationEntityMediaFields,
    ...BaseAdminFields,

    // Accommodation-specific core fields
    type: AccommodationTypeEnumSchema,
    destinationId: DestinationIdSchema,
    ownerId: UserIdSchema,

    /**
     * Service-suspension flag (SPEC-143 #29). Denormalized from
     * `users.service_suspended` (the canonical source) for the public-read hot
     * path and the accommodation edit-lock. Flipped in bulk across an owner's
     * accommodations when their subscription is paused with service suspension
     * (host self-pause or admin "full" pause), and cleared on resume.
     * Server-managed: never set through create/update input (it is omitted from
     * those schemas); only the pause/resume flow mutates it.
     */
    ownerSuspended: z.boolean().default(false),

    /**
     * Downgrade-restriction flag (SPEC-167 §3, D-3). Set to `true` by the
     * apply-scheduled-plan-changes cron (and the admin `onAfterSubscriptionChangePlan`
     * hook) when a host downgrades and the accommodation exceeds the target plan's
     * `MAX_ACCOMMODATIONS` cap. Cleared automatically on re-upgrade once the host is
     * back within cap.
     *
     * This flag is intentionally separate from `ownerSuspended` — `ownerSuspended`
     * is a bulk pause/resume toggle for ALL of an owner's accommodations; this flag
     * is a selective, per-accommodation downgrade restriction. The two states MUST
     * NOT collide (design decision D-3).
     *
     * Server-managed: never set through create/update input (it is omitted from those
     * schemas); only the downgrade-restriction flow mutates it.
     */
    planRestricted: z.boolean().default(false),

    // Optional related data
    iaData: z.array(AccommodationIaDataSchema).optional(),
    faqs: z.array(BaseFaqSchema).optional(),
    price: AccommodationPriceSchema.nullish(),
    ...TagsFields,

    // Rating breakdown (aggregate of review ratings)
    rating: AccommodationRatingSchema.nullish(),

    /**
     * Timestamp of the last "draft about to be archived" warning email sent to the owner.
     * Set by the archive-abandoned-drafts cron at the 7-day-before-archive mark.
     * Null when no warning has been emitted yet.
     */
    lastWarnedAt: z.date().nullable().optional(),

    // Extra Info
    extraInfo: z
        .object({
            capacity: z.number().int({
                message: 'zodError.accommodation.extraInfo.capacity.required'
            }),
            minNights: z.number().int({
                message: 'zodError.accommodation.extraInfo.minNights.required'
            }),
            maxNights: z.number().int().optional(),
            bedrooms: z.number().int({
                message: 'zodError.accommodation.extraInfo.bedrooms.required'
            }),
            beds: z.number().int().optional(),
            bathrooms: z.number().int({
                message: 'zodError.accommodation.extraInfo.bathrooms.required'
            }),
            smokingAllowed: z.boolean().optional(),
            extraInfo: z.array(z.string()).optional()
        })
        .nullish()
});
export type Accommodation = z.infer<typeof AccommodationSchema>;
