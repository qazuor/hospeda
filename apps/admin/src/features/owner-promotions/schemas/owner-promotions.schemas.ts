import { OwnerPromotionSchema } from '@repo/schemas';
import type { z } from 'zod';

/**
 * Admin Owner Promotion Schemas
 *
 * Creates a list item schema from the base OwnerPromotionSchema
 */
export const OwnerPromotionListItemSchema = OwnerPromotionSchema.pick({
    id: true,
    slug: true,
    ownerId: true,
    accommodationId: true,
    title: true,
    description: true,
    discountType: true,
    discountValue: true,
    minNights: true,
    validFrom: true,
    validUntil: true,
    maxRedemptions: true,
    currentRedemptions: true,
    isActive: true,
    createdAt: true,
    updatedAt: true
});

export const OwnerPromotionListItemClientSchema = OwnerPromotionListItemSchema;

/**
 * Type for owner promotion list items
 */
export type OwnerPromotion = z.infer<typeof OwnerPromotionListItemSchema>;
