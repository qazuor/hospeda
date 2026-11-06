import { z } from 'zod';
import { AmenityAvailabilityEnum } from './amenity-availability.enum.js';

/** Zod schema for {@link AmenityAvailabilityEnum} (HOS-2058). */
export const AmenityAvailabilityEnumSchema = z.nativeEnum(AmenityAvailabilityEnum, {
    error: () => ({ message: 'zodError.enums.amenityAvailability.invalid' })
});
/** Inferred type of {@link AmenityAvailabilityEnumSchema}. */
export type AmenityAvailabilitySchema = z.infer<typeof AmenityAvailabilityEnumSchema>;
