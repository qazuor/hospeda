import { AccommodationTypeEnum } from '@repo/types/src/enums/accommodation-type.enum';
import { z } from 'zod';

export const AccommodationTypeEnumSchema = z.enum(
    Object.values(AccommodationTypeEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.accommodationType.invalid' })
    }
);
