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
