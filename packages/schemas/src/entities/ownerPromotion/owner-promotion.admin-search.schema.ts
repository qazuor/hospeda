import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { OwnerPromotionDiscountTypeEnumSchema } from '../../enums/index.js';

/**
 * Admin search schema for owner promotions.
 * Extends base admin search with promotion-specific filters.
 *
 * Lifecycle state filtering is inherited from `AdminSearchBaseSchema.status`,
 * which the base `adminList()` maps to the `lifecycleState` column.
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
        OwnerPromotionDiscountTypeEnumSchema.optional().describe('Filter by discount type')
});

export type OwnerPromotionAdminSearch = z.infer<typeof OwnerPromotionAdminSearchSchema>;
