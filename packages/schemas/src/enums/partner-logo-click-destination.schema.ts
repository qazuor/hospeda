import { z } from 'zod';
import { PartnerLogoClickDestinationEnum } from './partner-logo-click-destination.enum.js';

/**
 * Zod schema for {@link PartnerLogoClickDestinationEnum} validation (HOS-1063).
 *
 * Accepts every enum value, derived automatically via `z.nativeEnum` so a new
 * destination never has to be spelled twice.
 */
export const PartnerLogoClickDestinationEnumSchema = z.nativeEnum(PartnerLogoClickDestinationEnum, {
    message: 'zodError.enums.partnerLogoClickDestination.invalid'
});

/** TypeScript type inferred from {@link PartnerLogoClickDestinationEnumSchema}. */
export type PartnerLogoClickDestination = z.infer<typeof PartnerLogoClickDestinationEnumSchema>;
