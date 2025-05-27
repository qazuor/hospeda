import { AmenityTypeEnum } from '@repo/types/src/enums/amenity-type.enum';
import { z } from 'zod';

export const AmenityTypeEnumSchema = z.enum(
    Object.values(AmenityTypeEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.amenityType.invalid' })
    }
);
