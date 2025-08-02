import { z } from 'zod';

/**
 * Accommodation Schedule schema definition using Zod for validation.
 * Represents the schedule or availability for an accommodation.
 */
export const ScheduleSchema = z.object({
    checkinTime: z
        .string({
            message: 'zodError.accommodation.schedule.checkinTime.required'
        })
        .min(3, { message: 'zodError.accommodation.schedule.checkinTime.min' })
        .max(20, { message: 'zodError.accommodation.schedule.checkinTime.max' })
        .optional(),
    checkoutTime: z
        .string({
            message: 'zodError.accommodation.schedule.checkoutTime.required'
        })
        .min(3, { message: 'zodError.accommodation.schedule.checkoutTime.min' })
        .max(20, { message: 'zodError.accommodation.schedule.checkoutTime.max' })
        .optional(),
    earlyCheckinAccepted: z.boolean({
        message: 'zodError.accommodation.schedule.earlyCheckinAccepted.required'
    }),
    earlyCheckinTime: z
        .string({
            message: 'zodError.accommodation.schedule.earlyCheckinTime.required'
        })
        .min(3, { message: 'zodError.accommodation.schedule.earlyCheckinTime.min' })
        .max(20, { message: 'zodError.accommodation.schedule.earlyCheckinTime.max' })
        .optional(),
    lateCheckinAccepted: z.boolean({
        message: 'zodError.accommodation.schedule.lateCheckinAccepted.required'
    }),
    lateCheckinTime: z
        .string({
            message: 'zodError.accommodation.schedule.lateCheckinTime.required'
        })
        .min(3, { message: 'zodError.accommodation.schedule.lateCheckinTime.min' })
        .max(20, { message: 'zodError.accommodation.schedule.lateCheckinTime.max' })
        .optional(),
    lateCheckoutAccepted: z.boolean({
        message: 'zodError.accommodation.schedule.lateCheckoutAccepted.required'
    }),
    lateCheckoutTime: z
        .string({
            message: 'zodError.accommodation.schedule.lateCheckoutTime.required'
        })
        .min(3, { message: 'zodError.accommodation.schedule.lateCheckoutTime.min' })
        .max(20, { message: 'zodError.accommodation.schedule.lateCheckoutTime.max' })
        .optional(),
    selfCheckin: z.boolean({
        message: 'zodError.accommodation.schedule.selfCheckin.required'
    }),
    selfCheckout: z.boolean({
        message: 'zodError.accommodation.schedule.selfCheckout.required'
    })
});
