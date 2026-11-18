import { z } from 'zod';
import { PartnerTypeSlugSchema } from './partner-type.fields.js';
import { PartnerTypeSchema } from './partner-type.schema.js';

/**
 * Reference to a partner type embedded in admin partner reads (HOS-2336).
 * `lifecycleState` lets the admin form mark the partner's current type as
 * inactive without a second request (AC-4.1).
 */
export const PartnerTypeRefSchema = PartnerTypeSchema.pick({
    id: true,
    slug: true,
    nameI18n: true,
    lifecycleState: true
});

/**
 * The partner type as public partner reads carry it (spec D5).
 *
 * Public API reads are locale-agnostic and cached by URL, so there is no
 * "request locale" to resolve against: `name` is the Spanish name (the default
 * locale), and `nameI18n` carries every locale so the SSR page renders
 * `nameI18n[locale] || name` without a client fetch (AC-5.1).
 */
export const PartnerPublicTypeSchema = z.object({
    slug: PartnerTypeSlugSchema,
    name: z.string(),
    nameI18n: PartnerTypeSchema.shape.nameI18n
});

/** One partner type as the public catalog endpoint returns it. */
export const PublicPartnerTypeSchema = PartnerTypeSchema.pick({
    slug: true,
    nameI18n: true,
    displayWeight: true
});

/**
 * Response of `GET /api/v1/public/partner-types`: ACTIVE, non-deleted types
 * ordered by `displayWeight`, then Spanish name.
 */
export const PublicPartnerTypeListSchema = z.object({
    items: z.array(PublicPartnerTypeSchema)
});

/**
 * An admin list row: the full type plus how many non-deleted partners use it
 * (AC-3.1).
 */
export const PartnerTypeAdminListItemSchema = PartnerTypeSchema.extend({
    partnerCount: z.number().int().min(0)
});

/** Admin access: the full row. */
export const PartnerTypeAdminSchema = PartnerTypeSchema;

/** Inferred type of {@link PartnerTypeRefSchema}. */
export type PartnerTypeRef = z.infer<typeof PartnerTypeRefSchema>;
/** Inferred type of {@link PartnerPublicTypeSchema}. */
export type PartnerPublicType = z.infer<typeof PartnerPublicTypeSchema>;
/** Inferred type of {@link PublicPartnerTypeSchema}. */
export type PublicPartnerType = z.infer<typeof PublicPartnerTypeSchema>;
/** Inferred type of {@link PublicPartnerTypeListSchema}. */
export type PublicPartnerTypeList = z.infer<typeof PublicPartnerTypeListSchema>;
/** Inferred type of {@link PartnerTypeAdminListItemSchema}. */
export type PartnerTypeAdminListItem = z.infer<typeof PartnerTypeAdminListItemSchema>;
/** Inferred type of {@link PartnerTypeAdminSchema}. */
export type PartnerTypeAdmin = z.infer<typeof PartnerTypeAdminSchema>;
