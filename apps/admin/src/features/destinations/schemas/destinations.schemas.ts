/**
 * Admin Destination Schemas
 *
 * All fields are available from base DestinationSchema:
 * - Location: destination.location.city, destination.location.country
 * - Attractions: destination.attractions (AttractionSchema objects)
 * - Status: destination.visibility, destination.lifecycleState, destination.moderationState
 */

// Re-export base schemas - no admin extensions needed
export {
    DestinationListItemSchema,
    type Destination,
    type DestinationListItem
} from '@repo/schemas';
