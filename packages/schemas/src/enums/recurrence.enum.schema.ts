import { RecurrenceEnum } from '@repo/types/src/enums/recurrence.enum';
import { z } from 'zod';

export const RecurrenceEnumSchema = z.enum(Object.values(RecurrenceEnum) as [string, ...string[]], {
    errorMap: () => ({ message: 'zodError.enums.recurrence.invalid' })
});
