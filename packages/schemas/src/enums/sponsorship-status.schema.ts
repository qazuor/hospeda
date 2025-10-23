import { z } from 'zod';
import { SponsorshipStatusEnum } from './sponsorship-status.enum';

export const SponsorshipStatusSchema = z.nativeEnum(SponsorshipStatusEnum, {
    message: 'zodError.enums.sponsorshipStatus.invalid'
});
