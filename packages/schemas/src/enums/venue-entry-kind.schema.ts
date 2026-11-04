import { z } from 'zod';
import { VenueEntryKindEnum } from './venue-entry-kind.enum.js';

/**
 * Zod schema for {@link VenueEntryKindEnum} validation.
 * Accepts only the three declared entry kinds: free, paid, varies.
 */
export const VenueEntryKindEnumSchema = z.nativeEnum(VenueEntryKindEnum, {
    error: () => ({ message: 'zodError.enums.venueEntryKind.invalid' })
});
export type VenueEntryKind = z.infer<typeof VenueEntryKindEnumSchema>;
