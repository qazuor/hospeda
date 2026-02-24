import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { OwnerPromotionDiscountTypeEnumSchema } from '../../enums/index.js';

/**
 * Admin search schema for owner promotions.
 * Extends base admin search with promotion-specific filters.
 */
export const OwnerPromotionAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by accommodation UUID */
    accommodationId: z
        .string()
        .uuid({ message: 'zodError.admin.search.ownerPromotion.accommodationId.uuid' })
        .optional()
        .describe('Filter by accommodation'),
    /** Filter by owner UUID */
    ownerId: z
        .string()
        .uuid({ message: 'zodError.admin.search.ownerPromotion.ownerId.uuid' })
        .optional()
        .describe('Filter by owner'),
    /** Filter by discount type */
    discountType:
        OwnerPromotionDiscountTypeEnumSchema.optional().describe('Filter by discount type'),
    /** Filter by active status */
    isActive: z.coerce.boolean().optional().describe('Filter by active status')
});

export type OwnerPromotionAdminSearch = z.infer<typeof OwnerPromotionAdminSearchSchema>;
