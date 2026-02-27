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
    slug: z
        .string({
            message: 'zodError.eventLocation.slug.required'
        })
        .min(2, { message: 'zodError.eventLocation.slug.min' })
        .max(100, { message: 'zodError.eventLocation.slug.max' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'zodError.eventLocation.slug.format'
        }),
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,
    street: z
        .string()
        .min(2, { message: 'zodError.eventLocation.street.min' })
        .max(50, { message: 'zodError.eventLocation.street.max' })
        .nullish(),
    number: z
        .string()
        .min(1, { message: 'zodError.eventLocation.number.min' })
        .max(10, { message: 'zodError.eventLocation.number.max' })
        .nullish(),
    floor: z
        .string()
        .min(1, { message: 'zodError.eventLocation.floor.min' })
        .max(10, { message: 'zodError.eventLocation.floor.max' })
        .nullish(),
    apartment: z
        .string()
        .min(1, { message: 'zodError.eventLocation.apartment.min' })
        .max(10, { message: 'zodError.eventLocation.apartment.max' })
        .nullish(),
    neighborhood: z
        .string()
        .min(2, { message: 'zodError.eventLocation.neighborhood.min' })
        .max(50, { message: 'zodError.eventLocation.neighborhood.max' })
        .nullish(),
    city: z
        .string({
            message: 'zodError.eventLocation.city.required'
        })
        .min(2, { message: 'zodError.eventLocation.city.min' })
        .max(50, { message: 'zodError.eventLocation.city.max' }),
    department: z
        .string()
        .min(2, { message: 'zodError.eventLocation.department.min' })
        .max(50, { message: 'zodError.eventLocation.department.max' })
        .nullish(),
    placeName: z
        .string()
        .min(2, { message: 'zodError.eventLocation.placeName.min' })
        .max(100, { message: 'zodError.eventLocation.placeName.max' })
        .nullish()
});

export type EventLocation = z.infer<typeof EventLocationSchema>;
