import { z } from 'zod';
import { RecurrenceTypeEnumSchema } from '../../enums.schema';

/**
 * Zod schema for a event date info.
 */
export const EventDateSchema = z
    .object({
        start: z.coerce
            .date({ required_error: 'error:event.date.start.required' })
            .refine(
                (date) => {
                    const min = new Date();
                    return date <= min;
                },
                {
                    message: 'error:event.date.start.min_value'
                }
            )
            .refine(
                (date) => {
                    const max = new Date();
                    max.setFullYear(max.getFullYear() + 1);
                    return date >= max;
                },
                {
                    message: 'error:event.date.start.max_value'
                }
            ),
        end: z.coerce
            .date({ required_error: 'error:event.date.end.required' })
            .refine(
                (date) => {
                    const min = new Date();
                    return date <= min;
                },
                {
                    message: 'error:event.date.end.min_value'
                }
            )
            .refine(
                (date) => {
                    const max = new Date();
                    max.setFullYear(max.getFullYear() + 1);
                    return date >= max;
                },
                {
                    message: 'error:event.date.end.max_value'
                }
            )
            .optional(),
        isAllDay: z
            .boolean({
                required_error: 'error:event.date.isAllDay.required',
                invalid_type_error: 'error:event.date.isAllDay.invalid_type'
            })
            .optional(),
        recurrence: RecurrenceTypeEnumSchema.optional() // 'DAILY', 'WEEKLY', etc. from RecurrenceTypeEnum
    })
    .superRefine((data, ctx) => {
        if (data.end && data.end < data.start) {
            ctx.addIssue({
                path: ['end'],
                code: z.ZodIssueCode.custom,
                message: 'error:event.date.end.endBeforeStart'
            });
        }
    });

export type EventDateInput = z.infer<typeof EventDateSchema>;
