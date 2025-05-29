import { AccommodationTypeEnum } from '@repo/types';
import { z } from 'zod';

export const AccommodationTypeEnumSchema = z.enum(
    Object.values(AccommodationTypeEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.accommodationType.invalid' })
    }
);
