import { z } from 'zod';
import { RecurrenceTypeEnumSchema } from '../../enums/index.js';

export const EventDateSchema = z.object({
    start: z
        .string({ required_error: 'zodError.event.date.start.required' })
        .min(10, { message: 'zodError.event.date.start.min' })
        .max(30, { message: 'zodError.event.date.start.max' }),
    end: z
        .string()
        .min(10, { message: 'zodError.event.date.end.min' })
        .max(30, { message: 'zodError.event.date.end.max' })
        .optional(),
    isAllDay: z.boolean().optional(),
    recurrence: RecurrenceTypeEnumSchema.optional()
});
