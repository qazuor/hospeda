import type { ScheduleType } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for accommodation schedule configuration.
 */
export const ScheduleSchema: z.ZodType<ScheduleType> = z.object({
    checkinTime: z.string().optional(), // format "HH:mm"
    checkoutTime: z.string().optional(),
    earlyCheckinAccepted: z.boolean({
        required_error: 'error:accommodation.schedule.earlyCheckinAcceptedRequired'
    }),
    earlyCheckinTime: z.string().optional(),
    lateCheckinAccepted: z.boolean({
        required_error: 'error:accommodation.schedule.lateCheckinAcceptedRequired'
    }),
    lateCheckinTime: z.string().optional(),
    lateCheckoutAccepted: z.boolean({
        required_error: 'error:accommodation.schedule.lateCheckoutAcceptedRequired'
    }),
    lateCheckoutTime: z.string().optional(),
    selfCheckin: z.boolean({
        required_error: 'error:accommodation.schedule.selfCheckinRequired'
    }),
    selfCheckout: z.boolean({
        required_error: 'error:accommodation.schedule.selfCheckoutRequired'
    })
});
