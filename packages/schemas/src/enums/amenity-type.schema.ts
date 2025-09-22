import { z } from 'zod';
import { AmenitiesTypeEnum } from './amenity-type.enum.js';

export const AmenitiesTypeEnumSchema = z.nativeEnum(AmenitiesTypeEnum, {
    error: () => ({ message: 'zodError.enums.amenitiesType.invalid' })
});
export type AmenitiesTypeSchema = z.infer<typeof AmenitiesTypeEnumSchema>;
