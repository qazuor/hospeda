import { z } from 'zod';
import {
    EventIdSchema,
    EventLocationIdSchema,
    EventOrganizerIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { EventCategoryEnumSchema } from '../../enums/index.js';
import { EventSchema } from './event.schema.js';

/**
 * Service-layer schemas for Event entity. Centralized in @repo/schemas.
 * Mirrors the Destination approach: create/update + specific input DTOs.
 */

export const PaginationSchema = z
    .object({
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional()
    })
    .strict();

/**
 * Create Event input for service layer (omit server-managed fields)
 */
export const CreateEventServiceSchema = EventSchema.omit({
    id: true,
    slug: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
}).strict();
export type CreateEventInput = z.infer<typeof CreateEventServiceSchema>;

/**
 * Update Event input for service layer (partial of create)
 */
export const UpdateEventServiceSchema = z
    .object({
        id: EventIdSchema
    })
    .merge(CreateEventServiceSchema.partial().strict());
export type UpdateEventInput = z.infer<typeof UpdateEventServiceSchema>;

// Search & specialized inputs
export const GetByAuthorInputSchema = z
    .object({
        authorId: UserIdSchema
    })
    .merge(PaginationSchema)
    .strict();

export const GetByLocationInputSchema = z
    .object({
        locationId: EventLocationIdSchema
    })
    .merge(PaginationSchema)
    .strict();

export const GetByOrganizerInputSchema = z
    .object({
        organizerId: EventOrganizerIdSchema
    })
    .merge(PaginationSchema)
    .strict();

export const GetUpcomingInputSchema = z
    .object({
        fromDate: z.coerce.date(),
        toDate: z.coerce.date().optional()
    })
    .merge(PaginationSchema)
    .strict();

export const GetSummaryInputSchema = z
    .object({
        id: EventIdSchema
    })
    .strict();

export const GetByCategoryInputSchema = z
    .object({
        category: EventCategoryEnumSchema
    })
    .merge(PaginationSchema)
    .strict();

export const GetFreeInputSchema = PaginationSchema;

// Re-export search input for consumers expecting it from service schema
export { EventFilterInputSchema } from './event.schema.js';
