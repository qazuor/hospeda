/**
 * Unit tests for computeCardText() in destination-card.types.ts
 *
 * Tests the URL construction, i18n text selection, and default value logic
 * using the real function and real translation data (no mocks).
 */
import { describe, expect, it } from 'vitest';
import {
    type CardComputedText,
    type DestinationCardData,
    computeCardText
} from '../../../src/components/destination/destination-card.types';

// ---------------------------------------------------------------------------
// Minimal factory
// ---------------------------------------------------------------------------

/**
 * Creates a minimal valid DestinationCardData for use in tests.
 * Override individual fields per test as needed.
 */
function makeDestination(overrides: Partial<DestinationCardData> = {}): DestinationCardData {
    return {
        slug: 'concepcion-del-uruguay',
        name: 'Concepcion del Uruguay',
        summary: 'A city on the Uruguay River.',
        featuredImage: 'https://example.com/img.jpg',
        accommodationsCount: 5,
        isFeatured: false,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// detailUrl
// ---------------------------------------------------------------------------

describe('computeCardText - detailUrl', () => {
    it('uses path when path is provided', () => {
        // Arrange
        const destination = makeDestination({ path: 'custom/path', slug: 'slug-fallback' });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        expect(result.detailUrl).toBe('/en/destinos/custom/path/');
    });

    it('falls back to slug when path is undefined', () => {
        // Arrange
        const destination = makeDestination({ path: undefined, slug: 'my-destination' });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        expect(result.detailUrl).toBe('/en/destinos/my-destination/');
    });

    it('falls back to slug when path is not present', () => {
        // Arrange
        const destination = makeDestination({ slug: 'river-town' });

        // Act
        const result = computeCardText({ destination, locale: 'es' });

        // Assert
        expect(result.detailUrl).toBe('/es/destinos/river-town/');
    });
});

// ---------------------------------------------------------------------------
// detailUrl - locale prefix
// ---------------------------------------------------------------------------

describe('computeCardText - locale prefix in detailUrl', () => {
    it('uses "es" locale prefix', () => {
        // Arrange
        const destination = makeDestination({ slug: 'destino' });

        // Act
        const result = computeCardText({ destination, locale: 'es' });

        // Assert
        expect(result.detailUrl).toMatch(/^\/es\//);
    });

    it('uses "en" locale prefix', () => {
        // Arrange
        const destination = makeDestination({ slug: 'destino' });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        expect(result.detailUrl).toMatch(/^\/en\//);
    });

    it('uses "pt" locale prefix', () => {
        // Arrange
        const destination = makeDestination({ slug: 'destino' });

        // Act
        const result = computeCardText({ destination, locale: 'pt' });

        // Assert
        expect(result.detailUrl).toMatch(/^\/pt\//);
    });

    it('different locales produce different URL prefixes for the same slug', () => {
        // Arrange
        const destination = makeDestination({ slug: 'same-slug' });

        // Act
        const esResult = computeCardText({ destination, locale: 'es' });
        const enResult = computeCardText({ destination, locale: 'en' });
        const ptResult = computeCardText({ destination, locale: 'pt' });

        // Assert
        expect(esResult.detailUrl).toBe('/es/destinos/same-slug/');
        expect(enResult.detailUrl).toBe('/en/destinos/same-slug/');
        expect(ptResult.detailUrl).toBe('/pt/destinos/same-slug/');
        expect(esResult.detailUrl).not.toBe(enResult.detailUrl);
        expect(enResult.detailUrl).not.toBe(ptResult.detailUrl);
    });
});

// ---------------------------------------------------------------------------
// accText - singular vs plural
// ---------------------------------------------------------------------------

describe('computeCardText - accText', () => {
    it('uses singular key when accommodationsCount is 1 (en)', () => {
        // Arrange
        const destination = makeDestination({ accommodationsCount: 1 });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        // Expected from en/destination.json: "{{count}} accommodation"
        expect(result.accText).toBe('1 accommodation');
    });

    it('uses plural key when accommodationsCount is 0 (en)', () => {
        // Arrange
        const destination = makeDestination({ accommodationsCount: 0 });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        // Expected from en/destination.json: "{{count}} accommodations"
        expect(result.accText).toBe('0 accommodations');
    });

    it('uses plural key when accommodationsCount is greater than 1 (en)', () => {
        // Arrange
        const destination = makeDestination({ accommodationsCount: 12 });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        expect(result.accText).toBe('12 accommodations');
    });

    it('uses singular key when accommodationsCount is 1 (es)', () => {
        // Arrange
        const destination = makeDestination({ accommodationsCount: 1 });

        // Act
        const result = computeCardText({ destination, locale: 'es' });

        // Assert
        // Expected from es/destination.json: "{{count}} alojamiento"
        expect(result.accText).toBe('1 alojamiento');
    });

    it('uses plural key when accommodationsCount is 3 (es)', () => {
        // Arrange
        const destination = makeDestination({ accommodationsCount: 3 });

        // Act
        const result = computeCardText({ destination, locale: 'es' });

        // Assert
        // Expected from es/destination.json: "{{count}} alojamientos"
        expect(result.accText).toBe('3 alojamientos');
    });

    it('interpolates the count value into accText', () => {
        // Arrange
        const destination = makeDestination({ accommodationsCount: 42 });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert - count must appear in the output string
        expect(result.accText).toContain('42');
    });
});

// ---------------------------------------------------------------------------
// evtCount - default value
// ---------------------------------------------------------------------------

describe('computeCardText - evtCount default', () => {
    it('defaults evtCount to 0 when eventsCount is undefined', () => {
        // Arrange
        const destination = makeDestination({ eventsCount: undefined });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        expect(result.evtCount).toBe(0);
    });

    it('uses eventsCount value when provided', () => {
        // Arrange
        const destination = makeDestination({ eventsCount: 7 });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        expect(result.evtCount).toBe(7);
    });

    it('preserves eventsCount of 0 as 0', () => {
        // Arrange
        const destination = makeDestination({ eventsCount: 0 });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        expect(result.evtCount).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// evtText - singular vs plural
// ---------------------------------------------------------------------------

describe('computeCardText - evtText', () => {
    it('uses singular key when eventsCount is 1 (en)', () => {
        // Arrange
        const destination = makeDestination({ eventsCount: 1 });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        // Expected from en/destination.json: "{{count}} event"
        expect(result.evtText).toBe('1 event');
    });

    it('uses plural key when eventsCount is 0 (en)', () => {
        // Arrange
        const destination = makeDestination({ eventsCount: 0 });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        // Expected from en/destination.json: "{{count}} events"
        expect(result.evtText).toBe('0 events');
    });

    it('uses plural key when eventsCount is greater than 1 (en)', () => {
        // Arrange
        const destination = makeDestination({ eventsCount: 5 });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        expect(result.evtText).toBe('5 events');
    });

    it('uses plural key when eventsCount is undefined (defaults to 0, en)', () => {
        // Arrange
        const destination = makeDestination({ eventsCount: undefined });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        expect(result.evtText).toBe('0 events');
    });

    it('uses singular key when eventsCount is 1 (es)', () => {
        // Arrange
        const destination = makeDestination({ eventsCount: 1 });

        // Act
        const result = computeCardText({ destination, locale: 'es' });

        // Assert
        // Expected from es/destination.json: "{{count}} evento"
        expect(result.evtText).toBe('1 evento');
    });

    it('uses plural key when eventsCount is 4 (es)', () => {
        // Arrange
        const destination = makeDestination({ eventsCount: 4 });

        // Act
        const result = computeCardText({ destination, locale: 'es' });

        // Assert
        // Expected from es/destination.json: "{{count}} eventos"
        expect(result.evtText).toBe('4 eventos');
    });

    it('interpolates the count value into evtText', () => {
        // Arrange
        const destination = makeDestination({ eventsCount: 99 });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        expect(result.evtText).toContain('99');
    });
});

// ---------------------------------------------------------------------------
// featuredLabel
// ---------------------------------------------------------------------------

describe('computeCardText - featuredLabel', () => {
    it('returns translated featured label in English', () => {
        // Arrange
        const destination = makeDestination();

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        // Expected from en/destination.json: "Featured"
        expect(result.featuredLabel).toBe('Featured');
    });

    it('returns translated featured label in Spanish', () => {
        // Arrange
        const destination = makeDestination();

        // Act
        const result = computeCardText({ destination, locale: 'es' });

        // Assert
        // Expected from es/destination.json: "Destacado"
        expect(result.featuredLabel).toBe('Destacado');
    });

    it('returns translated featured label in Portuguese', () => {
        // Arrange
        const destination = makeDestination();

        // Act
        const result = computeCardText({ destination, locale: 'pt' });

        // Assert
        // Expected from pt/destination.json: "Destaque"
        expect(result.featuredLabel).toBe('Destaque');
    });

    it('differs between locales', () => {
        // Arrange
        const destination = makeDestination();

        // Act
        const en = computeCardText({ destination, locale: 'en' }).featuredLabel;
        const es = computeCardText({ destination, locale: 'es' }).featuredLabel;

        // Assert
        expect(en).not.toBe(es);
    });
});

// ---------------------------------------------------------------------------
// favLabel
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Return type shape
// ---------------------------------------------------------------------------

describe('computeCardText - return type completeness', () => {
    it('returns an object with all required CardComputedText fields', () => {
        // Arrange
        const destination = makeDestination();

        // Act
        const result: CardComputedText = computeCardText({ destination, locale: 'en' });

        // Assert - all keys present
        expect(result).toHaveProperty('detailUrl');
        expect(result).toHaveProperty('accText');
        expect(result).toHaveProperty('evtCount');
        expect(result).toHaveProperty('evtText');
        expect(result).toHaveProperty('featuredLabel');
    });

    it('detailUrl is a non-empty string', () => {
        // Arrange
        const destination = makeDestination();

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        expect(typeof result.detailUrl).toBe('string');
        expect(result.detailUrl.length).toBeGreaterThan(0);
    });

    it('evtCount is a number', () => {
        // Arrange
        const destination = makeDestination({ eventsCount: 3 });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        expect(typeof result.evtCount).toBe('number');
    });

    it('all text fields are non-empty strings', () => {
        // Arrange
        const destination = makeDestination({ eventsCount: 2, accommodationsCount: 3 });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        for (const field of ['accText', 'evtText', 'featuredLabel'] as const) {
            expect(typeof result[field]).toBe('string');
            expect(result[field].length).toBeGreaterThan(0);
        }
    });

    it('detailUrl always starts with a forward slash', () => {
        // Arrange
        const destination = makeDestination({ path: 'some/path' });

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        expect(result.detailUrl.startsWith('/')).toBe(true);
    });

    it('detailUrl always ends with a forward slash', () => {
        // Arrange
        const destination = makeDestination();

        // Act
        const result = computeCardText({ destination, locale: 'en' });

        // Assert
        expect(result.detailUrl.endsWith('/')).toBe(true);
    });
});
