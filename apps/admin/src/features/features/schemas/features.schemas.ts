import type { FeatureListItem } from '@repo/schemas';
import {
    FeatureListItemSchema as BaseFeatureListItemSchema,
    LifecycleStatusEnum
} from '@repo/schemas';
import { z } from 'zod';

/**
 * Schema for feature list items in admin
 * Extends the base FeatureListItemSchema with admin-specific fields
 */
export const FeatureListItemSchema = BaseFeatureListItemSchema.extend({
    // Admin-specific fields for list management
    accommodationCount: z.number().optional(),
    lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()
});

export type Feature = FeatureListItem & {
    accommodationCount?: number;
    lifecycleState?: LifecycleStatusEnum;
};
