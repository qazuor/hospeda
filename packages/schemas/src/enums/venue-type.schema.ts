import { z } from 'zod';
import { VenueTypeEnum } from './venue-type.enum.js';

/**
 * Zod schema for {@link VenueTypeEnum} validation.
 * Accepts all nine venue sub-type values.
 */
export const VenueTypeEnumSchema = z.nativeEnum(VenueTypeEnum, {
    error: () => ({ message: 'zodError.enums.venueType.invalid' })
});
export type VenueType = z.infer<typeof VenueTypeEnumSchema>;
