import { z } from 'zod';
import { AccommodationTypeEnum } from './accommodation-type.enum.js';

export const AccommodationTypeEnumSchema = z.nativeEnum(AccommodationTypeEnum, {
    error: () => ({ message: 'zodError.enums.accommodationType.invalid' })
});
export type AccommodationTypeSchema = z.infer<typeof AccommodationTypeEnumSchema>;
