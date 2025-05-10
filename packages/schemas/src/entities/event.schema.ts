import { z } from 'zod';
import {
    AdminInfoSchema,
    BaseEntitySchema,
    ContactInfoSchema,
    LocationSchema,
    MediaSchema,
    SeoSchema
} from '../common.schema';
import { EventCategoryEnumSchema, VisibilityEnumSchema } from '../enums.schema';

/**
 * Defines the time and recurrence pattern of an event.
 */
export const EventDateSchema = z.object({
    start: z.date(),
    end: z.date(),
    isAllDay: z.boolean().optional(),

    /**
     * Recurrence rule, e.g., 'DAILY', 'WEEKLY'.
     */
    recurrence: z.string().optional()
});

/**
 * Represents price details for an event.
 */
export const EventPriceSchema = z.object({
    isFree: z.boolean(),

    /**
     * Optional currency used for paid events.
     */
    currency: z.string().length(3).optional(),

    /**
     * Minimum price (if tiered pricing is supported).
     */
    priceFrom: z.number().nonnegative().optional(),

    /**
     * Maximum price for full ticket.
     */
    priceTo: z.number().nonnegative().optional()
});

/**
 * Organizing entity or host of the event.
 */
export const EventOrganizerSchema = z.object({
    name: z.string().min(1),
    logo: z.string().url().optional(),
    website: z.string().url().optional()
});

/**
 * Schema for full event entity.
 */
export const EventSchema = BaseEntitySchema.extend({
    slug: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    summary: z.string().optional(),

    media: MediaSchema,
    category: EventCategoryEnumSchema,
    tags: z.array(z.string()).optional(),

    location: LocationSchema,
    date: EventDateSchema,

    pricing: EventPriceSchema.optional(),
    organizer: EventOrganizerSchema.optional(),
    contact: ContactInfoSchema.optional(),

    authorId: z.string().uuid(),

    isFeatured: z.boolean().optional(),
    visibility: VisibilityEnumSchema,

    seo: SeoSchema.optional(),
    adminInfo: AdminInfoSchema.optional()
});
