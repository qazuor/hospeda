import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    AccommodationIdSchema,
    OwnerPromotionIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { OwnerPromotionDiscountTypeEnumSchema } from '../../enums/owner-promotion-discount-type.schema.js';
import { TouristAudienceEnum } from '../../enums/tourist-audience.enum.js';
import { TouristAudienceEnumSchema } from '../../enums/tourist-audience.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';

/**
 * Owner Promotion entity schema
 */
export const OwnerPromotionSchema = z.object({
    id: OwnerPromotionIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,

    slug: z
        .string({
            message: 'zodError.ownerPromotion.slug.required'
        })
        .min(1, { message: 'zodError.ownerPromotion.slug.min' }),

    ownerId: UserIdSchema,
    accommodationId: AccommodationIdSchema.nullable().optional(),

    title: z
        .string({
            message: 'zodError.ownerPromotion.title.required'
        })
        .min(1, { message: 'zodError.ownerPromotion.title.min' })
        .max(200, { message: 'zodError.ownerPromotion.title.max' }),

    description: z
        .string()
        .max(1000, { message: 'zodError.ownerPromotion.description.max' })
        .optional()
        .nullable(),

    discountType: OwnerPromotionDiscountTypeEnumSchema,

    discountValue: z
        .number({
            message: 'zodError.ownerPromotion.discountValue.required'
        })
        .min(0, { message: 'zodError.ownerPromotion.discountValue.min' }),

    minNights: z
        .number()
        .int({ message: 'zodError.ownerPromotion.minNights.int' })
        .min(1, { message: 'zodError.ownerPromotion.minNights.min' })
        .nullable()
        .optional(),

    validFrom: z.coerce.date({
        message: 'zodError.ownerPromotion.validFrom.required'
    }),

    validUntil: z.coerce
        .date({
            message: 'zodError.ownerPromotion.validUntil.invalid'
        })
        .nullable()
        .optional(),

    maxRedemptions: z
        .number()
        .int({ message: 'zodError.ownerPromotion.maxRedemptions.int' })
        .min(1, { message: 'zodError.ownerPromotion.maxRedemptions.min' })
        .nullable()
        .optional(),

    currentRedemptions: z
        .number()
        .int({ message: 'zodError.ownerPromotion.currentRedemptions.int' })
        .min(0, { message: 'zodError.ownerPromotion.currentRedemptions.min' })
        .default(0),

    /**
     * Tourist-tier visibility gate (HOS-21 D1). Additive: 'vip' tourists see
     * 'plus' + 'vip' rows, 'plus' tourists see 'plus' only. Owner self-service
     * (HOS-21 D2) — set directly through create/update, not server-managed.
     */
    touristAudience: TouristAudienceEnumSchema.default(TouristAudienceEnum.PLUS)
});
export type OwnerPromotion = z.infer<typeof OwnerPromotionSchema>;

/**
 * Create input for owner promotion
 */
export const OwnerPromotionCreateInputSchema = OwnerPromotionSchema.omit({
    id: true,
    currentRedemptions: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
}).extend({
    slug: z
        .string({
            message: 'zodError.ownerPromotion.slug.required'
        })
        .min(1, { message: 'zodError.ownerPromotion.slug.min' })
        .optional()
});
export type OwnerPromotionCreateInput = z.infer<typeof OwnerPromotionCreateInputSchema>;

/**
 * Update input for owner promotion.
 *
 * SPEC-063-gaps T-017 (GAP-016, AC-002-02): `.strict()` enforces that legacy keys
 * (e.g. `isActive`) are rejected at the route boundary with a 400 VALIDATION_ERROR
 * instead of being silently dropped by the Hono zValidator middleware.
 */
// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
export const OwnerPromotionUpdateInputSchema = z
    .object(stripShapeDefaults(OwnerPromotionCreateInputSchema.shape))
    .partial()
    .strict();
export type OwnerPromotionUpdateInput = z.infer<typeof OwnerPromotionUpdateInputSchema>;

/**
 * Client-facing create request schema for owner promotions.
 *
 * Omits `ownerId` so the client cannot supply or forge it.
 * The route handler injects `ownerId` from the authenticated session actor.
 * This is the schema used as `requestBody` on POST /api/v1/protected/owner-promotions.
 */
export const OwnerPromotionCreateRequestSchema = OwnerPromotionCreateInputSchema.omit({
    ownerId: true
});
export type OwnerPromotionCreateRequest = z.infer<typeof OwnerPromotionCreateRequestSchema>;

/**
 * Search input for owner promotions
 */
export const OwnerPromotionSearchSchema = z.object({
    ownerId: UserIdSchema.optional(),
    accommodationId: AccommodationIdSchema.optional(),
    discountType: OwnerPromotionDiscountTypeEnumSchema.optional(),
    lifecycleState: LifecycleStatusEnumSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    // SPEC-063-gaps T-031 (GAP-041): `limit` → `pageSize` (monorepo convention).
    pageSize: z.coerce.number().int().min(1).max(100).default(20)
});
export type OwnerPromotionSearchInput = z.infer<typeof OwnerPromotionSearchSchema>;
