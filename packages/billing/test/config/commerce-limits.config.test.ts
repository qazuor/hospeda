/**
 * @fileoverview
 * Regression tests for the commerce-vertical ↔ product-domain helpers
 * (HOS-1079).
 *
 * Before HOS-1079, five call sites across `apps/api` computed
 * `productDomain` with a local `vertical === 'gastronomy' ? GASTRONOMY :
 * EXPERIENCE` ternary. Two of them fed it an unchecked `string` — a value
 * that could legitimately be `'accommodation'` or corrupted metadata — and
 * silently answered `EXPERIENCE` for it, with nothing raised. These tests
 * pin the two helpers that replaced every one of those ternaries:
 * `commerceVerticalToProductDomain` (exhaustive over the type-safe
 * `CommerceVertical` union) and `parseCommerceVertical` (the runtime guard
 * for the two sites that receive a raw string).
 */
import { ProductDomainEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    commerceVerticalToProductDomain,
    LIMIT_KEY_BY_COMMERCE_VERTICAL,
    parseCommerceVertical,
    productDomainForLimitKey
} from '../../src/config/commerce-limits.config.js';

describe('commerceVerticalToProductDomain', () => {
    it('resolves gastronomy to ProductDomainEnum.GASTRONOMY', () => {
        expect(commerceVerticalToProductDomain('gastronomy')).toBe(ProductDomainEnum.GASTRONOMY);
    });

    it('resolves experience to ProductDomainEnum.EXPERIENCE', () => {
        expect(commerceVerticalToProductDomain('experience')).toBe(ProductDomainEnum.EXPERIENCE);
    });

    // HOS-1079 composes HOS-1078's exhaustive `productDomainForLimitKey` via
    // `LIMIT_KEY_BY_COMMERCE_VERTICAL` rather than restating the
    // gastronomy/experience -> domain associations in a second literal map —
    // this pins that composition instead of a parallel source of truth.
    it('agrees with productDomainForLimitKey(LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical]) for every vertical', () => {
        for (const vertical of Object.keys(LIMIT_KEY_BY_COMMERCE_VERTICAL) as Array<
            keyof typeof LIMIT_KEY_BY_COMMERCE_VERTICAL
        >) {
            expect(commerceVerticalToProductDomain(vertical)).toBe(
                productDomainForLimitKey(LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical])
            );
        }
    });
});

describe('parseCommerceVertical', () => {
    it('narrows a valid gastronomy string', () => {
        expect(parseCommerceVertical('gastronomy', 'test')).toBe('gastronomy');
    });

    it('narrows a valid experience string', () => {
        expect(parseCommerceVertical('experience', 'test')).toBe('experience');
    });

    it('throws instead of silently treating "accommodation" as experience (HOS-1079)', () => {
        // Before HOS-1079, feeding this value into the old binary ternary
        // (`x === 'gastronomy' ? GASTRONOMY : EXPERIENCE`) answered EXPERIENCE
        // for it — the exact failure mode this function exists to close.
        expect(() => parseCommerceVertical('accommodation', 'test-context')).toThrow(
            /test-context.*accommodation/
        );
    });

    it('throws for the retired "partner" domain value', () => {
        expect(() => parseCommerceVertical('partner', 'test-context')).toThrow(/partner/);
    });

    it('throws for the retired legacy "commerce" umbrella value', () => {
        expect(() => parseCommerceVertical('commerce', 'test-context')).toThrow(/commerce/);
    });

    it('throws for an empty or malformed value', () => {
        expect(() => parseCommerceVertical('', 'test-context')).toThrow();
    });
});
