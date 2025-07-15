import { EventOrganizerSchema } from '@repo/schemas';
import { z } from 'zod';

export const CreateEventOrganizerSchema = EventOrganizerSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
});
export const UpdateEventOrganizerSchema = EventOrganizerSchema.deepPartial();
export const SearchEventOrganizerSchema = z.object({
    filters: z
        .object({
            name: z.string().optional(),
            q: z.string().optional()
        })
        .optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20)
});
