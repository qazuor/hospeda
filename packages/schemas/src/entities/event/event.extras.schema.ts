import { z } from 'zod';
import { MediaSchema } from '../../common/media.schema';
import { TagSchema } from '../../common/tag.schema';
import { EventCategoryEnumSchema } from '../../enums/event-category.enum.schema';
import { UserSchema } from '../user/user.schema';
import { EventDateSchema } from './event.date.schema';
import { EventLocationSchema } from './event.location.schema';
import { EventOrganizerSchema } from './event.organizer.schema';

/**
 * Event Extras schema definition using Zod for validation.
 * Represents additional information for an event.
 */

export const EventSummarySchema = z.object({
    id: z.string(),
    slug: z
        .string()
        .min(3, { message: 'zodError.event.slug.min' })
        .max(50, { message: 'zodError.event.slug.max' }),
    summary: z
        .string()
        .min(10, { message: 'zodError.event.summary.min' })
        .max(200, { message: 'zodError.event.summary.max' }),
    category: EventCategoryEnumSchema,
    date: EventDateSchema,
    media: MediaSchema.optional(),
    isFeatured: z.boolean().optional()
});

export const EventWithRelationsSchema = z.object({
    id: z.string(),
    slug: z
        .string()
        .min(3, { message: 'zodError.event.slug.min' })
        .max(50, { message: 'zodError.event.slug.max' }),
    summary: z
        .string()
        .min(10, { message: 'zodError.event.summary.min' })
        .max(200, { message: 'zodError.event.summary.max' }),
    description: z
        .string()
        .min(10, { message: 'zodError.event.description.min' })
        .max(2000, { message: 'zodError.event.description.max' })
        .optional(),
    media: MediaSchema.optional(),
    category: EventCategoryEnumSchema,
    date: EventDateSchema,
    author: UserSchema.optional(),
    location: EventLocationSchema.optional(),
    organizer: EventOrganizerSchema.optional(),
    tags: z.array(TagSchema).optional()
});
