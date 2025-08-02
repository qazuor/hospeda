import { AmenitiesTypeEnum } from '@repo/types';
import { z } from 'zod';

export const AmenitiesTypeEnumSchema = z.nativeEnum(AmenitiesTypeEnum, {
    error: () => ({ message: 'zodError.enums.amenitiesType.invalid' })
});
