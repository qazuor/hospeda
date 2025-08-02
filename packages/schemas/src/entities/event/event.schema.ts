import { z } from 'zod';
import { EventIdSchema, UserIdSchema } from '../../common/id.schema.js';
import {
    ContactInfoSchema,
    MediaSchema,
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithModerationStatusSchema,
    WithSeoSchema,
    WithTagsSchema,
    WithVisibilitySchema
} from '../../common/index.js';
import { BaseSearchSchema } from '../../common/search.schemas.js';
import { EventCategoryEnumSchema, VisibilityEnumSchema } from '../../enums/index.js';
import { EventDateSchema } from './event.date.schema.js';
import { EventPriceSchema } from './event.price.schema.js';

/**
 * Event schema definition using Zod for validation.
 * Includes date, location, organizer, and optional price and extras.
 */
export const EventSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithAdminInfoSchema)
    .merge(WithModerationStatusSchema)
    .merge(WithTagsSchema)
    .merge(WithSeoSchema)
    .merge(WithVisibilitySchema)
    .extend({
        id: EventIdSchema,
        slug: z
            .string({
                message: 'zodError.event.slug.required'
            })
            .min(1, { message: 'zodError.event.slug.min' }),
        /** Event name, 3-100 characters */
        name: z
            .string()
            .min(3, { message: 'zodError.event.name.min' })
            .max(100, { message: 'zodError.event.name.max' }),
        /** Event summary, 10-200 characters */
        summary: z
            .string()
            .min(10, { message: 'zodError.event.summary.min' })
            .max(200, { message: 'zodError.event.summary.max' }),
        /** Event description, optional, 10-1000 characters */
        description: z
            .string({
                message: 'zodError.event.description.required'
            })
            .min(10, { message: 'zodError.event.description.min' })
            .max(1000, { message: 'zodError.event.description.max' })
            .optional(),
        media: MediaSchema.optional(),
        category: EventCategoryEnumSchema,
        /** Event date object */
        date: EventDateSchema,
        authorId: UserIdSchema,
        /** Event location (ID only) */
        locationId: z
            .string({
                message: 'zodError.event.locationId.required'
            })
            .uuid({ message: 'zodError.event.locationId.invalidUuid' })
            .optional(),
        /** Event organizer (ID only) */
        organizerId: z
            .string({
                message: 'zodError.event.organizerId.required'
            })
            .uuid({ message: 'zodError.event.organizerId.invalidUuid' })
            .optional(),
        /** Event price, optional */
        pricing: EventPriceSchema.optional(),
        contact: ContactInfoSchema.optional(),
        isFeatured: z.boolean()
    });

// Input para filtros de búsqueda de eventos
export const EventFilterInputSchema = BaseSearchSchema.extend({
    filters: z
        .object({
            state: z.string().optional(),
            city: z.string().optional(),
            country: z.string().optional(),
            category: EventCategoryEnumSchema.optional(),
            visibility: VisibilityEnumSchema.optional(),
            isFeatured: z.boolean().optional(),
            minDate: z.string().optional(),
            maxDate: z.string().optional(),
            q: z.string().optional() // free text search
        })
        .optional()
});

// Input para ordenamiento de resultados
export const EventSortInputSchema = z.object({
    sortBy: z.enum(['name', 'createdAt', 'date', 'category']).optional(),
    order: z.enum(['asc', 'desc']).optional()
});
