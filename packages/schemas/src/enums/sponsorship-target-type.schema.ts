import { z } from 'zod';
import { SponsorshipTargetTypeEnum } from './sponsorship-target-type.enum.js';

/**
 * Sponsorship target type enum schema for validation
 */
export const SponsorshipTargetTypeEnumSchema = z.nativeEnum(SponsorshipTargetTypeEnum, {
    error: () => ({ message: 'zodError.enums.sponsorshipTargetType.invalid' })
});
export type SponsorshipTargetTypeSchema = z.infer<typeof SponsorshipTargetTypeEnumSchema>;
