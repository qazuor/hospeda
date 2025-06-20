import { AccommodationTypeEnum } from '@repo/types';
import { z } from 'zod';

export const AccommodationTypeEnumSchema = z.nativeEnum(AccommodationTypeEnum, {
    errorMap: () => ({ message: 'zodError.enums.accommodationType.invalid' })
});
