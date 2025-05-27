import { z } from 'zod';
import { EventCategoryEnumSchema } from '../../enums/event-category.enum.schema';
import { VisibilityEnumSchema } from '../../enums/visibility.enum.schema';
// import { EventLocationSchema } from './event.location.schema';
// import { EventOrganizerSchema } from './event.organizer.schema';
// import { EventSchema } from './event.schema';

/**
 * Event Extras Input schema definition using Zod for validation.
 * Represents additional input data for an event.
 */

// Inputs para relaciones (placeholders, reemplazar por schemas reales cuando existan)
export const NewEventLocationInputSchema = z.object({}); // TODO: reemplazar por EventLocationSchema.omit({ id: true, ... })
export const UpdateEventLocationInputSchema = NewEventLocationInputSchema.partial();

export const NewEventOrganizerInputSchema = z.object({}); // TODO: reemplazar por EventOrganizerSchema.omit({ id: true, ... })
export const UpdateEventOrganizerInputSchema = NewEventOrganizerInputSchema.partial();

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
    q: z.string().optional() // búsqueda libre
});

// Input para ordenamiento de resultados
export const EventSortInputSchema = z.object({
    sortBy: z.enum(['name', 'createdAt', 'date', 'category']).optional(),
    order: z.enum(['asc', 'desc']).optional()
});

// Input para acciones administrativas
export const EventSetFeaturedInputSchema = z.object({
    isFeatured: z.boolean()
});
export const EventChangeVisibilityInputSchema = z.object({
    visibility: VisibilityEnumSchema
});
