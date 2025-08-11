import { z } from 'zod';
import { EventSchema } from './event.schema.js';

/**
 * API response schemas for Event entity.
 */

export const EventListItemSchema = EventSchema.pick({
    id: true,
    slug: true,
    name: true,
    category: true,
    date: true,
    media: true,
    isFeatured: true
}).strict();
export type EventListItem = z.infer<typeof EventListItemSchema>;

export const EventDetailSchema = EventSchema;
export type EventDetail = z.infer<typeof EventDetailSchema>;

export const EventSummarySchema = z
    .object({
        id: z.string().uuid(),
        slug: z.string(),
        name: z.string(),
        category: z.string(),
        date: z.object({ start: z.string(), end: z.string().optional() }),
        media: z
            .object({
                featuredImage: z
                    .object({ url: z.string().url(), caption: z.string().optional() })
                    .optional()
            })
            .optional(),
        isFeatured: z.boolean()
    })
    .strict();
export type EventSummaryResponse = z.infer<typeof EventSummarySchema>;
