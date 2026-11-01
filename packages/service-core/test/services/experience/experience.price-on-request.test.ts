/**
 * Unit tests for `resolveOnRequestPricePatch` (HOS-1943).
 *
 * An experience "a consultar" stores `priceFrom = null`. The rule must null the
 * price whenever the listing is on request after the write, and leave every
 * other write untouched.
 */
import { describe, expect, it } from 'vitest';
import { resolveOnRequestPricePatch } from '../../../src/services/experience/experience.price-on-request';

describe('resolveOnRequestPricePatch', () => {
    it('nulls the price when the payload turns the flag on', () => {
        // Arrange / Act
        const { patch } = resolveOnRequestPricePatch({
            data: { isPriceOnRequest: true, priceFrom: 150000 }
        });

        // Assert
        expect(patch).toEqual({ priceFrom: null });
    });

    it('nulls the price when the flag is turned on without a price in the payload', () => {
        // Arrange / Act
        const { patch } = resolveOnRequestPricePatch({
            data: { isPriceOnRequest: true },
            current: { isPriceOnRequest: false, priceFrom: 150000 }
        });

        // Assert
        expect(patch).toEqual({ priceFrom: null });
    });

    it('nulls a price sent alone when the stored row is already on request', () => {
        // Arrange / Act
        const { patch } = resolveOnRequestPricePatch({
            data: { priceFrom: 90000 },
            current: { isPriceOnRequest: true, priceFrom: null }
        });

        // Assert
        expect(patch).toEqual({ priceFrom: null });
    });

    it('keeps a price when the payload turns the flag off', () => {
        // Arrange / Act
        const { patch } = resolveOnRequestPricePatch({
            data: { isPriceOnRequest: false, priceFrom: 90000 },
            current: { isPriceOnRequest: true, priceFrom: null }
        });

        // Assert
        expect(patch).toEqual({});
    });

    it('keeps a price sent alone when the stored row has a real price', () => {
        // Arrange / Act
        const { patch } = resolveOnRequestPricePatch({
            data: { priceFrom: 90000 },
            current: { isPriceOnRequest: false, priceFrom: 150000 }
        });

        // Assert
        expect(patch).toEqual({});
    });

    it('does nothing for a write that does not touch pricing', () => {
        // Arrange / Act
        const { patch } = resolveOnRequestPricePatch({
            data: { name: 'Nuevo nombre' },
            current: { isPriceOnRequest: true, priceFrom: 0 }
        });

        // Assert
        expect(patch).toEqual({});
    });
});

describe('resolveOnRequestPricePatch — missingPrice (HOS-1943 review)', () => {
    it('flags a null price sent while the stored row is not on request', () => {
        // Arrange / Act
        const { missingPrice } = resolveOnRequestPricePatch({
            data: { priceFrom: null },
            current: { isPriceOnRequest: false, priceFrom: 150000 }
        });

        // Assert
        expect(missingPrice).toBe(true);
    });

    it('flags turning the flag off on a null-price row without sending a price', () => {
        // Arrange / Act
        const { missingPrice } = resolveOnRequestPricePatch({
            data: { isPriceOnRequest: false },
            current: { isPriceOnRequest: true, priceFrom: null }
        });

        // Assert
        expect(missingPrice).toBe(true);
    });

    it('does not flag a null price while the listing stays on request', () => {
        // Arrange / Act
        const result = resolveOnRequestPricePatch({
            data: { priceFrom: null },
            current: { isPriceOnRequest: true, priceFrom: null }
        });

        // Assert
        expect(result).toEqual({ patch: { priceFrom: null }, missingPrice: false });
    });

    it('does not flag turning the flag off while also sending a price', () => {
        // Arrange / Act
        const result = resolveOnRequestPricePatch({
            data: { isPriceOnRequest: false, priceFrom: 90000 },
            current: { isPriceOnRequest: true, priceFrom: null }
        });

        // Assert
        expect(result).toEqual({ patch: {}, missingPrice: false });
    });

    it('claims nothing when neither the payload nor a loaded row knows the price', () => {
        // Arrange / Act
        const { missingPrice } = resolveOnRequestPricePatch({
            data: { isPriceOnRequest: false },
            current: null
        });

        // Assert
        expect(missingPrice).toBe(false);
    });
});
