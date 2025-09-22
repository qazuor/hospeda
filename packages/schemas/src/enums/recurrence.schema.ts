import { z } from 'zod';
import { RecurrenceTypeEnum } from './recurrence.enum.js';

export const RecurrenceTypeEnumSchema = z.nativeEnum(RecurrenceTypeEnum, {
    error: () => ({ message: 'zodError.enums.recurrenceType.invalid' })
});
