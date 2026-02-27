import {
    AttractionWithDestinationCountSchema as BaseAttractionListItemSchema,
    LifecycleStatusEnumSchema,
    ModerationStatusEnumSchema,
    VisibilityEnumSchema
} from '@repo/schemas';
import type { z } from 'zod';

/**
 * Admin Attraction Schemas
 *
 * Extends base schema with admin-only status fields (BUG-005)
 */
export const AttractionListItemSchema = BaseAttractionListItemSchema.extend({
    visibility: VisibilityEnumSchema.optional(),
    lifecycleState: LifecycleStatusEnumSchema.optional(),
    moderationState: ModerationStatusEnumSchema.optional()
});

/**
 * Type for attraction list items
 */
export type Attraction = z.infer<typeof AttractionListItemSchema>;
