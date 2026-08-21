/**
 * MercadoPago webhook metadata: the snake_case wire spelling must be translated
 * at the border, once, for EVERY dispatch discriminator (HOS-743).
 *
 * ## Why this file exists
 *
 * MercadoPago snake_cases preference metadata keys when it copies them onto the
 * payment object. That is the provider rewriting the keys on the wire, not a
 * convention of ours — so a real `payment.updated` payload arrives with
 * `addon_slug`, never `addonSlug`.
 *
 * Every pre-existing test of these extractors builds its input in camelCase, so
 * the whole suite was structurally blind to that: it could not tell a reader
 * that handles the wire spelling from one that does not. HOS-675 and HOS-721
 * both survived for months behind exactly that blind spot. The tests here build
 * the input the way MercadoPago actually delivers it — snake_case PURE, with no
 * camelCase key to fall back on — which is the only shape that can fail when
 * the border is missing.
 *
 * @module test/webhooks/mercadopago-metadata-edge
 */

import { describe, expect, it } from 'vitest';
import {
    extractAddonMetadata,
    extractAnnualSubscriptionMetadata,
    extractPlanChangeUpgradeMetadata
} from '../../src/routes/webhooks/mercadopago/utils';
import { normalizeAddonCheckoutMetadata } from '../../src/services/addon-checkout-metadata';

