/**
 * EventLocation Address Schema (postal address only, plus destinationId FK)
 *
 * Defines the postal-address fields stored in the event_locations row plus the
 * required FK to a `destination` of type CITY. This schema intentionally has
 * NO geographic context fields (city, state, country, zipCode, neighborhood,
 * department) — those derive from the destination relation at query time and
 * are projected as `cityDestination` in API responses.
 *
 * @see SPEC-095 for the rationale.
 */
import { z } from 'zod';
import { DestinationIdSchema } from '../../common/id.schema.js';
import { CoordinatesSchema } from '../../common/location.schema.js';

/**
 * EventLocation Address Schema — postal address fields plus destinationId FK.
 */
export const EventLocationAddressSchema = z.object({
    destinationId: DestinationIdSchema,
    coordinates: CoordinatesSchema.nullish(),
    street: z
        .string({ message: 'zodError.eventLocation.street.required' })
        .min(2, { message: 'zodError.eventLocation.street.min' })
        .max(50, { message: 'zodError.eventLocation.street.max' })
        .nullish(),
    number: z
        .string({ message: 'zodError.eventLocation.number.required' })
        .min(1, { message: 'zodError.eventLocation.number.min' })
        .max(10, { message: 'zodError.eventLocation.number.max' })
        .nullish(),
    floor: z
        .string({ message: 'zodError.eventLocation.floor.required' })
        .min(1, { message: 'zodError.eventLocation.floor.min' })
        .max(10, { message: 'zodError.eventLocation.floor.max' })
        .nullish(),
    apartment: z
        .string({ message: 'zodError.eventLocation.apartment.required' })
        .min(1, { message: 'zodError.eventLocation.apartment.min' })
        .max(10, { message: 'zodError.eventLocation.apartment.max' })
        .nullish(),
    placeName: z
        .string({ message: 'zodError.eventLocation.placeName.required' })
        .min(2, { message: 'zodError.eventLocation.placeName.min' })
        .max(100, { message: 'zodError.eventLocation.placeName.max' })
        .nullish()
});

/**
 * Inferred TypeScript type for the eventLocation address.
 */
export type EventLocationAddressType = z.infer<typeof EventLocationAddressSchema>;

/**
 * Spread helper for composing EventLocationAddressSchema into the main
 * EventLocationSchema via object spread.
 */
export const EventLocationAddressFields = EventLocationAddressSchema.shape;
export type EventLocationAddressFieldsType = typeof EventLocationAddressFields;
