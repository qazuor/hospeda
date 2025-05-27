import { z } from 'zod';

/**
 * Accommodation Schedule schema definition using Zod for validation.
 * Represents the schedule or availability for an accommodation.
 */
export const ScheduleSchema = z.object({
    checkinTime: z
        .string({
            required_error: 'zodError.accommodation.schedule.checkinTime.required',
            invalid_type_error: 'zodError.accommodation.schedule.checkinTime.invalidType'
        })
        .min(3, { message: 'zodError.accommodation.schedule.checkinTime.min' })
        .max(20, { message: 'zodError.accommodation.schedule.checkinTime.max' })
        .optional(),
    checkoutTime: z
        .string({
            required_error: 'zodError.accommodation.schedule.checkoutTime.required',
            invalid_type_error: 'zodError.accommodation.schedule.checkoutTime.invalidType'
        })
        .min(3, { message: 'zodError.accommodation.schedule.checkoutTime.min' })
        .max(20, { message: 'zodError.accommodation.schedule.checkoutTime.max' })
        .optional(),
    earlyCheckinAccepted: z.boolean({
        required_error: 'zodError.accommodation.schedule.earlyCheckinAccepted.required',
        invalid_type_error: 'zodError.accommodation.schedule.earlyCheckinAccepted.invalidType'
    }),
    earlyCheckinTime: z
        .string({
            required_error: 'zodError.accommodation.schedule.earlyCheckinTime.required',
            invalid_type_error: 'zodError.accommodation.schedule.earlyCheckinTime.invalidType'
        })
        .min(3, { message: 'zodError.accommodation.schedule.earlyCheckinTime.min' })
        .max(20, { message: 'zodError.accommodation.schedule.earlyCheckinTime.max' })
        .optional(),
    lateCheckinAccepted: z.boolean({
        required_error: 'zodError.accommodation.schedule.lateCheckinAccepted.required',
        invalid_type_error: 'zodError.accommodation.schedule.lateCheckinAccepted.invalidType'
    }),
    lateCheckinTime: z
        .string({
            required_error: 'zodError.accommodation.schedule.lateCheckinTime.required',
            invalid_type_error: 'zodError.accommodation.schedule.lateCheckinTime.invalidType'
        })
        .min(3, { message: 'zodError.accommodation.schedule.lateCheckinTime.min' })
        .max(20, { message: 'zodError.accommodation.schedule.lateCheckinTime.max' })
        .optional(),
    lateCheckoutAccepted: z.boolean({
        required_error: 'zodError.accommodation.schedule.lateCheckoutAccepted.required',
        invalid_type_error: 'zodError.accommodation.schedule.lateCheckoutAccepted.invalidType'
    }),
    lateCheckoutTime: z
        .string({
            required_error: 'zodError.accommodation.schedule.lateCheckoutTime.required',
            invalid_type_error: 'zodError.accommodation.schedule.lateCheckoutTime.invalidType'
        })
        .min(3, { message: 'zodError.accommodation.schedule.lateCheckoutTime.min' })
        .max(20, { message: 'zodError.accommodation.schedule.lateCheckoutTime.max' })
        .optional(),
    selfCheckin: z.boolean({
        required_error: 'zodError.accommodation.schedule.selfCheckin.required',
        invalid_type_error: 'zodError.accommodation.schedule.selfCheckin.invalidType'
    }),
    selfCheckout: z.boolean({
        required_error: 'zodError.accommodation.schedule.selfCheckout.required',
        invalid_type_error: 'zodError.accommodation.schedule.selfCheckout.invalidType'
    })
});
