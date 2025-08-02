import { z } from 'zod';
import {
    EventLocationIdSchema,
    LocationSchema,
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema
} from '../../common/index.js';

/**
 * Event Location schema definition using Zod for validation.
 * Represents the location details for an event.
 */
export const EventLocationSchema = LocationSchema.merge(WithIdSchema)
    .merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        id: EventLocationIdSchema,
        street: z
            .string()
            .min(2, { message: 'zodError.event.location.street.min' })
            .max(50, { message: 'zodError.event.location.street.max' })
            .optional(),
        number: z
            .string()
            .min(1, { message: 'zodError.event.location.number.min' })
            .max(10, { message: 'zodError.event.location.number.max' })
            .optional(),
        floor: z
            .string()
            .min(1, { message: 'zodError.event.location.floor.min' })
            .max(10, { message: 'zodError.event.location.floor.max' })
            .optional(),
        apartment: z
            .string()
            .min(1, { message: 'zodError.event.location.apartment.min' })
            .max(10, { message: 'zodError.event.location.apartment.max' })
            .optional(),
        neighborhood: z
            .string()
            .min(2, { message: 'zodError.event.location.neighborhood.min' })
            .max(50, { message: 'zodError.event.location.neighborhood.max' })
            .optional(),
        city: z
            .string()
            .min(2, { message: 'zodError.event.location.city.min' })
            .max(50, { message: 'zodError.event.location.city.max' })
            .optional(),
        department: z
            .string()
            .min(2, { message: 'zodError.event.location.department.min' })
            .max(50, { message: 'zodError.event.location.department.max' })
            .optional(),
        placeName: z
            .string()
            .min(2, { message: 'zodError.event.location.placeName.min' })
            .max(100, { message: 'zodError.event.location.placeName.max' })
            .optional()
    });

export type EventLocationInput = z.infer<typeof EventLocationSchema>;
