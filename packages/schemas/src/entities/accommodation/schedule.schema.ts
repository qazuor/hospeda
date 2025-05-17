import { z } from 'zod';
import { TimeRegExp } from '../../utils/utils.js';

/**
 * Zod schema for a accommodation schedule info.
 */
export const AccommodationScheduleSchema = z.object({
    checkinTime: z
        .string({
            required_error: 'error:accommodation.schedule.checkinTime.required',
            invalid_type_error: 'error:accommodation.schedule.checkinTime.invalidType'
        })
        .regex(TimeRegExp, {
            // Must be HH:mm format (e.g. 08:30, 23:45)
            message: 'error:accommodation.schedule.checkinTime.invalidFormat'
        })
        .optional(),
    checkoutTime: z
        .string({
            required_error: 'error:accommodation.schedule.checkoutTime.required',
            invalid_type_error: 'error:accommodation.schedule.checkoutTime.invalidType'
        })
        .regex(TimeRegExp, {
            message: 'error:accommodation.schedule.checkoutTime.invalidFormat'
        }),
    earlyCheckinAccepted: z.boolean({
        required_error: 'error:accommodation.schedule.earlyCheckinAccepted.required',
        invalid_type_error: 'error:accommodation.schedule.earlyCheckinAccepted.invalid_type'
    }),
    earlyCheckinTime: z
        .string({
            required_error: 'error:accommodation.schedule.earlyCheckinTime.required',
            invalid_type_error: 'error:accommodation.schedule.earlyCheckinTime.invalidType'
        })
        .regex(TimeRegExp, {
            message: 'error:accommodation.schedule.earlyCheckinTime.invalidFormat'
        })
        .optional(),
    lateCheckinAccepted: z.boolean({
        required_error: 'error:accommodation.schedule.lateCheckinAccepted.required',
        invalid_type_error: 'error:accommodation.schedule.lateCheckinAccepted.invalid_type'
    }),
    lateCheckinTime: z
        .string({
            required_error: 'error:accommodation.schedule.lateCheckinTime.required',
            invalid_type_error: 'error:accommodation.schedule.lateCheckinTime.invalidType'
        })
        .regex(TimeRegExp, {
            message: 'error:accommodation.schedule.lateCheckinTime.invalidFormat'
        })
        .optional(),
    lateCheckoutAccepted: z.boolean({
        required_error: 'error:accommodation.schedule.lateCheckoutAccepted.required',
        invalid_type_error: 'error:accommodation.schedule.lateCheckoutAccepted.invalid_type'
    }),
    lateCheckoutTime: z
        .string({
            required_error: 'error:accommodation.schedule.lateCheckoutTime.required',
            invalid_type_error: 'error:accommodation.schedule.lateCheckoutTime.invalidType'
        })
        .regex(TimeRegExp, {
            message: 'error:accommodation.schedule.lateCheckoutTime.invalidFormat'
        })
        .optional(),
    selfCheckin: z.boolean({
        required_error: 'error:accommodation.schedule.selfCheckin.required',
        invalid_type_error: 'error:accommodation.schedule.selfCheckin.invalid_type'
    }),
    selfCheckout: z.boolean({
        required_error: 'error:accommodation.schedule.selfCheckout.required',
        invalid_type_error: 'error:accommodation.schedule.selfCheckout.invalid_type'
    })
});

export type AccommodationScheduleInput = z.infer<typeof AccommodationScheduleSchema>;
