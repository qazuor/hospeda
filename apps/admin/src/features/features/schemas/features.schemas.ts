/**
 * Admin Feature Schemas
 *
 * Base fields available from FeatureSchema:
 * - Lifecycle: feature.lifecycleState
 *
 * Admin Extensions:
 * - accommodationCount: Admin-specific count for management dashboard
 */

import { FeatureListItemSchema as BaseFeatureListItemSchema } from '@repo/schemas';
import { z } from 'zod';

/**
 * Admin Feature List Item Schema - Only admin-specific extensions
 */
export const FeatureListItemSchema = BaseFeatureListItemSchema.extend({
    // Admin-specific count for management UI
    accommodationCount: z.number().optional()
});

/**
 * Type for feature list items with admin extensions
 */
export type Feature = z.infer<typeof FeatureListItemSchema>;
