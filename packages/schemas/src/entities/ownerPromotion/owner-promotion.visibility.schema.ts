/**
 * Free / VIP promotions model (HOS-2589): what a tourist-facing read returns.
 *
 * Every per-actor promotion read answers a list of items, each either `visible`
 * (the full card) or `locked` (blurred). A locked item carries ONLY what a free
 * visitor may learn (D-5): the discount value and type, the audience and a
 * placeholder of similar length where the place name would be. It never carries
 * an id, slug, title, description, condition, code, owner or link (G-4, AC-8), and
 * the schema is `.strict()` so a field added by mistake fails the response check.
 */
import { z } from 'zod';
import { OwnerPromotionDiscountTypeEnumSchema } from '../../enums/owner-promotion-discount-type.schema.js';
import { OwnerPromotionEntityTypeEnumSchema } from '../../enums/owner-promotion-entity-type.schema.js';
import { TouristAudienceEnumSchema } from '../../enums/tourist-audience.schema.js';
import { PromotionWindowSchema } from './owner-promotion.venue.schema.js';

/**
 * The session seed a client sends so its random pick is stable (D-7). Opaque, no
 * personal data. A missing or malformed seed is dropped (the server picks a fresh
 * one), never a 400: the read must still answer.
 */
export const PromotionSeedSchema = z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,64}$/)
    .optional()
    .catch(undefined);

/** The place a visible promotion belongs to, for its link. */
export const PromotionPlaceSchema = z
    .object({
        id: z.string().uuid(),
        slug: z.string().min(1),
        name: z.string().min(1)
    })
    .strict();
export type PromotionPlace = z.infer<typeof PromotionPlaceSchema>;

/** A promotion the actor may see: the full card. */
export const PromotionVisibleItemSchema = z
    .object({
        kind: z.literal('visible'),
        audience: TouristAudienceEnumSchema,
        entityType: OwnerPromotionEntityTypeEnumSchema,
        id: z.string().uuid(),
        slug: z.string().min(1),
        title: z.string(),
        description: z.string().nullable(),
        discountType: OwnerPromotionDiscountTypeEnumSchema,
        discountValue: z.number().int(),
        minNights: z.number().int().nullable(),
        validFrom: z.coerce.date(),
        validUntil: z.coerce.date().nullable(),
        window: PromotionWindowSchema.nullable(),
        /** `null` for an owner-wide accommodation promotion, or when the place is not public. */
        place: PromotionPlaceSchema.nullable()
    })
    .strict();
export type PromotionVisibleItem = z.infer<typeof PromotionVisibleItemSchema>;

/** A promotion the actor may not see: blurred, value and type only (D-5). */
export const PromotionLockedItemSchema = z
    .object({
        kind: z.literal('locked'),
        /** Opaque, per-response index for React keys. Not derived from the promotion. */
        key: z.string().min(1),
        audience: TouristAudienceEnumSchema,
        entityType: OwnerPromotionEntityTypeEnumSchema,
        discountType: OwnerPromotionDiscountTypeEnumSchema,
        discountValue: z.number().int(),
        /** Filler letters of about the real name's length; the UI blurs it. */
        placeholderName: z.string().min(1)
    })
    .strict();
export type PromotionLockedItem = z.infer<typeof PromotionLockedItemSchema>;

/** One item of a per-actor promotion read. */
export const PromotionVisibilityItemSchema = z.discriminatedUnion('kind', [
    PromotionVisibleItemSchema,
    PromotionLockedItemSchema
]);
export type PromotionVisibilityItem = z.infer<typeof PromotionVisibilityItemSchema>;

/** Who read the list: whether every promotion is visible, and the free quota used. */
export const PromotionVisibilityMetaSchema = z
    .object({
        isVip: z.boolean(),
        /** The X of the model as read from the catalog; 0 on a failed read (fail-closed). */
        freeQuota: z.number().int().min(0)
    })
    .strict();
export type PromotionVisibilityMeta = z.infer<typeof PromotionVisibilityMetaSchema>;

/** Query of `GET /public/owner-promotions/visible` (one listing's promotions). */
export const PromotionVisibleQuerySchema = z.object({
    entityType: OwnerPromotionEntityTypeEnumSchema,
    entityId: z.string().uuid(),
    seed: PromotionSeedSchema
});
export type PromotionVisibleQuery = z.infer<typeof PromotionVisibleQuerySchema>;

/** Response data of `GET /public/owner-promotions/visible`. */
export const PromotionVisibleResponseSchema = z.object({
    items: z.array(PromotionVisibilityItemSchema),
    meta: PromotionVisibilityMetaSchema
});
export type PromotionVisibleResponse = z.infer<typeof PromotionVisibleResponseSchema>;

/** Query of `GET /public/owner-promotions/listing` (the `/promociones/` page). */
export const PromotionListingQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(48).default(12),
    seed: PromotionSeedSchema
});
export type PromotionListingQuery = z.infer<typeof PromotionListingQuerySchema>;

/** Response data of `GET /public/owner-promotions/listing`. */
export const PromotionListingResponseSchema = z.object({
    items: z.array(PromotionVisibilityItemSchema),
    meta: PromotionVisibilityMetaSchema,
    pagination: z.object({
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1),
        total: z.number().int().min(0),
        totalPages: z.number().int().min(0)
    })
});
export type PromotionListingResponse = z.infer<typeof PromotionListingResponseSchema>;

/**
 * Public, session-blind catalog facts the host form and the upsell dialog quote
 * (`GET /public/plans/promotion-model`): X and the VIP plan name, never literals.
 */
export const PromotionModelInfoSchema = z
    .object({
        /** `max_free_visible_promotions` on the TOURIST floor plan's current version. */
        freeQuota: z.number().int().min(0),
        /** Display name of the sellable TOURIST plan that grants `vip_promotions_access`. */
        vipPlanName: z.string().nullable()
    })
    .strict();
export type PromotionModelInfo = z.infer<typeof PromotionModelInfoSchema>;
