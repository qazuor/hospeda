import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { CommerceIdentityFields } from '../../common/commerce-identity.schema.js';
import { CommerceRatingSchema } from '../../common/commerce-rating.schema.js';
import { BaseContactFields } from '../../common/contact.schema.js';
import { DestinationIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { BaseMediaFields, BaseVideosFields } from '../../common/media.schema.js';
import { BaseModerationFields } from '../../common/moderation.schema.js';
import { OpeningHoursFields } from '../../common/opening-hours.schema.js';
import { BaseReviewFields } from '../../common/review.schema.js';
import { BaseSeoFields } from '../../common/seo.schema.js';
import { SocialNetworkFields } from '../../common/social.schema.js';
import { TagsFields } from '../../common/tags.schema.js';
import { BaseVisibilityFields } from '../../common/visibility.schema.js';
import { ExperiencePriceUnitEnumSchema, ExperienceTypeEnumSchema } from '../../enums/index.js';
import { ExperienceFaqSchema } from './subtypes/experience.faq.schema.js';

/**
 * Unique identifier schema for an experience listing.
 * A UUID that references a row in the `experiences` table.
 */
export const ExperienceIdSchema = z.string().uuid({ message: 'zodError.common.id.invalidUuid' });

/** TypeScript type for {@link ExperienceIdSchema}. */
export type ExperienceId = z.infer<typeof ExperienceIdSchema>;

/**
 * Upper bound for `durationMinutes` (HOS-898): 30 days expressed in minutes.
 *
 * Generous on purpose — a multi-day trip is a real experience and must fit —
 * but still finite, so a typo that slips two extra zeroes onto "180" is
 * rejected at the boundary instead of rendering "125 días" on a public ficha.
 */
export const MAX_EXPERIENCE_DURATION_MINUTES = 30 * 24 * 60;

/** Maximum number of lines in a `whatToBring` / `requirements` list (HOS-1046). */
export const MAX_EXPERIENCE_CHECKLIST_ITEMS = 20;

/** Maximum length of a single `whatToBring` / `requirements` line (HOS-1046). */
export const MAX_EXPERIENCE_CHECKLIST_ITEM_LENGTH = 160;

/** Maximum number of lines in the `meetingPointDirections` list (HOS-1049). */
export const MAX_EXPERIENCE_DIRECTION_ITEMS = 12;

/**
 * Maximum length of a single `meetingPointDirections` line (HOS-1049).
 *
 * Longer than {@link MAX_EXPERIENCE_CHECKLIST_ITEM_LENGTH} because the two
 * lists are not the same kind of sentence: a packing-list line is a noun
 * ("repelente"), a directions line is a manoeuvre ("desde la Ruta 14 tomá el
 * acceso a la playa municipal, seguí 800 m de ripio y estacioná junto al
 * puesto de guardavidas"). Measured against real Litoral departures, 160 cut
 * those in half; 240 does not.
 */
export const MAX_EXPERIENCE_DIRECTION_ITEM_LENGTH = 240;

/**
 * Builds the schema for one of the experience free-text lists (HOS-1046,
 * reused by HOS-1049).
 *
 * `whatToBring` and `requirements` are separate COLUMNS but share a shape, and
 * the shape carries three decisions worth stating once:
 *
 * 1. Items are `.trim()`ed and each must be non-empty afterwards. A form that
 *    posts a blank row would otherwise persist `''` and the ficha would render
 *    a bullet over nothing — the same "heading over nothing" failure
 *    `normalizeMeetingPoint` had to fix on the read side (HOS-1048).
 * 2. The list DEFAULTS to `[]`, matching the `NOT NULL DEFAULT '{}'` column, so
 *    "no items" has exactly one representation instead of `null` and `[]` both.
 * 3. Error keys are passed in per field, so a rejected `requirements` line does
 *    not tell the owner their packing list is wrong.
 *
 * The three message keys are parameters rather than built from a field name
 * with a template literal ON PURPOSE: `scripts/extract-zod-keys.ts` collects
 * keys with a static regex over string literals, so an interpolated key would
 * land in the inventory verbatim (`zodError.experience.${field}.item.min`) and
 * the `--verify` guard would then demand a translation for a key that can never
 * exist. Literals at the call site keep the key greppable and the guard honest.
 *
 * @param input - The three i18n keys for this list's failure modes, plus the
 *   optional size limits (defaulting to the HOS-1046 checklist ones).
 * @returns A Zod array schema for that list.
 */
function experienceChecklistSchema(input: {
    readonly itemMin: string;
    readonly itemMax: string;
    readonly listMax: string;
    /** Defaults to {@link MAX_EXPERIENCE_CHECKLIST_ITEMS}. */
    readonly maxItems?: number;
    /** Defaults to {@link MAX_EXPERIENCE_CHECKLIST_ITEM_LENGTH}. */
    readonly maxItemLength?: number;
}): z.ZodDefault<z.ZodArray<z.ZodString>> {
    const maxItems = input.maxItems ?? MAX_EXPERIENCE_CHECKLIST_ITEMS;
    const maxItemLength = input.maxItemLength ?? MAX_EXPERIENCE_CHECKLIST_ITEM_LENGTH;

    return z
        .array(
            z
                .string()
                .trim()
                .min(1, { message: input.itemMin })
                .max(maxItemLength, { message: input.itemMax })
        )
        .max(maxItems, { message: input.listMax })
        .default([]);
}

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
 * - `meetingPoint` / `meetingPointLat` / `meetingPointLong` — where the
 *   experience starts (HOS-1048); ficha data, never entitlement-gated.
 * - `meetingPointDirections` — how to GET there (HOS-1049); the ONE gated
 *   field on this entity, `manage_experience_directions` from `experience-pro`
 *   upwards. Gated on the route, not here: this schema also describes rows read
 *   back from the database, and the instructions are withheld, never deleted.
 * - `durationMinutes` — how long it lasts, in minutes (HOS-898)
 * - `whatToBring` / `requirements` — two free-text checklists (HOS-1046)
 * - `cancellationPolicy` — free-text "what if it does not run" (HOS-1047)
 * - `acceptsPrivateGroups` — group-enquiry toggle (HOS-1056)
 *
 * Those four are ficha data too, and like the meeting point they are NEVER
 * entitlement-gated: owner decision (2026-09-01), they ship from the basic
 * tier. Do not add an `EntitlementKey` for any of them.
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
     *
     * NULLABLE since H-156, mirroring `experiences.price_unit` in the database.
     * An experience with `isPriceOnRequest = true` has no price, so it has no
     * unit to bill it in — requiring one forced the owner to declare the unit of
     * a price that does not exist, and produced rows asserting three things at
     * once: "the price is on request", "the price is 0", "it is charged per
     * person".
     *
     * INVARIANT: absent/null ONLY when `isPriceOnRequest` is true. A listing
     * with a real price still requires a unit; that cross-field rule is enforced
     * on the CREATE schemas (see `experience.crud.schema.ts`), not here — this
     * base schema also describes rows READ back from the database, where the
     * write rule has already been applied.
     *
     * `.nullish()` rather than `.nullable()`: `.nullable()` accepts `null` but
     * still DEMANDS the key, so a client that simply omits the unit for a
     * price-on-request listing would be told the field is "Required" — the exact
     * friction this change exists to remove. Omission is safe because the
     * cross-field rule rejects it whenever there IS a price.
     */
    priceUnit: ExperiencePriceUnitEnumSchema.nullish(),

    /**
     * When true, the UI shows "Consultar precio" and hides the numeric `priceFrom`.
     * Store `priceFrom = 0` alongside this flag to avoid confusion.
     */
    isPriceOnRequest: z.boolean().default(false),

    /**
     * Where the experience starts — the address or the landmark the traveller
     * has to show up at (HOS-1048).
     *
     * Free text, because many meeting points in the region are a reference
     * rather than a street number ("muelle 3 del puerto", "la rotonda de
     * acceso"). Nullish: a listing may not have declared one yet.
     *
     * NOT entitlement-gated — it is ficha data, present from the basic tier and
     * published on the public tier. The MAP that draws it and the how-to-get-
     * there instructions are the paid half (HOS-1049).
     */
    meetingPoint: z
        .string()
        .max(300, { message: 'zodError.experience.meetingPoint.max' })
        .nullish(),

    /**
     * Latitude of the meeting point in decimal degrees (WGS84).
     *
     * Plain number matching the `double precision` column, following the
     * `points_of_interest` precedent (HOS-138) rather than the JSONB/string
     * coordinate shape `accommodations` and `destinations` use.
     *
     * Nullish and independent of {@link meetingPoint}: an owner may describe the
     * spot in words and never pin it. Null is "no coordinate", not an error.
     */
    meetingPointLat: z
        .number()
        .min(-90, { message: 'zodError.experience.meetingPointLat.min' })
        .max(90, { message: 'zodError.experience.meetingPointLat.max' })
        .nullish(),

    /**
     * Longitude of the meeting point in decimal degrees (WGS84). Key named
     * `long` (not `lng`) for consistency with `points_of_interest` and with
     * `@repo/db`'s `geo.ts` helpers. See {@link meetingPointLat}.
     */
    meetingPointLong: z
        .number()
        .min(-180, { message: 'zodError.experience.meetingPointLong.min' })
        .max(180, { message: 'zodError.experience.meetingPointLong.max' })
        .nullish(),

    /**
     * HOW TO GET to the meeting point (HOS-1049) — one instruction per line:
     * where to park, which bus, how far the walk is from the road, what
     * landmark to look for.
     *
     * A list rather than prose, for the same reason {@link whatToBring} is one:
     * a traveller reads these one at a time. It also keeps the field clear of
     * markdown, so it needs no sanitiser and does not overlap
     * `richDescription`'s own entitlement.
     *
     * ## The ONE entitlement-gated field on this entity
     *
     * Every other ficha field here is free on the basic tier by owner decision
     * — including {@link meetingPoint} and its two coordinates. This one, and
     * the MAP drawn from those coordinates, are `manage_experience_directions`
     * (`experience-pro` and above). The gate lives on the write route and on
     * the public projection, NOT in this schema: the base schema also describes
     * rows read back from the database, and a downgraded provider's
     * instructions are withheld, never deleted.
     */
    meetingPointDirections: experienceChecklistSchema({
        itemMin: 'zodError.experience.meetingPointDirections.item.min',
        itemMax: 'zodError.experience.meetingPointDirections.item.max',
        listMax: 'zodError.experience.meetingPointDirections.max',
        maxItems: MAX_EXPERIENCE_DIRECTION_ITEMS,
        maxItemLength: MAX_EXPERIENCE_DIRECTION_ITEM_LENGTH
    }),

    /**
     * How long the experience lasts, in whole MINUTES (HOS-898).
     *
     * A number rather than free text ("2 horas aprox") because the ficha
     * renders in es/en/pt: prose typed once in Spanish is shown untranslated to
     * the other two, while an integer is formatted per locale at render time.
     * Minutes, not hours, because a 45-minute walk and a 90-minute boat ride
     * are both real durations and neither is a whole number of hours.
     *
     * Bounds: at least 1 minute (0 is not a duration), at most
     * {@link MAX_EXPERIENCE_DURATION_MINUTES}. Nullish; NOT entitlement-gated —
     * ficha data from the basic tier.
     */
    durationMinutes: z
        .number()
        .int({ message: 'zodError.experience.durationMinutes.int' })
        .min(1, { message: 'zodError.experience.durationMinutes.min' })
        .max(MAX_EXPERIENCE_DURATION_MINUTES, {
            message: 'zodError.experience.durationMinutes.max'
        })
        .nullish(),

    /**
     * What the traveller has to BRING — repellent, closed shoes, swimsuit
     * (HOS-1046). One free-text line per item.
     *
     * Separate from {@link requirements} rather than one list carrying a `type`
     * discriminator (the decision HOS-1046 delegated). The two answer different
     * questions — this is a packing list the traveller acts on, `requirements`
     * is an eligibility gate that may exclude them — they render under
     * different headings, and a discriminator would exist only to re-derive at
     * read time a split already known at write time.
     */
    whatToBring: experienceChecklistSchema({
        itemMin: 'zodError.experience.whatToBring.item.min',
        itemMax: 'zodError.experience.whatToBring.item.max',
        listMax: 'zodError.experience.whatToBring.max'
    }),

    /**
     * REQUIREMENTS to take part — minimum age, knowing how to swim, fitness
     * level, health restrictions (HOS-1046). One free-text line per item.
     *
     * Free text rather than a catalog of tick-boxes: "edad mínima 12 años" and
     * "no apto para embarazadas" carry a number and a nuance no fixed catalog
     * row holds, and every provider's threshold differs. See
     * {@link whatToBring} for why the two lists are separate columns.
     */
    requirements: experienceChecklistSchema({
        itemMin: 'zodError.experience.requirements.item.min',
        itemMax: 'zodError.experience.requirements.item.max',
        listMax: 'zodError.experience.requirements.max'
    }),

    /**
     * What happens when the experience does not run — rain, wind, a low river,
     * not reaching the minimum group size (HOS-1047).
     *
     * FREE TEXT, which is the decision HOS-1047 delegated. A structured
     * (deadline + outcome) policy only earns its complexity once money has
     * changed hands and something must be computed from it — that is HOS-1050
     * (deposits), and it is deferred. Until then the only consumer is a person
     * reading the ficha, and prose says "si baja el río reprogramamos sin
     * cargo" in a way no enum pair does.
     *
     * Nullish; NOT entitlement-gated.
     */
    cancellationPolicy: z
        .string()
        .max(1500, { message: 'zodError.experience.cancellationPolicy.max' })
        .nullish(),

    /**
     * Whether the provider offers a special arrangement for private groups
     * (HOS-1056).
     *
     * A single flag on purpose: it turns on a CTA to contact the provider and
     * nothing else — no rate card, no quote calculator, no group booking. The
     * toggle captures the intent; the conversation closes the deal.
     *
     * Defaults to `false` and is never nullish, mirroring
     * {@link isPriceOnRequest}: for a CTA that only appears when the flag is
     * on, "did not say" and "does not offer it" are the same answer.
     */
    acceptsPrivateGroups: z.boolean().default(false),

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
    ...BaseVideosFields,
    ...BaseAdminFields,
    ...TagsFields,
    ...BaseAuditFields,

    /**
     * FAQs belonging to this entity, loaded from the dedicated `experience_faqs`
     * table and embedded in the detail payload.
     *
     * Built from `ExperienceFaqSchema` with its identity fields made OPTIONAL, which is
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
    faqs: z.array(ExperienceFaqSchema.partial({ id: true, experienceId: true })).optional(),

    /**
     * Granular rating breakdown (service / value / guide / overall).
     * Aggregate of individual `ExperienceReview` records. Null when no
     * reviews have been submitted yet.
     */
    rating: CommerceRatingSchema.nullish()
});

/** TypeScript type inferred from {@link ExperienceSchema}. */
export type Experience = z.infer<typeof ExperienceSchema>;
