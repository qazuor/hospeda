import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    AccommodationIdSchema,
    OwnerPromotionIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { OwnerPromotionDiscountTypeEnumSchema } from '../../enums/owner-promotion-discount-type.schema.js';

/**
 * Owner Promotion entity schema
 */
export const OwnerPromotionSchema = z.object({
    id: OwnerPromotionIdSchema,
    ...BaseAuditFields,

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

    isActive: z.boolean().default(true)
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
 * Update input for owner promotion
 */
export const OwnerPromotionUpdateInputSchema = OwnerPromotionCreateInputSchema.partial();
export type OwnerPromotionUpdateInput = z.infer<typeof OwnerPromotionUpdateInputSchema>;

/**
 * Search input for owner promotions
 */
export const OwnerPromotionSearchSchema = z.object({
    ownerId: UserIdSchema.optional(),
    accommodationId: AccommodationIdSchema.optional(),
    discountType: OwnerPromotionDiscountTypeEnumSchema.optional(),
    isActive: z.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
});
export type OwnerPromotionSearchInput = z.infer<typeof OwnerPromotionSearchSchema>;
