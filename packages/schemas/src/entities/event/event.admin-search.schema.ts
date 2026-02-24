/**
 * Admin Search Schema for Events
 *
 * Extends the base admin search schema with event-specific filters
 * for use in admin list endpoints.
 */
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { EventCategoryEnumSchema } from '../../enums/index.js';

/**
 * Admin search schema for events.
 * Extends base admin search with event-specific filters.
 *
 * @example
 * ```ts
 * const params = EventAdminSearchSchema.parse({
 *   page: 1,
 *   category: 'MUSIC',
 *   isFeatured: true,
 *   startDateAfter: '2025-01-01T00:00:00.000Z',
 *   endDateBefore: '2025-12-31T23:59:59.999Z'
 * });
 * ```
 */
export const EventAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by event category */
    category: EventCategoryEnumSchema.optional().describe('Filter by event category'),

    /** Filter by event location UUID */
    locationId: z
        .string()
        .uuid({ message: 'zodError.admin.search.event.locationId.uuid' })
        .optional()
        .describe('Filter by event location'),

    /** Filter by event organizer UUID */
    organizerId: z
        .string()
        .uuid({ message: 'zodError.admin.search.event.organizerId.uuid' })
        .optional()
        .describe('Filter by event organizer'),

    /** Filter by author/creator UUID */
    authorId: z
        .string()
        .uuid({ message: 'zodError.admin.search.event.authorId.uuid' })
        .optional()
        .describe('Filter by event author'),

    /** Filter featured events */
    isFeatured: z.coerce.boolean().optional().describe('Filter by featured status'),

    /** Filter events starting after this date */
    startDateAfter: z.coerce.date().optional().describe('Filter events starting after this date'),

    /** Filter events starting before this date */
    startDateBefore: z.coerce.date().optional().describe('Filter events starting before this date'),

    /** Filter events ending after this date */
    endDateAfter: z.coerce.date().optional().describe('Filter events ending after this date'),

    /** Filter events ending before this date */
    endDateBefore: z.coerce.date().optional().describe('Filter events ending before this date')
});

/**
 * Type inferred from {@link EventAdminSearchSchema}.
 * Represents the validated admin search parameters for events.
 */
export type EventAdminSearch = z.infer<typeof EventAdminSearchSchema>;
