import { describe, expect, it } from 'vitest';
import {
    AdminSubscriptionCourtesyRevokeRequestSchema,
    AdminSubscriptionCourtesyRevokeResponseSchema
} from '../../../src/api/billing/subscription-admin-courtesy.schema';

describe('admin courtesy revoke schema', () => {
    it('accepts explicit confirmation and a trimmed note', () => {
        expect(
            AdminSubscriptionCourtesyRevokeRequestSchema.parse({
                expectedStatus: 'PAUSED',
                confirmed: true,
                note: '  review  '
            })
        ).toEqual({ expectedStatus: 'PAUSED', confirmed: true, note: 'review' });
    });
    it('rejects missing confirmation, stale status and extra keys', () => {
        for (const body of [
            { expectedStatus: 'PAUSED' },
            { expectedStatus: 'ACTIVE', confirmed: true },
            { expectedStatus: 'PAUSED', confirmed: true, extra: 1 }
        ])
            expect(AdminSubscriptionCourtesyRevokeRequestSchema.safeParse(body).success).toBe(
                false
            );
    });
    it('accepts the resumed response', () => {
        expect(
            AdminSubscriptionCourtesyRevokeResponseSchema.parse({
                outcome: 'RESUMED',
                nextCharge: null
            })
        ).toEqual({ outcome: 'RESUMED', nextCharge: null });
    });
});
