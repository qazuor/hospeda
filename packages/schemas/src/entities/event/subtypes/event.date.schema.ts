import { z } from 'zod';
import { RecurrenceTypeEnumSchema } from '../../../enums/recurrence.schema.js';

export const EventDateSchema = z.object({
    start: z.date({ message: 'zodError.event.date.start.required' }),
    end: z.date({ message: 'zodError.event.date.end.invalid' }).optional(),
    isAllDay: z.boolean().optional(),
    recurrence: RecurrenceTypeEnumSchema.optional()
});

/**
 * Type export for EventDate
 */
export type EventDate = z.infer<typeof EventDateSchema>;
