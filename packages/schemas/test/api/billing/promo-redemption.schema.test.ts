import { describe, expect, it } from 'vitest';
import {
    RedeemPromoCodeRequestSchema,
    RedeemPromoCodeResponseSchema
} from '../../../src/api/billing/promo-redemption.schema';

describe('TEST:B9b:2 AC:B9b:2 promo redemption schemas', () => {
    it('accepts a trimmed code and rejects extra, invalid, empty and oversized input', () => {
        expect(
            RedeemPromoCodeRequestSchema.parse({ code: ' SAVE ', vertical: 'accommodation' }).code
        ).toBe('SAVE');
        expect(
            RedeemPromoCodeRequestSchema.safeParse({
                code: 'SAVE',
                vertical: 'accommodation',
                extra: true
            }).success
        ).toBe(false);
        expect(
            RedeemPromoCodeRequestSchema.safeParse({ code: 'SAVE', vertical: 'invalid' }).success
        ).toBe(false);
        expect(
            RedeemPromoCodeRequestSchema.safeParse({ code: '  ', vertical: 'accommodation' })
                .success
        ).toBe(false);
        expect(
            RedeemPromoCodeRequestSchema.safeParse({
                code: 'x'.repeat(65),
                vertical: 'accommodation'
            }).success
        ).toBe(false);
    });

    it('validates the DISCOUNT response variant', () => {
        expect(
            RedeemPromoCodeResponseSchema.safeParse({
                kind: 'DISCOUNT',
                redemptionId: crypto.randomUUID(),
                previousAmountMinor: 5000,
                amountMinor: 4500,
                currency: 'ARS',
                durationKind: 'N_CHARGES',
                remainingCharges: 2
            }).success
        ).toBe(true);
    });
});
