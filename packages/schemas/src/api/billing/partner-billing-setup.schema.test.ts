import { describe, expect, it } from 'vitest';
import {
    PartnerBillingSetupParamsSchema,
    PartnerBillingSetupPreviewResponseSchema,
    PartnerBillingSetupRequestSchema,
    PartnerBillingSetupResponseSchema
} from './partner-billing-setup.schema.js';

describe('AC:V7:17 ACC:6 Partner billing setup schemas', () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    it('validates strict Partner params and explicit confirmation', () => {
        expect(PartnerBillingSetupParamsSchema.parse({ id: uuid })).toEqual({ id: uuid });
        expect(
            PartnerBillingSetupRequestSchema.parse({
                billingOptionId: uuid,
                reason: '  approved  ',
                confirm: true
            })
        ).toEqual({ billingOptionId: uuid, reason: 'approved', confirm: true });
        expect(
            PartnerBillingSetupRequestSchema.safeParse({
                billingOptionId: uuid,
                reason: 'approved',
                confirm: false
            }).success
        ).toBe(false);
        expect(
            PartnerBillingSetupRequestSchema.safeParse({
                billingOptionId: uuid,
                reason: ' ',
                confirm: true
            }).success
        ).toBe(false);
        expect(
            PartnerBillingSetupRequestSchema.safeParse({
                billingOptionId: uuid,
                reason: 'approved',
                confirm: true,
                extra: true
            }).success
        ).toBe(false);
    });

    it('validates preview options and ISO action result dates', () => {
        expect(
            PartnerBillingSetupPreviewResponseSchema.parse({
                partner: { id: uuid, name: 'Partner' },
                ownerUserId: uuid,
                method: 'MANUAL',
                options: [
                    {
                        billingOptionId: uuid,
                        planVersionId: uuid,
                        planName: 'Silver',
                        planSlug: 'partner-silver',
                        cycle: 'monthly',
                        amountMinor: 1000,
                        currency: 'ARS'
                    }
                ],
                effect: 'Creates a subscription pending authorization and opens its first installment.'
            }).options
        ).toHaveLength(1);
        expect(
            PartnerBillingSetupResponseSchema.safeParse({
                subscriptionId: uuid,
                manualPaymentId: uuid,
                periodStart: '2026-01-01T00:00:00Z',
                authorizationWindowEndsAt: '2026-01-08T00:00:00Z',
                created: false
            }).success
        ).toBe(true);
    });
});
