import { z } from 'zod';
import { VerticalEnum } from '../../enums/vertical.enum';

export const SubscribeDestinationVerticalSchema = z.enum([
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
]);
const TrialStartDeniedReasonSchema = z.enum([
    'EVENT_NOT_DECLARED_BY_VERTICAL',
    'TRIAL_DAYS_NOT_POSITIVE',
    'ALREADY_COVERED',
    'NO_SELLABLE_CURRENT_VERSION',
    'USER_ALREADY_HAS_TRIAL_ROW',
    'EMAIL_PSEUDONYM_ALREADY_USED'
]);
export const SubscribeDestinationResponseSchema = z.discriminatedUnion('destination', [
    z.object({ destination: z.literal('COVERED') }),
    z.object({ destination: z.literal('NO_PLANS_AVAILABLE') }),
    z.object({ destination: z.literal('PUBLISH'), trialDays: z.number().int().positive() }),
    z.object({ destination: z.literal('CHECKOUT'), reason: TrialStartDeniedReasonSchema })
]);
export const NO_PLANS_AVAILABLE_MESSAGE = 'no_plans_available';
