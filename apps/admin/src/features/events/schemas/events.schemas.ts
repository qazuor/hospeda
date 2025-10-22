/**
 * Admin Event Schemas
 *
 * Base fields available from EventListItemWithRelationsSchema:
 * - Category: event.category
 * - Location: event.location (full relation object, can be null)
 * - Organizer: event.organizer (full relation object, can be null)
 * - Dates: event.date.start, event.date.end
 * - Pricing: event.pricing?.price, event.pricing?.currency
 * - Status: event.visibility, event.lifecycleState, event.moderationState, event.tags
 */

import { EventListItemWithRelationsSchema } from '@repo/schemas';
import { z } from 'zod';

/**
 * Admin Event List Item Schema - Extends base with computed fields for null handling
 */
export const EventListItemSchema = EventListItemWithRelationsSchema.extend({
    // Computed fields for admin display when relations are null
    organizerName: z
        .string()
        .optional()
        .transform((val) => val || 'No organizer'),
    locationName: z
        .string()
        .optional()
        .transform((val) => val || 'No location')
}).transform((data) => ({
    ...data,
    // Ensure we have fallback values for null relations
    organizerName: data.organizer?.name || 'No organizer',
    locationName: data.location?.city || data.location?.placeName || 'No location'
}));

/**
 * Type for event list items with admin extensions
 */
export type Event = z.infer<typeof EventListItemSchema>;
