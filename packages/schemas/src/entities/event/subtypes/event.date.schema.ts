import { z } from 'zod';
import { EventDatePrecisionEnum } from '../../../enums/event-date-precision.enum.js';
import { EventDatePrecisionEnumSchema } from '../../../enums/event-date-precision.schema.js';
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
    recurrence: RecurrenceTypeEnumSchema.optional(),
    /**
     * Precision of `start`/`end` (HOS-280). Defaults to `EXACT` for backward
     * compatibility with every event that shipped before this field existed
     * (they all have a fully-known day/month/year). Set to `MONTH` when the
     * source only specifies a month — the day component of `start`/`end` is
     * then a placeholder and must not be rendered.
     */
    precision: EventDatePrecisionEnumSchema.optional().default(EventDatePrecisionEnum.EXACT)
});

/**
 * Type export for EventDate
 */
export type EventDate = z.infer<typeof EventDateSchema>;
