import type { EventLocationListItem } from '@repo/schemas';
import {
    EventLocationListItemSchema as BaseEventLocationListItemSchema,
    LifecycleStatusEnum
} from '@repo/schemas';
import { z } from 'zod';

/**
 * Schema for event location list items in admin
 * Extends the base EventLocationListItemSchema with admin-specific fields
 */
export const EventLocationListItemSchema = BaseEventLocationListItemSchema.extend({
    // Admin-specific fields for list management
    floor: z.string().nullable().optional(),
    apartment: z.string().nullable().optional(),
    neighborhood: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()
});

export const EventLocationListItemClientSchema = EventLocationListItemSchema;

export type EventLocation = EventLocationListItem & {
    floor?: string | null;
    apartment?: string | null;
    neighborhood?: string | null;
    department?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    lifecycleState?: LifecycleStatusEnum;
};
