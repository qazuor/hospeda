import { AmenitiesTypeEnum } from '@repo/types';
import { z } from 'zod';

export const AmenitiesTypeEnumSchema = z.enum(
    Object.values(AmenitiesTypeEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.amenitiesType.invalid' })
    }
);
