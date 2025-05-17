import { z } from 'zod';
import { BaseEntitySchema, BaseLocationSchema } from '../../common.schema.js';

/**
 * Zod schema for a event location entity.
 */
export const EventLocationSchema = BaseEntitySchema.merge(BaseLocationSchema).extend({
    street: z
        .string()
        .min(10, 'error:event.location.street.min_lenght')
        .max(150, 'error:event.location.street.max_lenght')
        .optional(),
    number: z
        .string()
        .min(10, 'error:event.location.number.min_lenght')
        .max(150, 'error:event.location.number.max_lenght')
        .optional(),
    floor: z
        .string()
        .min(10, 'error:event.location.floor.min_lenght')
        .max(150, 'error:event.location.floor.max_lenght')
        .optional(),
    apartment: z
        .string()
        .min(10, 'error:event.location.apartment.min_lenght')
        .max(150, 'error:event.location.apartment.max_lenght')
        .optional(),
    neighborhood: z
        .string()
        .min(10, 'error:event.location.neighborhood.min_lenght')
        .max(150, 'error:event.location.neighborhood.max_lenght')
        .optional(),
    city: z
        .string()
        .min(10, 'error:event.location.city.min_lenght')
        .max(150, 'error:event.location.city.max_lenght')
        .optional(),
    deparment: z
        .string()
        .min(10, 'error:event.location.deparment.min_lenght')
        .max(150, 'error:event.location.deparment.max_lenght')
        .optional(),
    placeName: z
        .string()
        .min(10, 'error:event.location.placeName.min_lenght')
        .max(150, 'error:event.location.placeName.max_lenght')
        .optional()
});

export type EventLocationInput = z.infer<typeof EventLocationSchema>;
