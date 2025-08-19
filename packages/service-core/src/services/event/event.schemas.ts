/**
 * Schemas for EventService.
 * Re-export and extend Zod schemas for events as needed.
 * Follows the pattern of other service schemas files.
 */

export {
    // service-layer (centralized in @repo/schemas)
    CreateEventServiceSchema as EventCreateSchema,
    EventFilterInputSchema,
    // base
    EventSchema,
    UpdateEventServiceSchema as EventUpdateSchema,
    GetEventByAuthorInputSchema,
    GetEventByCategoryInputSchema,
    GetEventByLocationInputSchema,
    GetEventByOrganizerInputSchema,
    GetEventFreeInputSchema,
    GetEventUpcomingInputSchema,
    // Renamed to avoid collision with Destination's schema
    GetEventSummaryInputSchema as GetSummaryInputSchema
} from '@repo/schemas';
// No local zod schemas here; we fully depend on @repo/schemas to avoid drift.

/**
 * Pagination schema for list endpoints.
 */
// Keep the file exporting the API used by EventService, but delegating to @repo/schemas
