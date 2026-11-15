import { describe, expect, it } from 'vitest';
import {
    AdminSubscriptionCourtesyGrantPreviewQuerySchema,
    AdminSubscriptionCourtesyGrantPreviewResponseSchema,
    AdminSubscriptionCourtesyGrantRequestSchema,
    AdminSubscriptionCourtesyGrantResponseSchema,
    AdminSubscriptionCourtesyRevokePreviewResponseSchema
} from '../../../src/api/billing/subscription-admin-courtesy-grant.schema';

describe('temporary courtesy administrative contracts', () => {
    it('requires a confirmed grant with whole positive months and no extra fields', () => {
        const body = { expectedStatus: 'ACTIVE', months: 2, reason: 'Support', confirmed: true };
        expect(AdminSubscriptionCourtesyGrantRequestSchema.safeParse(body).success).toBe(true);
        expect(
            AdminSubscriptionCourtesyGrantRequestSchema.safeParse({ ...body, confirmed: false })
                .success
        ).toBe(false);
        expect(
            AdminSubscriptionCourtesyGrantRequestSchema.safeParse({ ...body, months: 1.5 }).success
        ).toBe(false);
        expect(
            AdminSubscriptionCourtesyGrantRequestSchema.safeParse({ ...body, reason: ' ' }).success
        ).toBe(false);
        expect(
            AdminSubscriptionCourtesyGrantRequestSchema.safeParse({ ...body, note: 'extra' })
                .success
        ).toBe(false);
    });

    it('validates the preview query and response dates', () => {
        expect(AdminSubscriptionCourtesyGrantPreviewQuerySchema.parse({ months: '2' })).toEqual({
            months: 2
        });
        expect(
            AdminSubscriptionCourtesyGrantPreviewQuerySchema.safeParse({ months: '0' }).success
        ).toBe(false);
        expect(
            AdminSubscriptionCourtesyGrantResponseSchema.safeParse({
                outcome: 'GRANTED',
                courtesyGrantId: crypto.randomUUID(),
                endsAt: new Date().toISOString()
            }).success
        ).toBe(true);
        expect(
            AdminSubscriptionCourtesyGrantPreviewResponseSchema.safeParse({
                subscriptionId: crypto.randomUUID(),
                status: 'ACTIVE',
                cycle: 'annual',
                offered: false,
                reason: 'NOT_MONTHLY',
                alternatives: ['PERMANENT_GRANT', 'RENEWAL_PROMO'],
                liveCourtesy: null,
                months: 2,
                endsAt: new Date().toISOString()
            }).success
        ).toBe(true);
        expect(
            AdminSubscriptionCourtesyRevokePreviewResponseSchema.safeParse({
                subscriptionId: crypto.randomUUID(),
                status: 'ACTIVE',
                cycle: 'monthly',
                inForce: false,
                reason: 'COURTESY_NOT_IN_FORCE',
                courtesy: null,
                predictedNextChargeAt: null
            }).success
        ).toBe(true);
    });
});
