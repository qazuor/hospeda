import type { ExtraInfoType } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for extra info on accommodation (capacity, rules, etc).
 */
export const ExtraInfoSchema: z.ZodType<ExtraInfoType> = z.object({
    capacity: z.number({ required_error: 'error:accommodation.extraInfo.capacityRequired' }),
    minNights: z.number({ required_error: 'error:accommodation.extraInfo.minNightsRequired' }),
    maxNights: z.number().optional(),
    bedrooms: z.number({ required_error: 'error:accommodation.extraInfo.bedroomsRequired' }),
    beds: z.number().optional(),
    bathrooms: z.number({ required_error: 'error:accommodation.extraInfo.bathroomsRequired' }),
    smokingAllowed: z.boolean().optional(),
    extraInfo: z.array(z.string()).optional()
});
