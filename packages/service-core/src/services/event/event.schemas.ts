/**
 * Schemas for EventService.
 * Re-export and extend Zod schemas for events as needed.
 * Follows the pattern of other service schemas files.
 */

import {
    EventCategoryEnumSchema,
    EventFilterInputSchema,
    EventIdSchema,
    EventLocationIdSchema,
    EventOrganizerIdSchema,
    EventSchema,
    UserIdSchema
} from '@repo/schemas';
import { z } from 'zod';

/**
 * Pagination schema for list endpoints.
 */
export const PaginationSchema = z
    .object({
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional()
    })
    .strict();

/**
 * Input: Get events by author
 */
export const GetByAuthorInputSchema = z
    .object({
        authorId: UserIdSchema
    })
    .merge(PaginationSchema);

/**
 * Input: Get events by location
 */
export const GetByLocationInputSchema = z
    .object({
        locationId: EventLocationIdSchema
    })
    .merge(PaginationSchema);

/**
 * Input: Get events by organizer
 */
export const GetByOrganizerInputSchema = z
    .object({
        organizerId: EventOrganizerIdSchema
    })
    .merge(PaginationSchema)
    .strict();

/**
 * Input: Get upcoming events (by date range)
 */
export const GetUpcomingInputSchema = z
    .object({
        fromDate: z.coerce.date(),
        toDate: z.coerce.date().optional()
    })
    .merge(PaginationSchema)
    .strict();

/**
 * Input: Get event summary by ID
 */
export const GetSummaryInputSchema = z
    .object({
        id: EventIdSchema
    })
    .strict();

/**
 * Input: Get events by category
 */
export const GetByCategoryInputSchema = z
    .object({
        category: EventCategoryEnumSchema
    })
    .merge(PaginationSchema)
    .strict();

/**
 * Input: Get free events (isFree)
 */
export const GetFreeInputSchema = PaginationSchema;

/**
 * Input: Create event (omit id, createdAt, updatedAt)
 */
export const EventCreateSchema = EventSchema.omit({
    id: true,
    slug: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
}).strict();

/**
 * Input: Update event (all fields optional except id, which is required)
 */
export const EventUpdateSchema = z
    .object({
        id: EventIdSchema
    })
    .merge(EventCreateSchema.deepPartial().strict());

// Re-export base schemas
export { EventFilterInputSchema, EventSchema };
