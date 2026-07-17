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
            displayWeight: 80,
            primaryCategory: { slug: 'beach', nameI18n: { es: 'Playa', en: null, pt: null } }
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
            displayWeight: 80,
            primaryCategory: { slug: 'beach', nameI18n: { es: 'Playa', en: null, pt: null } },
            categories: []
        });
    });

    // ── categories[] (HOS-147) ───────────────────────────────────────────────

    it('maps the full categories[] set to { slug } entries', () => {
        // Arrange
        const raw = {
            id: 'poi-cats',
            slug: 'multi',
            type: 'OTHER',
            categories: [{ slug: 'termas' }, { slug: 'gastronomia' }]
        };

        // Act
        const [result] = toDestinationPointOfInterestListProps({ pointsOfInterest: [raw] });

        // Assert
        expect(result.categories).toEqual([{ slug: 'termas' }, { slug: 'gastronomia' }]);
    });

    it('defaults a missing categories field to an empty array', () => {
        // Arrange
        const raw = { id: 'poi-nocats', slug: 'x', type: 'OTHER' };

        // Act
        const [result] = toDestinationPointOfInterestListProps({ pointsOfInterest: [raw] });

        // Assert
        expect(result.categories).toEqual([]);
    });

    it('defensively drops malformed category entries (no string slug)', () => {
        // Arrange
        const raw = {
            id: 'poi-badcats',
            slug: 'y',
            type: 'OTHER',
            categories: [{ slug: 'ok' }, { slug: 42 }, {}, null, { nameI18n: {} }]
        };

        // Act
        const [result] = toDestinationPointOfInterestListProps({ pointsOfInterest: [raw] });

        // Assert — only the well-formed entry survives.
        expect(result.categories).toEqual([{ slug: 'ok' }]);
    });

    // ── primaryCategory (HOS-182) ────────────────────────────────────────────

    it('passes through a well-formed primaryCategory object', () => {
        // Arrange
        const raw = {
            id: 'poi-cat-1',
            slug: 'museo-x',
            type: 'MUSEUM',
            primaryCategory: { slug: 'museum', nameI18n: { es: 'Museo', en: null, pt: null } }
        };

        // Act
        const [result] = toDestinationPointOfInterestListProps({ pointsOfInterest: [raw] });

        // Assert
        expect(result.primaryCategory).toEqual({
            slug: 'museum',
            nameI18n: { es: 'Museo', en: null, pt: null }
        });
    });

    it('normalizes a missing primaryCategory to null (expected — POI has no primary category)', () => {
        // Arrange
        const raw = { id: 'poi-cat-2', slug: 'sin-categoria', type: 'OTHER' };

        // Act
        const [result] = toDestinationPointOfInterestListProps({ pointsOfInterest: [raw] });

        // Assert
        expect(result.primaryCategory).toBeNull();
    });

    it('normalizes an explicit null primaryCategory to null', () => {
        // Arrange
        const raw = {
            id: 'poi-cat-3',
            slug: 'sin-categoria-2',
            type: 'OTHER',
            primaryCategory: null
        };

        // Act
        const [result] = toDestinationPointOfInterestListProps({ pointsOfInterest: [raw] });

        // Assert
        expect(result.primaryCategory).toBeNull();
    });

    it('normalizes a malformed primaryCategory (no string slug) to null defensively', () => {
        // Arrange
        const raw = {
            id: 'poi-cat-4',
            slug: 'categoria-rota',
            type: 'OTHER',
            primaryCategory: { slug: 42, nameI18n: { es: 'x' } }
        };

        // Act
        const [result] = toDestinationPointOfInterestListProps({ pointsOfInterest: [raw] });

        // Assert
        expect(result.primaryCategory).toBeNull();
    });

    it('defaults a primaryCategory missing nameI18n to null (not undefined)', () => {
        // Arrange
        const raw = {
            id: 'poi-cat-5',
            slug: 'categoria-sin-nombre',
            type: 'OTHER',
            primaryCategory: { slug: 'other' }
        };

        // Act
        const [result] = toDestinationPointOfInterestListProps({ pointsOfInterest: [raw] });

        // Assert
        expect(result.primaryCategory).toEqual({ slug: 'other', nameI18n: null });
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
        expect(result.primaryCategory).toBeNull();
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
