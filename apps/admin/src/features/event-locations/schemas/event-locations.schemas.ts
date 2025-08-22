import { LifecycleStatusEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Event Location list item schema for admin interface
 */
export const EventLocationListItemSchema = z
    .object({
        id: z.string(),
        placeName: z.string().nullable().optional(),
        street: z.string().nullable().optional(),
        number: z.string().nullable().optional(),
        floor: z.string().nullable().optional(),
        apartment: z.string().nullable().optional(),
        neighborhood: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        department: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
        zipCode: z.string().nullable().optional(),
        latitude: z.number().nullable().optional(),
        longitude: z.number().nullable().optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional()
    })
    .passthrough();

export const EventLocationListItemClientSchema = EventLocationListItemSchema;

export type EventLocation = z.infer<typeof EventLocationListItemSchema>;
