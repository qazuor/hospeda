/**
 * Admin Destination Schemas
 *
 * All fields are available from base DestinationSchema:
 * - Location: destination.location.city, destination.location.country
 * - Attractions: destination.attractions (AttractionSchema objects)
 * - Status: destination.visibility, destination.lifecycleState, destination.moderationState
 *
 * Extends base schema with admin-only status fields (BUG-005)
 */

import {
    DestinationListItemSchema as BaseDestinationListItemSchema,
    LifecycleStatusEnumSchema,
    ModerationStatusEnumSchema,
    VisibilityEnumSchema
} from '@repo/schemas';
import { z } from 'zod';

/**
 * Admin Destination List Item Schema
 * Extends base with status fields not included in public list schema, plus the
 * attraction names projected by the admin list endpoint (string[]).
 */
export const DestinationListItemSchema = BaseDestinationListItemSchema.extend({
    visibility: VisibilityEnumSchema.optional(),
    lifecycleState: LifecycleStatusEnumSchema.optional(),
    moderationState: ModerationStatusEnumSchema.optional(),
    attractions: z
        .array(
            z.object({
                name: z.string(),
                icon: z.string().nullish()
            })
        )
        .optional()
});

/**
 * Type for destination list items with admin extensions
 */
export type Destination = z.infer<typeof DestinationListItemSchema>;
export type DestinationListItem = Destination;
