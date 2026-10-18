import { describe, expect, it } from 'vitest';
import {
    PROMO_REDEEM_OFFERED,
    parseRedeemResult,
    readRedeemRejection,
    resolveRedeemNotice
} from '@/lib/billing/promo-redeem';
import { formatPrice } from '@/lib/format-utils';

describe('AC:B9b:12 HOS-1591 TEST:B9b:12 (support) — promo redemption display', () => {
    it('offers only card-paid active subscriptions, never manual subscriptions', () => {
        expect(PROMO_REDEEM_OFFERED).toEqual({
            ACTIVE: { CARD: true, MANUAL: false },
            GRACE_PERIOD: { CARD: false, MANUAL: false },
            SUSPENDED: { CARD: false, MANUAL: false },
            CANCEL_SCHEDULED: { CARD: false, MANUAL: false }
        });
    });

    it('explains N discounted charges, the later amount, and the provider email', () => {
        const lines = resolveRedeemNotice({
            result: {
                kind: 'DISCOUNT',
                redemptionId: '123e4567-e89b-42d3-a456-426614174000',
                previousAmountMinor: 10000,
                amountMinor: 7000,
                currency: 'ARS',
                durationKind: 'N_CHARGES',
                remainingCharges: 3
            },
            locale: 'es'
        });
        expect(lines).toEqual([
            {
                key: 'account.subscription.promoRedeem.nCharges',
                params: {
                    count: 3,
                    amount: formatPrice({
                        amount: 70,
                        currency: 'ARS',
                        locale: 'es',
                        showDecimals: true
                    })
                }
            },
            {
                key: 'account.subscription.promoRedeem.after',
                params: {
                    amount: formatPrice({
                        amount: 100,
                        currency: 'ARS',
                        locale: 'es',
                        showDecimals: true
                    })
                }
            },
            { key: 'account.subscription.promoRedeem.providerEmail' }
        ]);
    });

    it('unifies first-charge notice and promo-ending notice', () => {
        expect(
            resolveRedeemNotice({
                result: {
                    kind: 'DISCOUNT',
                    redemptionId: '123e4567-e89b-42d3-a456-426614174000',
                    previousAmountMinor: 10000,
                    amountMinor: 7000,
                    currency: 'ARS',
                    durationKind: 'FIRST_CHARGE',
                    remainingCharges: 1
                },
                locale: 'es'
            }).map(({ key }) => key)
        ).toEqual([
            'account.subscription.promoRedeem.firstCharge',
            'account.subscription.promoRedeem.after',
            'account.subscription.promoRedeem.providerEmail',
            'account.subscription.promoRedeem.promoEnds'
        ]);
    });

    it('shows a forever amount without a provider-email notice', () => {
        const lines = resolveRedeemNotice({
            result: {
                kind: 'DISCOUNT',
                redemptionId: '123e4567-e89b-42d3-a456-426614174000',
                previousAmountMinor: 10000,
                amountMinor: 7000,
                currency: 'ARS',
                durationKind: 'FOREVER',
                remainingCharges: null
            },
            locale: 'es'
        });
        expect(lines).toEqual([
            {
                key: 'account.subscription.promoRedeem.forever',
                params: {
                    amount: formatPrice({
                        amount: 70,
                        currency: 'ARS',
                        locale: 'es',
                        showDecimals: true
                    })
                }
            }
        ]);
    });

    it('states the number of days added to trial', () => {
        expect(
            resolveRedeemNotice({
                result: { kind: 'TRIAL_EXTENSION', days: 14, replay: false },
                locale: 'es'
            })
        ).toEqual([
            { key: 'account.subscription.promoRedeem.trialExtension', params: { count: 14 } }
        ]);
    });

    it('returns a known rejection reason and ignores unknown reasons', () => {
        expect(
            readRedeemRejection({
                result: { ok: false, error: { reason: 'PROMO_CODE_NOT_AVAILABLE' } }
            })
        ).toBe('PROMO_CODE_NOT_AVAILABLE');
        expect(
            readRedeemRejection({ result: { ok: false, error: { reason: 'UNKNOWN' } } })
        ).toBeNull();
    });

    it('fails closed for a malformed successful payload', () => {
        expect(
            parseRedeemResult({
                result: { ok: true, data: { kind: 'DISCOUNT', amountMinor: 'bad' } }
            })
        ).toBeNull();
    });
});
