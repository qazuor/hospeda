import { z } from 'zod';
import { RecurrenceTypeEnumSchema } from '../../enums/index.js';

export const EventDateSchema = z.object({
    start: z.date({ message: 'zodError.event.date.start.required' }),
    end: z.date({ message: 'zodError.event.date.end.invalid' }).optional(),
    isAllDay: z.boolean().optional(),
    recurrence: RecurrenceTypeEnumSchema.optional()
});
