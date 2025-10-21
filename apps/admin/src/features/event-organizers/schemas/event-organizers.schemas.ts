/**
 * Admin Event Organizer Schemas
 *
 * All fields available from base EventOrganizerSchema:
 * - Social networks: eventOrganizer.socialNetworks.facebook, etc.
 * - Contact fields, lifecycle fields, admin fields from base schema
 *
 * Note: socialNetworks uses "linkedIn" (not "linkedin")
 */

// Re-export base schemas - no admin extensions needed
export {
    EventOrganizerListItemSchema,
    type EventOrganizer,
    type EventOrganizerListItem
} from '@repo/schemas';

// Client schema is identical to base - re-export for compatibility
export { EventOrganizerListItemSchema as EventOrganizerListItemClientSchema } from '@repo/schemas';
