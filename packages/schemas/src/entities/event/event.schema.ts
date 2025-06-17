import { z } from 'zod';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithModerationStatusSchema,
    WithSeoSchema,
    WithTagsSchema
} from '../../common/index.js';
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
    .extend({
        /** Event title, 3-100 characters */
        title: z
            .string()
            .min(3, { message: 'zodError.event.title.min' })
            .max(100, { message: 'zodError.event.title.max' }),
        /** Event description, optional, 10-1000 characters */
        description: z
            .string({
                required_error: 'zodError.event.description.required',
                invalid_type_error: 'zodError.event.description.invalidType'
            })
            .min(10, { message: 'zodError.event.description.min' })
            .max(1000, { message: 'zodError.event.description.max' })
            .optional(),
        /** Event date object */
        date: EventDateSchema,
        /** Event location (ID only) */
        locationId: z
            .string({
                required_error: 'zodError.event.locationId.required',
                invalid_type_error: 'zodError.event.locationId.invalidType'
            })
            .uuid({ message: 'zodError.event.locationId.invalidUuid' }),
        /** Event organizer (ID only) */
        organizerId: z
            .string({
                required_error: 'zodError.event.organizerId.required',
                invalid_type_error: 'zodError.event.organizerId.invalidType'
            })
            .uuid({ message: 'zodError.event.organizerId.invalidUuid' }),
        /** Event price, optional */
        price: EventPriceSchema.optional()
    });

// Input para filtros de búsqueda de eventos
export const EventFilterInputSchema = z.object({
    state: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    category: EventCategoryEnumSchema.optional(),
    visibility: VisibilityEnumSchema.optional(),
    isFeatured: z.boolean().optional(),
    minDate: z.string().optional(),
    maxDate: z.string().optional(),
    q: z.string().optional() // free text search
});

// Input para ordenamiento de resultados
export const EventSortInputSchema = z.object({
    sortBy: z.enum(['name', 'createdAt', 'date', 'category']).optional(),
    order: z.enum(['asc', 'desc']).optional()
});
