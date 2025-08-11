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
    // Alias to avoid collision with Destination's GetSummaryInputSchema
    GetSummaryInputSchema as EventGetSummaryInputSchema,
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
    GetByAuthorInputSchema,
    GetByCategoryInputSchema,
    GetByLocationInputSchema,
    GetByOrganizerInputSchema,
    GetFreeInputSchema,
    GetUpcomingInputSchema,
    UpdateEventServiceSchema
} from './event/index.js';
export * from './post/index.js';
export * from './tag/index.js';
export * from './user/index.js';
