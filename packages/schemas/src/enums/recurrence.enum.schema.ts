import { RecurrenceTypeEnum } from '@repo/types';
import { z } from 'zod';

export const RecurrenceTypeEnumSchema = z.nativeEnum(RecurrenceTypeEnum, {
    errorMap: () => ({ message: 'zodError.enums.recurrenceType.invalid' })
});