describe('MercadoPago metadata edge normalization (HOS-743)', () => {
    describe('extractAddonMetadata — the add-on dispatch discriminator', () => {
        it('resolves a snake_case-PURE payment payload', () => {
            // This is the shape a real payment.updated webhook carries once the
            // camelCase duplicates `createAddonCheckout` currently writes are
            // removed. If this returns null, an add-on purchase is never
            // dispatched: no error, no log, the customer is charged and nothing
            // is granted.
            const result = extractAddonMetadata({
                addon_slug: 'visibility-boost-7d',
                customer_id: 'cust_123',
                accommodation_id: 'accom_abc'
            });

            expect(result).toEqual({
                addonSlug: 'visibility-boost-7d',
                customerId: 'cust_123',
                accommodationId: 'accom_abc'
            });
        });

        it('resolves the full metadata bag createAddonCheckout writes, as MercadoPago returns it', () => {
            // Every key `createAddonCheckout` stamps, snake_cased by the
            // provider — including the ones nothing reads (`user_id`,
            // `original_price`, `order_id`), which must not disturb dispatch.
            const result = extractAddonMetadata({
                addon_slug: 'extra-photos-20',
                customer_id: 'cust_456',
                user_id: 'user_789',
                type: 'addon_purchase',
                order_id: 'order_abc',
                promo_code: 'SAVE10',
                promo_code_id: 'promo-uuid-1',
                discount_amount: 1500,
                original_price: 5000,
                accommodation_id: null
            });

            expect(result).toEqual({
                addonSlug: 'extra-photos-20',
                customerId: 'cust_456'
            });
        });

        it('still resolves a camelCase payload (the polling fallback path)', () => {
            // The polling fallback builds its synthetic payload from the job
            // row, which keeps the canonical spelling. Both carriers must work.
            const result = extractAddonMetadata({
                addonSlug: 'visibility-boost-7d',
                customerId: 'cust_123',
                accommodationId: 'accom_abc'
            });

            expect(result).toEqual({
                addonSlug: 'visibility-boost-7d',
                customerId: 'cust_123',
                accommodationId: 'accom_abc'
            });
        });

        it('prefers the canonical camelCase value when both spellings carry a value', () => {
            const result = extractAddonMetadata({
                addonSlug: 'canonical-slug',
                addon_slug: 'wire-slug',
                customerId: 'cust_canonical',
                customer_id: 'cust_wire'
            });

            expect(result).toEqual({
                addonSlug: 'canonical-slug',
                customerId: 'cust_canonical'
            });
        });

        it('falls back to the wire spelling when the canonical key is null', () => {
            // `createAddonCheckout` writes `null` (not `undefined`) for a key
            // that does not apply, so a null camelCase key must read as absent
            // rather than shadowing a populated snake_case one.
            const result = extractAddonMetadata({
                addonSlug: 'visibility-boost-7d',
                customerId: 'cust_123',
                accommodationId: null,
                accommodation_id: 'accom_from_wire'
            });

            expect(result).toEqual({
                addonSlug: 'visibility-boost-7d',
                customerId: 'cust_123',
                accommodationId: 'accom_from_wire'
            });
        });

        it('still returns null when neither spelling carries the discriminator', () => {
            expect(extractAddonMetadata({ order_id: 'order_abc' })).toBeNull();
            expect(extractAddonMetadata({ addon_slug: 'only-the-slug' })).toBeNull();
            expect(extractAddonMetadata({ customer_id: 'only-the-customer' })).toBeNull();
            expect(extractAddonMetadata({ addon_slug: '', customer_id: '' })).toBeNull();
        });
    });

    describe('extractAnnualSubscriptionMetadata', () => {
        it('resolves a snake_case-PURE payment payload', () => {
            const result = extractAnnualSubscriptionMetadata({
                annual_subscription_id: 'sub-uuid-1'
            });

            expect(result).toBe('sub-uuid-1');
        });

        it('still resolves a camelCase payload', () => {
            const result = extractAnnualSubscriptionMetadata({
                annualSubscriptionId: 'sub-uuid-1'
            });

            expect(result).toBe('sub-uuid-1');
        });

        it('returns null when neither spelling is present', () => {
            expect(extractAnnualSubscriptionMetadata({ order_id: 'order_abc' })).toBeNull();
            expect(extractAnnualSubscriptionMetadata({ annual_subscription_id: '' })).toBeNull();
            expect(extractAnnualSubscriptionMetadata(null)).toBeNull();
        });
    });

    describe('extractPlanChangeUpgradeMetadata', () => {
        it('resolves a snake_case-PURE payment payload', () => {
            const result = extractPlanChangeUpgradeMetadata({
                plan_change_upgrade_id: 'sub-uuid-1',
                old_plan_id: 'plan-basic',
                new_plan_id: 'plan-pro',
                new_price_id: 'price-uuid-1',
                target_transaction_amount_major: 12345,
                delta_centavos: 500
            });

            expect(result).toEqual({
                planChangeUpgradeId: 'sub-uuid-1',
                oldPlanId: 'plan-basic',
                newPlanId: 'plan-pro',
                newPriceId: 'price-uuid-1',
                targetTransactionAmountMajor: 12345
            });
        });

        it('still resolves a camelCase payload', () => {
            const result = extractPlanChangeUpgradeMetadata({
                planChangeUpgradeId: 'sub-uuid-1',
                oldPlanId: 'plan-basic',
                newPlanId: 'plan-pro',
                newPriceId: 'price-uuid-1',
                targetTransactionAmountMajor: 12345
            });

            expect(result).toEqual({
                planChangeUpgradeId: 'sub-uuid-1',
                oldPlanId: 'plan-basic',
                newPlanId: 'plan-pro',
                newPriceId: 'price-uuid-1',
                targetTransactionAmountMajor: 12345
            });
        });

        it('returns null when the payload is incomplete in either spelling', () => {
            expect(
                extractPlanChangeUpgradeMetadata({
                    plan_change_upgrade_id: 'sub-uuid-1',
                    old_plan_id: 'plan-basic'
                })
            ).toBeNull();
            expect(extractPlanChangeUpgradeMetadata({ order_id: 'order_abc' })).toBeNull();
        });
    });

    describe('normalizeAddonCheckoutMetadata still honours the same border', () => {
        it('reads the promo payload from a snake_case-PURE payload', () => {
            const result = normalizeAddonCheckoutMetadata({
                metadata: {
                    accommodation_id: 'accom_abc',
                    promo_code_id: 'promo-uuid-1',
                    promo_code: 'SAVE10',
                    discount_amount: 1500
                }
            });

            expect(result).toEqual({
                accommodationId: 'accom_abc',
                promoCodeId: 'promo-uuid-1',
                promoCode: 'SAVE10',
                discountAmount: 1500
            });
        });
    });
});
