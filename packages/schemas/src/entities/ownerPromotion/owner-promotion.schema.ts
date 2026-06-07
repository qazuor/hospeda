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
     * Downgrade-restriction flag (SPEC-167 §3, D-3). Set to `true` by the
     * apply-scheduled-plan-changes cron (and the admin `onAfterSubscriptionChangePlan`
     * hook) when a host downgrades and the active promotion count exceeds the target
     * plan's `MAX_ACTIVE_PROMOTIONS` cap. Cleared automatically on re-upgrade once the
     * host is back within cap.
     *
     * This flag is the per-promotion signal that the promotion was deactivated by a
     * downgrade restriction, so it can be selectively restored on re-upgrade without
     * touching promotions that were deactivated for other reasons (lifecycleState).
     * The two states MUST NOT collide (design decision D-3).
     *
     * Server-managed: never set through create/update input (it is omitted from those
     * schemas); only the downgrade-restriction flow mutates it.
     */
    planRestricted: z.boolean().default(false)
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
    deletedById: true,
    // Server-managed (SPEC-167 §3): only the downgrade-restriction flow flips this.
    planRestricted: true
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
export const OwnerPromotionUpdateInputSchema = OwnerPromotionCreateInputSchema.partial().strict();
export type OwnerPromotionUpdateInput = z.infer<typeof OwnerPromotionUpdateInputSchema>;

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
