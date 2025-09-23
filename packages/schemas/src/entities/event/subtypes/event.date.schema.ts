import { z } from 'zod';
import { RecurrenceTypeEnumSchema } from '../../../enums/recurrence.schema.js';

export const EventDateSchema = z.object({
    start: z
        .union([
            z.date(),
            z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
                message: 'zodError.event.date.start.invalid'
            })
        ])
        .transform((val) => (typeof val === 'string' ? new Date(val) : val)),
    end: z
        .union([
            z.date(),
            z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
                message: 'zodError.event.date.end.invalid'
            })
        ])
        .transform((val) => (typeof val === 'string' ? new Date(val) : val))
        .optional(),
    isAllDay: z.boolean().optional(),
    recurrence: RecurrenceTypeEnumSchema.optional()
});

/**
 * Type export for EventDate
 */
export type EventDate = z.infer<typeof EventDateSchema>;
