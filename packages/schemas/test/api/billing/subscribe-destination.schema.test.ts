import { describe, expect, it } from 'vitest';
import {
    NO_PLANS_AVAILABLE_MESSAGE,
    SubscribeDestinationResponseSchema,
    SubscribeDestinationVerticalSchema
} from '../../../src/api/billing/subscribe-destination.schema';

describe('subscribe destination schema', () => {
    it('TEST:V8a:2 accepts each closed destination shape', () => {
        expect(
            SubscribeDestinationResponseSchema.safeParse({ destination: 'COVERED' }).success
        ).toBe(true);
        expect(
            SubscribeDestinationResponseSchema.safeParse({ destination: 'NO_PLANS_AVAILABLE' })
                .success
        ).toBe(true);
        expect(
            SubscribeDestinationResponseSchema.safeParse({ destination: 'PUBLISH', trialDays: 14 })
                .success
        ).toBe(true);
        expect(
            SubscribeDestinationResponseSchema.safeParse({
                destination: 'CHECKOUT',
                reason: 'USER_ALREADY_HAS_TRIAL_ROW'
            }).success
        ).toBe(true);
    });
    it('rejects malformed days, reasons, and verticals', () => {
        expect(
            SubscribeDestinationResponseSchema.safeParse({ destination: 'PUBLISH', trialDays: 0 })
                .success
        ).toBe(false);
        expect(
            SubscribeDestinationResponseSchema.safeParse({
                destination: 'CHECKOUT',
                reason: 'other'
            }).success
        ).toBe(false);
        expect(SubscribeDestinationVerticalSchema.safeParse('tourist').success).toBe(false);
        expect(NO_PLANS_AVAILABLE_MESSAGE).toBe('no_plans_available');
    });
});
