import { z } from 'zod';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';

/**
 * The trial half shown before signup: a running trial exposes its end date and
 * remaining days; `daysLeft` is the ceiling of the days remaining until
 * `endsAt` so the displayed count never understates the calendar interval.
 */
export const SignupNoticeResponseSchema = z.object({
    /** Vertical selected by the billing option. */
    vertical: VerticalEnumSchema,
    /** Trial state for this user in the selected vertical. */
    trial: z.discriminatedUnion('status', [
        z.object({
            status: z.literal('RUNNING'),
            endsAt: z.string().datetime({ offset: true }),
            daysLeft: z.number().int().positive()
        }),
        z.object({ status: z.literal('NOT_RUNNING') })
    ])
});

/** Response used to explain the trial consequences before signup confirmation. */
export type SignupNoticeResponse = z.infer<typeof SignupNoticeResponseSchema>;
