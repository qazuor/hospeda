/**
 * @file transforms-poi.test.ts
 * @description Unit tests for `toDestinationPointOfInterestListProps` (HOS-146).
 */
import { describe, expect, it } from 'vitest';
import { toDestinationPointOfInterestListProps } from '../../../src/lib/api/transforms';

describe('toDestinationPointOfInterestListProps', () => {
    it('transforms a complete PRIMARY POI item', () => {
        // Arrange
        const raw = {
            id: 'poi-1',
            slug: 'playa-ita-piru',
            type: 'BEACH',
            lat: -32.4766,
            long: -58.2372,
            relation: 'PRIMARY',
            description: 'Una playa',
            descriptionI18n: { es: 'Una playa', en: null, pt: null },
            nameI18n: { es: 'Playa Ita Pirú', en: null, pt: null },
            isFeatured: true,
            displayWeight: 80
        };

        // Act
        const [result] = toDestinationPointOfInterestListProps({ pointsOfInterest: [raw] });

        // Assert
        expect(result).toEqual({
            id: 'poi-1',
            slug: 'playa-ita-piru',
            type: 'BEACH',
            lat: -32.4766,
            long: -58.2372,
            relation: 'PRIMARY',
            description: 'Una playa',
            descriptionI18n: { es: 'Una playa', en: null, pt: null },
            nameI18n: { es: 'Playa Ita Pirú', en: null, pt: null },
            isFeatured: true,
            displayWeight: 80
        });
    });

    it('preserves the NEARBY relation', () => {
        // Arrange
        const raw = { id: 'poi-2', slug: 'reserva-lejana', type: 'NATURAL', relation: 'NEARBY' };

        // Act
        const [result] = toDestinationPointOfInterestListProps({ pointsOfInterest: [raw] });

        // Assert
        expect(result.relation).toBe('NEARBY');
    });

    it('defaults relation to PRIMARY when missing or unrecognized (back-compat)', () => {
        // Arrange
        const missing = { id: 'poi-3', slug: 'a', type: 'PARK' };
        const bogus = { id: 'poi-4', slug: 'b', type: 'PARK', relation: 'BOGUS' };

        // Act
        const [resultMissing] = toDestinationPointOfInterestListProps({
            pointsOfInterest: [missing]
        });
        const [resultBogus] = toDestinationPointOfInterestListProps({ pointsOfInterest: [bogus] });

        // Assert
        expect(resultMissing.relation).toBe('PRIMARY');
        expect(resultBogus.relation).toBe('PRIMARY');
    });

    it('normalizes null lat/long (HOS-138 nullable coords) to null, not NaN or 0', () => {
        // Arrange
        const raw = { id: 'poi-5', slug: 'sin-coords', type: 'OTHER', lat: null, long: null };

        // Act
        const [result] = toDestinationPointOfInterestListProps({ pointsOfInterest: [raw] });

        // Assert
        expect(result.lat).toBeNull();
        expect(result.long).toBeNull();
    });

    it('drops non-finite lat/long values to null defensively', () => {
        // Arrange
        const raw = {
            id: 'poi-6',
            slug: 'bad-coords',
            type: 'OTHER',
            lat: Number.NaN,
            long: 'oops'
        };

        // Act
        const [result] = toDestinationPointOfInterestListProps({ pointsOfInterest: [raw] });

        // Assert
        expect(result.lat).toBeNull();
        expect(result.long).toBeNull();
    });

    it('defaults missing fields to safe values instead of throwing', () => {
        // Arrange
        const raw = {};

        // Act
        const [result] = toDestinationPointOfInterestListProps({ pointsOfInterest: [raw] });

        // Assert
        expect(result.id).toBe('');
        expect(result.slug).toBe('');
        expect(result.type).toBe('');
        expect(result.isFeatured).toBe(false);
        expect(result.displayWeight).toBe(0);
        expect(result.nameI18n).toBeNull();
        expect(result.descriptionI18n).toBeNull();
        expect(result.description).toBeNull();
    });

    it('maps an array preserving order and length', () => {
        // Arrange
        const raw = [
            { id: 'a', slug: 'a', type: 'BEACH', relation: 'PRIMARY' },
            { id: 'b', slug: 'b', type: 'PARK', relation: 'NEARBY' },
            { id: 'c', slug: 'c', type: 'MUSEUM', relation: 'PRIMARY' }
        ];

        // Act
        const result = toDestinationPointOfInterestListProps({ pointsOfInterest: raw });

        // Assert
        expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    });

    it('returns an empty array for an empty input', () => {
        // Act
        const result = toDestinationPointOfInterestListProps({ pointsOfInterest: [] });

        // Assert
        expect(result).toEqual([]);
    });
});
