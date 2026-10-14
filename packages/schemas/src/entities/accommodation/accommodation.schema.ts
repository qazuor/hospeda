import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { BaseContactFields } from '../../common/contact.schema.js';
import { I18nTextSchema, TranslationMetaSchema } from '../../common/i18n.schema.js';
import {
    AccommodationIdSchema,
    DestinationIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { AccommodationEntityMediaFields, BaseVideosFields } from '../../common/media.schema.js';
import { BaseReviewFields } from '../../common/review.schema.js';
import { BaseSeoFields } from '../../common/seo.schema.js';
import { SocialNetworkFields } from '../../common/social.schema.js';
import { TagsFields } from '../../common/tags.schema.js';
import { AccommodationTypeEnumSchema } from '../../enums/index.js';
import { PublicationStatusEnumSchema } from '../../enums/publication-status.schema.js';
import { AccommodationLocationFields } from './accommodation.location.schema.js';
import { AccommodationFaqSchema } from './subtypes/accommodation.faq.schema.js';
import { AccommodationIaDataSchema } from './subtypes/accommodation.ia.schema.js';
import { AccommodationPriceSchema } from './subtypes/accommodation.price.schema.js';
import { AccommodationRatingSchema } from './subtypes/accommodation.rating.schema.js';

/**
 * Structured "extra info" stored as a grouped JSONB column.
 *
 * Extracted as a named schema (single source of truth) so the update path can
 * derive a deep-partial variant via `.partial()` for partial PATCH semantics
 * (SPEC-229).
 *
 * `capacity`/`minNights`/`bedrooms`/`bathrooms` are OPTIONAL here (HOS-152 fix).
 * A host-onboarding DRAFT (`AccommodationService.createForOnboarding`) is
 * legitimately created with a PARTIAL (or entirely absent) `extraInfo` — the
 * onboarding form lets the host fill in capacity data incrementally across
 * multiple PATCHes, and `httpToDomainAccommodationCreateDraft` /
 * `httpToDomainAccommodationUpdate` only ever emit the subset of fields the
 * host actually provided (SPEC-229 partial-merge semantics). Requiring all
 * four fields here made the READ schemas (`AccommodationProtectedSchema`,
 * `AccommodationAdminSchema`, both derived from this schema) reject any DRAFT
 * with incomplete capacity data, 500-ing every `GET`/`PATCH` on a
 * freshly-onboarded listing. This mirrors the same read-vs-write relaxation
 * already applied to `description` in the access schemas (SPEC-143 Finding
 * #9): the read contract must tolerate what the DB legitimately contains;
 * completeness is enforced at PUBLISH time instead, via
 * {@link AccommodationExtraInfoRequiredForPublishSchema}.
 */
export const AccommodationExtraInfoSchema = z.object({
    capacity: z
        .number()
        .int({
            message: 'zodError.accommodation.extraInfo.capacity.required'
        })
        .optional(),
    minNights: z
        .number()
        .int({
            message: 'zodError.accommodation.extraInfo.minNights.required'
        })
        .optional(),
    maxNights: z.number().int().optional(),
    bedrooms: z
        .number()
        .int({
            message: 'zodError.accommodation.extraInfo.bedrooms.required'
        })
        .optional(),
    beds: z.number().int().optional(),
    bathrooms: z
        .number()
        .int({
            message: 'zodError.accommodation.extraInfo.bathrooms.required'
        })
        .optional(),
    smokingAllowed: z.boolean().optional(),
    extraInfo: z.array(z.string()).optional()
});

/**
 * Strict variant of {@link AccommodationExtraInfoSchema} requiring
 * `capacity`/`minNights`/`bedrooms`/`bathrooms` — the four fields a DRAFT may
 * legitimately omit on read/write, but which MUST be present before an
 * accommodation can be published (-> PUBLISHED).
 *
 * Used exclusively by `AccommodationService.publish()`'s completeness guard
 * (HOS-152). Never used on the read or draft-write paths — those stay
 * relaxed via `AccommodationExtraInfoSchema` above.
 */
export const AccommodationExtraInfoRequiredForPublishSchema = AccommodationExtraInfoSchema.required(
    {
        capacity: true,
        minNights: true,
        bedrooms: true,
        bathrooms: true
    }
);

/**
 * Maximum accommodation slug length on the WRITE side (create, update, and the
 * entity schema itself). Matches the cap `generateSlug` in service-core applies,
 * so a slug the platform generates always satisfies it (HOS-855, BETA-172).
 */
export const ACCOMMODATION_SLUG_MAX_LENGTH = 50;

/**
 * Maximum accommodation slug length on the READ side. Deliberately looser than
 * {@link ACCOMMODATION_SLUG_MAX_LENGTH}: rows persisted before the generator cap
 * (BETA-172) or through the old `create` limit of 100 can legitimately hold
 * 51-120 chars, and a read schema stricter than the DB turns those rows into a
 * permanent 500 (SPEC-143 Finding #9). Every read/response schema MUST use
 * {@link AccommodationReadSlugSchema}, never the write bound.
 */
export const ACCOMMODATION_SLUG_READ_MAX_LENGTH = 120;

/**
 * Slug shape for READ/response schemas (see {@link ACCOMMODATION_SLUG_READ_MAX_LENGTH}).
 */
export const AccommodationReadSlugSchema = z
    .string()
    .max(ACCOMMODATION_SLUG_READ_MAX_LENGTH, { message: 'zodError.accommodation.slug.max' });

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
        .max(ACCOMMODATION_SLUG_MAX_LENGTH, { message: 'zodError.accommodation.slug.max' }),
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

    // SPEC-212: I18nText translations for multi-language content.
    // Mirror the plain text fields above (name/summary/description/richDescription).
    // Nullish: DB columns are nullable jsonb with no default. Populated by the
    // AI translation service; surfaced on public + admin responses so web/admin
    // can render en/pt. richDescriptionI18n follows the same premium gating as
    // the plain richDescription field (CAN_USE_RICH_DESCRIPTION) on public tier.
    nameI18n: I18nTextSchema.nullish(),
    summaryI18n: I18nTextSchema.nullish(),
    descriptionI18n: I18nTextSchema.nullish(),
    richDescriptionI18n: I18nTextSchema.nullish(),

    /**
     * Per-field, per-locale translation curation metadata (SPEC-212).
     * Internal: exposed on admin responses only, never on public payloads.
     */
    translationMeta: TranslationMetaSchema.nullish(),

    /**
     * Billing-derived denormalization (SPEC-292, renamed SPEC-309): whether an
     * ACTIVE plan or addon FEATURED_LISTING entitlement currently covers this
     * accommodation. Written ONLY by the sync primitives in
     * `accommodation.sync-featured-by-entitlement.ts` — never by the general
     * update path. Since HOS-1419 dropped the admin-curated `is_featured` column
     * it is the ONLY featuring source. Never exposed on `AccommodationPublicSchema`
     * — public routes read it internally to compute the public `isFeatured` value
     * (HOS-929) and strip the raw column before serialization.
     */
    featuredByEntitlement: z.boolean().default(false),

    /**
     * Publication state of the listing (`PublicationStatusEnum`, the `listing`
     * state of `V/03` §9). It replaces the six old lifecycle, visibility,
     * moderation and billing-restriction columns (HOS-1641): only `PUBLISHED`
     * is public.
     * Server-managed: written ONLY by the PB publication transitions, never
     * through a create/update input (it is omitted from those schemas).
     */
    publicationStatus: PublicationStatusEnumSchema,

    // Base field groups
    ...BaseReviewFields,
    ...BaseSeoFields,
    ...BaseContactFields,
    ...SocialNetworkFields,
    ...AccommodationLocationFields,
    ...AccommodationEntityMediaFields,
    ...BaseVideosFields,
    ...BaseAdminFields,

    // Accommodation-specific core fields
    type: AccommodationTypeEnumSchema,
    destinationId: DestinationIdSchema,
    ownerId: UserIdSchema,

    /**
     * Master visibility toggle for the external reputation block (SPEC-237).
     *
     * When `false`, the public detail page hides all external reputation blocks
     * regardless of individual listing `showLink` / `showReviews` flags.
     * When `true`, individual platform listing flags govern visibility.
     *
     * NOT NULL DEFAULT false in the DB.
     * Owner-managed via the protected `PATCH /:id/external-reputation/master-toggle`
     * endpoint; defaults to false (hidden) until the owner opts in.
     */
    showExternalReputation: z.boolean().default(false),

    /** Admin-verified flag (SPEC-291). Set only by the verify admin action. */
    isVerified: z.boolean().default(false),
    /** Timestamp of the last verification action. Null when never verified. */
    verifiedAt: z.coerce.date().nullable().optional(),
    /** Admin user who performed the last verify/unverify action. */
    verifiedById: UserIdSchema.nullable().optional(),

    // Optional related data
    iaData: z.array(AccommodationIaDataSchema).optional(),
    /**
     * FAQs belonging to this entity, loaded from the dedicated `accommodation_faqs`
     * table and embedded in the detail payload.
     *
     * Built from `AccommodationFaqSchema` with its identity fields made OPTIONAL, which is
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
    faqs: z.array(AccommodationFaqSchema.partial({ id: true, accommodationId: true })).optional(),
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
    extraInfo: AccommodationExtraInfoSchema.nullish()
});
/**
 * Read-side variant of {@link AccommodationSchema}: identical except `slug`
 * tolerates legacy values up to {@link ACCOMMODATION_SLUG_READ_MAX_LENGTH}.
 * Use it as the base of every response / read-model schema (HOS-855).
 */
export const AccommodationReadSchema = AccommodationSchema.extend({
    slug: AccommodationReadSlugSchema
});

export type Accommodation = z.infer<typeof AccommodationSchema>;
