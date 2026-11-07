import { describe, expect, it } from 'vitest';
import {
    SelfSubscriptionPausePreviewResponseSchema,
    SelfSubscriptionPauseRequestSchema,
    SelfSubscriptionResumeRequestSchema
} from '../../../src/api/billing/subscription-self-pause.schema.js';

describe('TEST:B8b:25 owner pause schemas', () => {
    it('accepts only a bounded whole-month pause request', () => {
        expect(SelfSubscriptionPauseRequestSchema.safeParse({ months: 1 }).success).toBe(true);
        expect(SelfSubscriptionPauseRequestSchema.safeParse({ months: 4 }).success).toBe(true);
        expect(SelfSubscriptionPauseRequestSchema.safeParse({ months: 0 }).success).toBe(false);
        expect(SelfSubscriptionPauseRequestSchema.safeParse({ months: 2.5 }).success).toBe(false);
        expect(
            SelfSubscriptionPauseRequestSchema.safeParse({ months: 1, extra: true }).success
        ).toBe(false);
    });
    it('accepts only an empty resume body', () => {
        expect(SelfSubscriptionResumeRequestSchema.safeParse({}).success).toBe(true);
        expect(SelfSubscriptionResumeRequestSchema.safeParse({ cause: 'TERM' }).success).toBe(
            false
        );
    });
    it('parses both a refusal with courtesy date and an offer with addon impacts', () => {
        expect(
            SelfSubscriptionPausePreviewResponseSchema.safeParse({
                offered: false,
                reason: 'COURTESY_IN_FORCE',
                courtesyEndsAt: '2026-11-05T12:00:00.000Z'
            }).success
        ).toBe(true);
        expect(
            SelfSubscriptionPausePreviewResponseSchema.safeParse({
                offered: true,
                months: { min: 1, max: 2 },
                expectedEndAtByMonths: { 1: '2026-11-05T12:00:00.000Z' },
                quota: { pausesLeft: 2, monthsLeft: 2 },
                addons: {
                    vertical: ['Listing addon'],
                    account: [{ name: 'Account addon', pauses: false }]
                }
            }).success
        ).toBe(true);
    });
});
