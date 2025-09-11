import { z } from 'zod';
import {
    BaseAdminFields,
    BaseAuditFields,
    BaseLifecycleFields,
    BaseLocationSchema,
    EventLocationIdSchema
} from '../../common/index.js';

/**
 * Event Location schema definition using Zod for validation.
 * Represents the location details for an event.
 */
export const EventLocationSchema = BaseLocationSchema.extend({
    // Base fields
    id: EventLocationIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,
    street: z
        .string()
        .min(2, { message: 'zodError.eventLocation.street.min' })
        .max(50, { message: 'zodError.eventLocation.street.max' })
        .optional(),
    number: z
        .string()
        .min(1, { message: 'zodError.eventLocation.number.min' })
        .max(10, { message: 'zodError.eventLocation.number.max' })
        .optional(),
    floor: z
        .string()
        .min(1, { message: 'zodError.eventLocation.floor.min' })
        .max(10, { message: 'zodError.eventLocation.floor.max' })
        .optional(),
    apartment: z
        .string()
        .min(1, { message: 'zodError.eventLocation.apartment.min' })
        .max(10, { message: 'zodError.eventLocation.apartment.max' })
        .optional(),
    neighborhood: z
        .string()
        .min(2, { message: 'zodError.eventLocation.neighborhood.min' })
        .max(50, { message: 'zodError.eventLocation.neighborhood.max' })
        .optional(),
    city: z
        .string()
        .min(2, { message: 'zodError.eventLocation.city.min' })
        .max(50, { message: 'zodError.eventLocation.city.max' })
        .optional(),
    department: z
        .string()
        .min(2, { message: 'zodError.eventLocation.department.min' })
        .max(50, { message: 'zodError.eventLocation.department.max' })
        .optional(),
    placeName: z
        .string()
        .min(2, { message: 'zodError.eventLocation.placeName.min' })
        .max(100, { message: 'zodError.eventLocation.placeName.max' })
        .optional()
});

export type EventLocation = z.infer<typeof EventLocationSchema>;
