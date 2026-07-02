import { z } from 'zod';
import { TouristAudienceEnum } from './tourist-audience.enum.js';

/**
 * Tourist audience enum schema for validation
 */
export const TouristAudienceEnumSchema = z.nativeEnum(TouristAudienceEnum, {
    error: () => ({ message: 'zodError.enums.touristAudience.invalid' })
});
export type TouristAudienceSchema = z.infer<typeof TouristAudienceEnumSchema>;
