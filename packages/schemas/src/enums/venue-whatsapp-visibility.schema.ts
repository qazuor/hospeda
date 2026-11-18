import { z } from 'zod';
import { VenueWhatsappVisibilityEnum } from './venue-whatsapp-visibility.enum.js';

/**
 * Zod schema for {@link VenueWhatsappVisibilityEnum} validation (HOS-2256).
 */
export const VenueWhatsappVisibilityEnumSchema = z.nativeEnum(VenueWhatsappVisibilityEnum, {
    error: () => ({ message: 'zodError.enums.venueWhatsappVisibility.invalid' })
});

/** TypeScript type inferred from {@link VenueWhatsappVisibilityEnumSchema}. */
export type VenueWhatsappVisibility = z.infer<typeof VenueWhatsappVisibilityEnumSchema>;
