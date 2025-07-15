import { EventLocationSchema } from '@repo/schemas';
import { z } from 'zod';

/**
 * Zod schema for creating an event location.
 */
export const CreateEventLocationSchema = EventLocationSchema;
export type CreateEventLocationInput = z.infer<typeof CreateEventLocationSchema>;

/**
 * Zod schema for updating an event location (deep partial).
 */
export const UpdateEventLocationSchema = EventLocationSchema.deepPartial();
export type UpdateEventLocationInput = z.infer<typeof UpdateEventLocationSchema>;

/**
 * Zod schema for searching event locations (by city, state, etc.).
 */
export const SearchEventLocationSchema = z.object({
    filters: z
        .object({
            city: z.string().optional(),
            state: z.string().optional(),
            country: z.string().optional(),
            q: z.string().optional() // free text search
        })
        .optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20)
});
export type SearchEventLocationInput = z.infer<typeof SearchEventLocationSchema>;
