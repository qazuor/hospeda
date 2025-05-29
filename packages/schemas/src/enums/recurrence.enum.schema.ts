import { RecurrenceTypeEnum } from '@repo/types';
import { z } from 'zod';

export const RecurrenceTypeEnumSchema = z.enum(
    Object.values(RecurrenceTypeEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.recurrenceType.invalid' })
    }
);
