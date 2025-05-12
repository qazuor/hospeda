import type { EventDateType } from '@repo/types';
import { RecurrenceTypeEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for event date configuration.
 */
export const EventDateSchema: z.ZodType<EventDateType> = z.object({
    start: z.coerce.date({
        required_error: 'error:event.date.startRequired'
    }),
    end: z.coerce.date().optional(),
    isAllDay: z.boolean().optional(),
    recurrence: z
        .nativeEnum(RecurrenceTypeEnum, {
            required_error: 'error:event.date.recurrenceRequired',
            invalid_type_error: 'error:event.date.recurrenceInvalid'
        })
        .optional()
});
