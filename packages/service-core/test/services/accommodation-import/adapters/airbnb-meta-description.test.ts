import { describe, expect, it } from 'vitest';
import { stripAirbnbMetaDescriptionNoise } from '../../../../src/services/accommodation-import/adapters/airbnb-meta-description.js';

describe('stripAirbnbMetaDescriptionNoise (HOS-287)', () => {
    describe('leading date removal', () => {
        it('should strip the Spanish abbreviated-month date', () => {
            // Arrange — the exact shape reported in the smoke
            const metaDescription =
                '24 de jul de 2026 · Casa rural entero · Cheroga te ofrece tranquilidad.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: 'Casa rural entero'
            });

            // Assert
            expect(result).toBe('Cheroga te ofrece tranquilidad.');
        });

        it('should strip the Spanish full-month date', () => {
            // Arrange
            const metaDescription = '1 de septiembre de 2026 · Cheroga te ofrece tranquilidad.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({ metaDescription });

            // Assert
            expect(result).toBe('Cheroga te ofrece tranquilidad.');
        });

        it('should strip the English date (real probe fixture)', () => {
            // Arrange — verbatim from the live tri_angle probe
            const metaDescription =
                'Jun 23, 2026 · Entire cottage · Cheroga offers you tranquility.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: 'Entire cottage'
            });

            // Assert
            expect(result).toBe('Cheroga offers you tranquility.');
        });

        it('should strip an English full-month date', () => {
            // Arrange
            const metaDescription = 'September 3, 2026 · Cheroga offers you tranquility.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({ metaDescription });

            // Assert
            expect(result).toBe('Cheroga offers you tranquility.');
        });

        it('should tolerate a date without the comma', () => {
            // Arrange
            const metaDescription = 'Jun 23 2026 · Cheroga offers you tranquility.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({ metaDescription });

            // Assert
            expect(result).toBe('Cheroga offers you tranquility.');
        });

        it('should strip a date without the "de" connectors', () => {
            // Arrange — CLDR's modern es short form
            const metaDescription = '24 jul 2026 · Cheroga te ofrece tranquilidad.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({ metaDescription });

            // Assert
            expect(result).toBe('Cheroga te ofrece tranquilidad.');
        });

        it('should strip a date built with non-breaking spaces', () => {
            // Arrange — Intl formatters emit U+202F/U+00A0 between date tokens
            const metaDescription = '24\u00A0de\u202Fjul de 2026 \u00B7 Cheroga te ofrece paz.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({ metaDescription });

            // Assert
            expect(result).toBe('Cheroga te ofrece paz.');
        });

        it('should strip a date preceded by leading whitespace', () => {
            // Arrange — scraped values routinely inherit padding from the HTML;
            // a bare `^` anchor would silently disable the whole fix.
            const metaDescription = '\n  24 de jul de 2026 · Cheroga te ofrece paz.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({ metaDescription });

            // Assert
            expect(result).toBe('Cheroga te ofrece paz.');
        });
    });

    describe('text preservation', () => {
        it('should leave a clean description untouched', () => {
            // Arrange
            const metaDescription = 'Cheroga te ofrece tranquilidad y espacios naturales.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: 'Casa rural entero'
            });

            // Assert
            expect(result).toBe('Cheroga te ofrece tranquilidad y espacios naturales.');
        });

        it('should NOT strip a date that is not at the very start', () => {
            // Arrange
            const metaDescription = 'Disponible desde el 24 de jul de 2026 · reservá ya.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({ metaDescription });

            // Assert
            expect(result).toBe('Disponible desde el 24 de jul de 2026 · reservá ya.');
        });

        it('should NOT strip a leading date that is not followed by a separator', () => {
            // Arrange
            const metaDescription = '24 de jul de 2026 abrimos la casa a los huéspedes.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({ metaDescription });

            // Assert
            expect(result).toBe('24 de jul de 2026 abrimos la casa a los huéspedes.');
        });

        it('should preserve a second segment that is NOT the property type', () => {
            // Arrange — real prose that happens to sit after the date
            const metaDescription = 'Jun 23, 2026 · Un lugar increíble · con pileta y parque.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: 'Entire cottage'
            });

            // Assert — only the date falls
            expect(result).toBe('Un lugar increíble · con pileta y parque.');
        });

        it('should preserve every separator inside the real description text', () => {
            // Arrange
            const metaDescription =
                'Jun 23, 2026 · Entire cottage · Casa · pileta y parque · cochera.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: 'Entire cottage'
            });

            // Assert — nothing beyond the two known noise segments is consumed
            expect(result).toBe('Casa · pileta y parque · cochera.');
        });

        it('should NOT strip a type segment when there is no leading date', () => {
            // Arrange — without the date this is not a meta line, so the first
            // segment may well be real prose that mirrors the type.
            const metaDescription = 'Casa rural entero · Cheroga te ofrece tranquilidad.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: 'Casa rural entero'
            });

            // Assert
            expect(result).toBe('Casa rural entero · Cheroga te ofrece tranquilidad.');
        });

        it('should NOT treat an Argentine street address + postcode as a date', () => {
            // Arrange — `<word> <1-2 digits>, <4 digits> ·` has the exact shape of
            // an English date, but "Colón" is not a month name.
            const metaDescription = 'Colón 45, 3280 · Casa céntrica con parque y pileta.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: 'Casa'
            });

            // Assert — the address survives
            expect(result).toBe('Colón 45, 3280 · Casa céntrica con parque y pileta.');
        });

        it('should NOT treat a capacity line as a date', () => {
            // Arrange
            const metaDescription = 'Depto 2 2024 · totalmente reciclado, muy luminoso.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: 'Depto'
            });

            // Assert
            expect(result).toBe('Depto 2 2024 · totalmente reciclado, muy luminoso.');
        });
    });

    describe('type segment matching', () => {
        it('should match the type ignoring case and accents', () => {
            // Arrange
            const metaDescription = '24 de jul de 2026 · CASA RURAL ENTERO · Texto real.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: 'Casa rural éntero'
            });

            // Assert
            expect(result).toBe('Texto real.');
        });

        it('should fall back to roomType when propertyType does not match', () => {
            // Arrange
            const metaDescription = 'Jun 23, 2026 · Entire home/apt · Texto real.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: 'Entire cottage',
                roomType: 'Entire home/apt'
            });

            // Assert
            expect(result).toBe('Texto real.');
        });

        it('should keep the segment when no type is known', () => {
            // Arrange
            const metaDescription = 'Jun 23, 2026 · Entire cottage · Texto real.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({ metaDescription });

            // Assert
            expect(result).toBe('Entire cottage · Texto real.');
        });

        it('should ignore a blank propertyType instead of matching an empty segment', () => {
            // Arrange
            const metaDescription = 'Jun 23, 2026 ·  · Texto real.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: '   '
            });

            // Assert
            expect(result).toBe('· Texto real.');
        });

        it('should not match an empty segment against a non-alphanumeric type', () => {
            // Arrange — the type normalizes to '' too, so an equality check
            // without an emptiness guard would strip a segment it never matched.
            const metaDescription = 'Jun 23, 2026 ·  · Texto real.';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: '—'
            });

            // Assert
            expect(result).toBe('· Texto real.');
        });
    });

    describe('degenerate input', () => {
        it('should return null when the type is the last segment (listing with no blurb)', () => {
            // Arrange — a meta line with no third segment: what is left is the
            // type itself, which is not a short description.
            const metaDescription = '24 de jul de 2026 · Casa rural entero';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: 'Casa rural entero'
            });

            // Assert
            expect(result).toBeNull();
        });

        it('should keep a trailing segment that is NOT the type', () => {
            // Arrange
            const metaDescription = '24 de jul de 2026 · Cheroga te ofrece paz';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: 'Casa rural entero'
            });

            // Assert
            expect(result).toBe('Cheroga te ofrece paz');
        });

        it('should return null when only noise remains', () => {
            // Arrange
            const metaDescription = 'Jun 23, 2026 · Entire cottage · ';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({
                metaDescription,
                propertyType: 'Entire cottage'
            });

            // Assert
            expect(result).toBeNull();
        });

        it('should return null for a blank value', () => {
            // Arrange
            const metaDescription = '   ';

            // Act
            const result = stripAirbnbMetaDescriptionNoise({ metaDescription });

            // Assert
            expect(result).toBeNull();
        });
    });
});
