/**
 * Admin Event Schemas
 *
 * Base fields available from EventSchema:
 * - Category: event.category
 * - Location: event.locationId
 * - Organizer: event.organizerId
 * - Dates: event.date.start, event.date.end
 * - Pricing: event.pricing?.price, event.pricing?.currency
 * - Status: event.visibility, event.lifecycleState, event.moderationState, event.tags
 *
 * Admin Extensions:
 * - organizerName, locationName: Display names for admin UI
 * - capacity: Admin-specific capacity management
 */

import { EventListItemSchema as BaseEventListItemSchema } from '@repo/schemas';
import { z } from 'zod';

/**
 * Admin Event List Item Schema - Extends base with admin display fields
 */
export const EventListItemSchema = BaseEventListItemSchema.extend({
    // Display names for admin list (fetched via joins/relations)
    organizerName: z.string().optional(),
    locationName: z.string().optional(),

    // Admin-specific capacity override
    capacity: z.number().optional()
});

/**
 * Type for event list items with admin extensions
 */
export type Event = z.infer<typeof EventListItemSchema>;
