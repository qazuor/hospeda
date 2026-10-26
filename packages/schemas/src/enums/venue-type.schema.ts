import { z } from 'zod';
import { VenueTypeEnum } from './venue-type.enum.js';

/**
 * Zod schema for {@link VenueTypeEnum} validation.
 * Accepts all nine gastronomy sub-type values.
 */
export const VenueTypeEnumSchema = z.nativeEnum(VenueTypeEnum, {
    error: () => ({ message: 'zodError.enums.gastronomyType.invalid' })
});
export type VenueType = z.infer<typeof VenueTypeEnumSchema>;
