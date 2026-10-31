/**
 * Tests for `resolveExperiencePriceDisplay` (HOS-1943).
 *
 * An experience "a consultar" stores `priceFrom = null`. A null, a missing
 * value or a legacy 0 must never render as an amount ("$0").
 */
import { describe, expect, it } from 'vitest';
import { toExperienceCardProps } from '../../../src/lib/api/transforms';
import { resolveExperiencePriceDisplay } from '../../../src/lib/experience/price-display';

describe('resolveExperiencePriceDisplay', () => {
    it('shows "a consultar" for a null price with the flag on (the stored on-request shape)', () => {
        // Arrange / Act
        const result = resolveExperiencePriceDisplay({ priceFrom: null, isPriceOnRequest: true });

        // Assert
        expect(result).toEqual({ kind: 'on-request' });
    });

    it('never renders a null price as an amount, even with the flag off', () => {
        // Arrange / Act
        const result = resolveExperiencePriceDisplay({ priceFrom: null, isPriceOnRequest: false });

        // Assert
        expect(result).toEqual({ kind: 'on-request' });
    });

    it('never renders a missing price as an amount', () => {
        // Arrange / Act
        const result = resolveExperiencePriceDisplay({
            priceFrom: undefined,
            isPriceOnRequest: false
        });

        // Assert
        expect(result).toEqual({ kind: 'on-request' });
    });

    it('never renders a legacy 0 as "$0"', () => {
        // Arrange / Act
        const result = resolveExperiencePriceDisplay({ priceFrom: 0, isPriceOnRequest: false });

        // Assert
        expect(result).toEqual({ kind: 'on-request' });
    });

    it('hides a positive price while the flag is on', () => {
        // Arrange / Act
        const result = resolveExperiencePriceDisplay({ priceFrom: 150000, isPriceOnRequest: true });

        // Assert
        expect(result).toEqual({ kind: 'on-request' });
    });

    it('renders a positive price as an amount when the flag is off', () => {
        // Arrange / Act
        const result = resolveExperiencePriceDisplay({
            priceFrom: 150000,
            isPriceOnRequest: false
        });

        // Assert
        expect(result).toEqual({ kind: 'amount', cents: 150000 });
    });
});

describe('toExperienceCardProps — price on request (HOS-1943)', () => {
    it('keeps a null price null instead of turning it into 0', () => {
        // Arrange
        const raw = {
            id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            slug: 'guia-carnaval',
            name: 'Guía de carnaval',
            type: 'TOUR_GUIDE',
            summary: 'Un recorrido guiado.',
            priceFrom: null,
            priceUnit: null,
            isPriceOnRequest: true
        };

        // Act
        const props = toExperienceCardProps({ item: raw, locale: 'es' });

        // Assert
        expect(props.priceFrom).toBeNull();
    });
});
