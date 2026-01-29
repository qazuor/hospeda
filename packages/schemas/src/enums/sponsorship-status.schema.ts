import { z } from 'zod';
import { SponsorshipStatusEnum } from './sponsorship-status.enum.js';

/**
 * Sponsorship status enum schema for validation
 */
export const SponsorshipStatusEnumSchema = z.nativeEnum(SponsorshipStatusEnum, {
    error: () => ({ message: 'zodError.enums.sponsorshipStatus.invalid' })
});
export type SponsorshipStatusSchema = z.infer<typeof SponsorshipStatusEnumSchema>;
