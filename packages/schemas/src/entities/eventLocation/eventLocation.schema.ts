import { z } from 'zod';
import {
    BaseAdminFields,
    BaseAuditFields,
    BaseLifecycleFields,
    EventLocationIdSchema
} from '../../common/index.js';
import { EventLocationAddressSchema } from './eventLocation.address.schema.js';

/**
 * Event Location schema definition using Zod for validation.
 *
 * Represents the venue of an event. Geographic context (city, state, country)
 * is derived from the `destinationId` FK to a destination of type CITY — this
 * schema only carries the postal address of the venue plus its identifying
 * `placeName` (e.g. "Teatro Municipal").
 *
 * @see SPEC-095 — destination relationship cleanup.
 */
export const EventLocationSchema = z.object({
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
    // Postal address + destinationId FK (SPEC-095)
    ...EventLocationAddressSchema.shape
});

export type EventLocation = z.infer<typeof EventLocationSchema>;
