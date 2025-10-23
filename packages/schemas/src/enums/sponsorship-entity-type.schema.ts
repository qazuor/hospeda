import { z } from 'zod';
import { SponsorshipEntityTypeEnum } from './sponsorship-entity-type.enum';

export const SponsorshipEntityTypeSchema = z.nativeEnum(SponsorshipEntityTypeEnum, {
    message: 'zodError.enums.sponsorshipEntityType.invalid'
});
