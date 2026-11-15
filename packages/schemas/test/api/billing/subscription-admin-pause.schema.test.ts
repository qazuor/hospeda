import { describe, expect, it } from 'vitest';
import {
    AdminSubscriptionPauseRequestSchema,
    AdminSubscriptionResumeRequestSchema
} from '../../../src/api/billing/subscription-admin-pause.schema.js';

describe('AC:B8b:22 confirmed admin pause contracts', () => {
    it('accepts the exact pause and resume confirmations', () => {
        expect(
            AdminSubscriptionPauseRequestSchema.parse({
                months: 4,
                expectedStatus: 'ACTIVE',
                confirmed: true
            })
        ).toEqual({ months: 4, expectedStatus: 'ACTIVE', confirmed: true });
        expect(
            AdminSubscriptionResumeRequestSchema.parse({
                expectedStatus: 'PAUSED',
                confirmed: true
            })
        ).toEqual({ expectedStatus: 'PAUSED', confirmed: true });
    });

    it('rejects missing confirmation, out-of-range months, and unknown keys', () => {
        for (const body of [
            { months: 1, expectedStatus: 'ACTIVE' },
            { months: 0, expectedStatus: 'ACTIVE', confirmed: true },
            { months: 5, expectedStatus: 'ACTIVE', confirmed: true },
            { months: 1, expectedStatus: 'ACTIVE', confirmed: true, extra: true }
        ])
            expect(AdminSubscriptionPauseRequestSchema.safeParse(body).success).toBe(false);
        for (const body of [
            { expectedStatus: 'PAUSED' },
            { expectedStatus: 'PAUSED', confirmed: true, extra: true }
        ])
            expect(AdminSubscriptionResumeRequestSchema.safeParse(body).success).toBe(false);
    });
});
