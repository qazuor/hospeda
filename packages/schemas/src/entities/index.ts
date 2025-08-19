export * from './accommodation/index.js';
export * from './destination/index.js';
// Use explicit re-exports for event to avoid name collisions (e.g., GetSummaryInputSchema)
export {
    // service inputs
    CreateEventServiceSchema,
    // requests
    EventCreateSchema,
    // date/location/organizer/price schemas
    EventDateSchema,
    EventDetailSchema,
    EventFilterInputSchema,
    EventFilterSchema,
    // responses
    EventListItemSchema,
    EventLocationSchema,
    EventOrganizerSchema,
    EventPriceSchema,
    // base
    EventSchema,
    EventSortInputSchema,
    EventSummarySchema,
    EventUpdateSchema,
    GetEventByAuthorInputSchema,
    GetEventByCategoryInputSchema,
    GetEventByLocationInputSchema,
    GetEventByOrganizerInputSchema,
    GetEventFreeInputSchema,
    // Renamed to avoid collision with Destination's GetSummaryInputSchema
    GetEventSummaryInputSchema,
    GetEventUpcomingInputSchema,
    UpdateEventServiceSchema
} from './event/index.js';
export * from './post/index.js';
export * from './tag/index.js';
export * from './user/index.js';
