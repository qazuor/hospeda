/**
 * The exact fields a brochure may read from a listing (HOS-1058).
 *
 * ---
 * WHY A SECOND SCHEMA INSTEAD OF REUSING THE PUBLIC ONE DIRECTLY
 *
 * The brochure must not be able to print a field the public ficha does not
 * publish. The obvious way to guarantee that is to parse the row with
 * `GastronomyPublicSchema` / `ExperiencePublicSchema` and read the result — and
 * it does not work, for a reason worth writing down rather than rediscovering:
 * those schemas carry the public tier's VALUE constraints, including
 * `description.min(20)`, which a DRAFT listing legitimately violates (the
 * protected tier relaxes exactly that constraint for exactly that reason). An
 * owner whose short description made the parse throw would get a 500 instead of
 * a brochure.
 *
 * So the two jobs are separated:
 *
 * - **Key selection is the privacy guarantee**, and it lives here: these
 *   schemas name every field the brochure can see, and
 *   `test/services/commerce-brochure.test.ts` fails the build if any of those
 *   names is absent from the matching PUBLIC schema. Adding `contactInfo` to
 *   the gastronomy brochure — the field a printed sheet most invites you to add
 *   — breaks that test, because the public gastronomy projection does not pick
 *   it.
 * - **Value validation is the API contract**, and it stays where it already is:
 *   on the public route, enforced by `stripWithSchema`.
 *
 * Everything below except the three identity fields is therefore optional and
 * lenient. A brochure renders whatever is there and omits what is not; it is
 * not a validator, and the row it reads has already been validated on write.
 *
 * @module services/commerce-brochure/brochure-source
 */

import { z } from 'zod';

/** A localized text object as the listing stores it, read leniently. */
const I18nTextLikeSchema = z
    .object({
        es: z.string().nullish(),
        en: z.string().nullish(),
        pt: z.string().nullish()
    })
    .partial()
    .nullish();

/** One image, reduced to what the layout needs plus its moderation state. */
const ImageLikeSchema = z.object({
    url: z.string(),
    moderationState: z.string()
});

/** The media block, read leniently: unknown sibling keys are dropped. */
const MediaLikeSchema = z
    .object({
        featuredImage: ImageLikeSchema.optional(),
        gallery: z.array(ImageLikeSchema).optional()
    })
    .nullish();

/** One day of the weekly schedule. */
const DayScheduleLikeSchema = z.object({
    closed: z.boolean().optional(),
    shifts: z
        .array(z.object({ open: z.string().optional(), close: z.string().optional() }))
        .optional()
});

/** The weekly schedule block. */
const OpeningHoursLikeSchema = z
    .object({
        days: z.record(z.string(), DayScheduleLikeSchema).optional(),
        notes: z.string().nullish()
    })
    .nullish();

/** Social profile URLs, read leniently (HOS-190: a stored legacy URL must not throw). */
const SocialNetworksLikeSchema = z.record(z.string(), z.string().optional()).nullish();

/** An amenity as the public catalog join publishes it. */
const AmenityLikeSchema = z.object({ slug: z.string() });

/** A feature, including the owner's own relabel. */
const FeatureLikeSchema = z.object({
    slug: z.string(),
    hostReWriteName: z.string().nullish()
});

/** The destination summary the public payload carries. */
const DestinationLikeSchema = z.object({ name: z.string() }).nullish();

/** Fields shared by both verticals' brochures. */
const commonBrochureFields = {
    slug: z.string(),
    name: z.string(),
    type: z.string(),
    summary: z.string().nullish(),
    description: z.string().nullish(),
    nameI18n: I18nTextLikeSchema,
    summaryI18n: I18nTextLikeSchema,
    descriptionI18n: I18nTextLikeSchema,
    openingHours: OpeningHoursLikeSchema,
    socialNetworks: SocialNetworksLikeSchema,
    media: MediaLikeSchema,
    destination: DestinationLikeSchema,
    amenities: z.array(AmenityLikeSchema).optional(),
    features: z.array(FeatureLikeSchema).optional()
};

/**
 * What a gastronomy brochure may read.
 *
 * No `contactInfo`: `GastronomyPublicSchema` does not pick it, so neither does
 * this — a phone number on the printed sheet would be a fact the public page
 * does not carry. `menuUrl` and `socialNetworks` are how a restaurant publishes
 * contact on this platform, and both ARE public.
 */
export const GastronomyBrochureSourceSchema = z.object({
    ...commonBrochureFields,
    priceRange: z.string().nullish(),
    menuUrl: z.string().nullish()
});

/** The gastronomy fields a brochure reads. */
export type GastronomyBrochureSource = z.infer<typeof GastronomyBrochureSourceSchema>;

/**
 * What an experience brochure may read.
 *
 * `contactInfo` is present but narrowed to the four fields
 * `ExperiencePublicContactInfoSchema` publishes. `whatsapp` is deliberately
 * absent — HOS-19 keeps it behind an authenticated endpoint, so it is not on
 * the ficha and must not be on paper.
 *
 * `meetingPoint` is public by an explicit owner decision (HOS-1048: where you
 * have to show up cannot be a paid feature), which is why it prints. The
 * coordinates are NOT read: a lat/long is unreadable on paper and the text
 * field is the one a person can follow.
 */
export const ExperienceBrochureSourceSchema = z.object({
    ...commonBrochureFields,
    priceFrom: z.number().nullish(),
    priceUnit: z.string().nullish(),
    isPriceOnRequest: z.boolean().nullish(),
    meetingPoint: z.string().nullish(),
    contactInfo: z
        .object({
            workEmail: z.string().nullish(),
            workPhone: z.string().nullish(),
            mobilePhone: z.string().nullish(),
            website: z.string().nullish()
        })
        .partial()
        .nullish()
});

/** The experience fields a brochure reads. */
export type ExperienceBrochureSource = z.infer<typeof ExperienceBrochureSourceSchema>;
