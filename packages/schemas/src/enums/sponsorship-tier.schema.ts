import { z } from 'zod';
import { SponsorshipTierEnum } from './sponsorship-tier.enum.js';

/**
 * Sponsorship tier enum schema for validation
 */
export const SponsorshipTierEnumSchema = z.nativeEnum(SponsorshipTierEnum, {
    error: () => ({ message: 'zodError.enums.sponsorshipTier.invalid' })
});
export type SponsorshipTierSchema = z.infer<typeof SponsorshipTierEnumSchema>;
