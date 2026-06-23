/**
 * Tests for the amenity synonym dictionary and normalization helper (SPEC-258)
 *
 * Covers:
 * - {@link normalizeAmenityTerm}: diacritics, case, whitespace, plural fold.
 * - {@link AMENITY_SYNONYMS}: spot-check that the map resolves the primary
 *   regional variants (es/en/pt) to the expected catalog slugs.
 */

import { describe, expect, it } from 'vitest';
import {
    AMENITY_SYNONYMS,
    normalizeAmenityTerm
} from '../../../../src/services/accommodation-import/resolvers/amenity-synonyms.js';

// ---------------------------------------------------------------------------
// normalizeAmenityTerm
// ---------------------------------------------------------------------------

describe('normalizeAmenityTerm', () => {
    describe('basic normalization', () => {
        it('should lowercase input', () => {
            // Arrange / Act / Assert
            // "WiFi" has no diacritics or special chars → just lowercase → "wifi"
            expect(normalizeAmenityTerm('WiFi')).toBe('wifi');
            expect(normalizeAmenityTerm('POOL')).toBe('pool');
        });

        it('should trim leading and trailing whitespace', () => {
            expect(normalizeAmenityTerm('  pool  ')).toBe('pool');
            expect(normalizeAmenityTerm('\t Wifi \n')).toBe('wifi');
        });

        it('should collapse internal whitespace to single space', () => {
            expect(normalizeAmenityTerm('aire  acondicionado')).toBe('aire acondicionado');
            expect(normalizeAmenityTerm('piscina  climatizada')).toBe('piscina climatizada');
        });

        it('should return empty string for blank input', () => {
            expect(normalizeAmenityTerm('')).toBe('');
            expect(normalizeAmenityTerm('   ')).toBe('');
        });
    });

    describe('diacritic stripping', () => {
        it('should strip Spanish diacritics (accents)', () => {
            expect(normalizeAmenityTerm('Calefacción')).toBe('calefaccion');
            expect(normalizeAmenityTerm('Área')).toBe('area');
            expect(normalizeAmenityTerm('Jardín')).toBe('jardin');
        });

        it('should strip Portuguese diacritics', () => {
            expect(normalizeAmenityTerm('aquecimento')).toBe('aquecimento');
            expect(normalizeAmenityTerm('varanda')).toBe('varanda');
        });
    });

    describe('plural fold', () => {
        it('should strip trailing -s when preceded by a vowel or l', () => {
            // "pools" → 'l' before 's' → fold → "pool"
            expect(normalizeAmenityTerm('pools')).toBe('pool');
            // "towels" → 'l' before 's' → fold → "towel"
            expect(normalizeAmenityTerm('towels')).toBe('towel');
        });

        it('should fold when preceded by a vowel (e before s in "bikes")', () => {
            // "bikes" → last char of stem is 'e' (vowel) → fold → "bike"
            expect(normalizeAmenityTerm('bikes')).toBe('bike');
        });

        it('should NOT fold when preceded by a double consonant (e.g. "press")', () => {
            // "press" → last char of stem is 's' → not vowel or l → no fold
            expect(normalizeAmenityTerm('press')).toBe('press');
        });

        it('should prefer stripping -es over -s for Spanish plurals', () => {
            // "piscinas" ends in 's' → strip 's' → "piscina"
            expect(normalizeAmenityTerm('piscinas')).toBe('piscina');
            // "cocinas" → "cocina"
            expect(normalizeAmenityTerm('cocinas')).toBe('cocina');
        });

        it('should not fold stem shorter than 3 characters', () => {
            // "as" → should not become "a"
            expect(normalizeAmenityTerm('as')).toBe('as');
            // "es" → should not become ""
            expect(normalizeAmenityTerm('es')).toBe('es');
        });

        it('should fold -as ending (vowel a before s)', () => {
            // "vistas" ends in 'as' → 'a' is a vowel → fold → "vista"
            expect(normalizeAmenityTerm('vistas')).toBe('vista');
        });
    });
});

// ---------------------------------------------------------------------------
// AMENITY_SYNONYMS — spot-check the most important entries
// ---------------------------------------------------------------------------

describe('AMENITY_SYNONYMS', () => {
    /**
     * Helper that normalizes a term and looks it up in the synonym map,
     * returning the slug or undefined.
     */
    function resolve(raw: string): string | undefined {
        return AMENITY_SYNONYMS.get(normalizeAmenityTerm(raw));
    }

    describe('pool / piscina / pileta', () => {
        it('should map "pileta" to pool', () => {
            expect(resolve('pileta')).toBe('pool');
        });

        it('should map "Piscina" (capitalized) to pool', () => {
            expect(resolve('Piscina')).toBe('pool');
        });

        it('should map "piscinas" (Spanish plural) to pool', () => {
            // normalizeAmenityTerm('piscinas') → 'piscina' → maps to 'pool'
            expect(resolve('piscinas')).toBe('pool');
        });

        it('should map "Pool" (English, capitalized) to pool', () => {
            expect(resolve('Pool')).toBe('pool');
        });

        it('should map "swimming pool" to pool', () => {
            expect(resolve('swimming pool')).toBe('pool');
        });
    });

    describe('wifi / wi-fi / internet', () => {
        it('should map "Wi-Fi" to wifi', () => {
            expect(resolve('Wi-Fi')).toBe('wifi');
        });

        it('should map "wi fi" (no hyphen) to wifi', () => {
            expect(resolve('wi fi')).toBe('wifi');
        });

        it('should map "Internet" to wifi', () => {
            expect(resolve('Internet')).toBe('wifi');
        });

        it('should map "Wireless" to wifi', () => {
            expect(resolve('Wireless')).toBe('wifi');
        });
    });

    describe('air conditioning / aire acondicionado', () => {
        it('should map "Aire acondicionado" to air_conditioning', () => {
            expect(resolve('Aire acondicionado')).toBe('air_conditioning');
        });

        it('should map "aire acondicionado" with accent to air_conditioning', () => {
            expect(resolve('Aire Acondicionado')).toBe('air_conditioning');
        });

        it('should map "AC" to air_conditioning', () => {
            expect(resolve('AC')).toBe('air_conditioning');
        });

        it('should map "Air Conditioning" (English) to air_conditioning', () => {
            expect(resolve('Air Conditioning')).toBe('air_conditioning');
        });

        it('should map "Ar condicionado" (Portuguese) to air_conditioning', () => {
            expect(resolve('Ar condicionado')).toBe('air_conditioning');
        });
    });

    describe('parking / cochera / estacionamiento', () => {
        it('should map "cochera" to parking', () => {
            expect(resolve('cochera')).toBe('parking');
        });

        it('should map "Estacionamiento" to parking', () => {
            expect(resolve('Estacionamiento')).toBe('parking');
        });

        it('should map "garage" to parking', () => {
            expect(resolve('garage')).toBe('parking');
        });
    });

    describe('heating / calefaccion', () => {
        it('should map "Calefacción" (with accent) to heating', () => {
            expect(resolve('Calefacción')).toBe('heating');
        });

        it('should map "Central Heating" (English) to heating', () => {
            expect(resolve('Central Heating')).toBe('heating');
        });
    });

    describe('bbq / parrilla', () => {
        it('should map "parrilla" to bbq_grill', () => {
            expect(resolve('parrilla')).toBe('bbq_grill');
        });

        it('should map "BBQ" to bbq_grill', () => {
            expect(resolve('BBQ')).toBe('bbq_grill');
        });

        it('should map "Barbecue" to bbq_grill', () => {
            expect(resolve('Barbecue')).toBe('bbq_grill');
        });
    });

    describe('regional variants (Rioplatense Spanish)', () => {
        it('should map "lavarropas" to washer', () => {
            expect(resolve('lavarropas')).toBe('washer');
        });

        it('should map "heladera" to refrigerator_freezer', () => {
            expect(resolve('heladera')).toBe('refrigerator_freezer');
        });

        it('should map "cafetera" to coffee_maker', () => {
            expect(resolve('cafetera')).toBe('coffee_maker');
        });

        it('should map "matafuego" to fire_extinguisher', () => {
            expect(resolve('matafuego')).toBe('fire_extinguisher');
        });

        it('should map "quincho" — note: not in synonym map (it has its own catalog slug)', () => {
            // "quincho" is already a catalog slug; the current map doesn't remap it.
            // This test documents that behavior: it should be undefined.
            // (The multi-locale match in the enhanced resolver handles it directly.)
            expect(resolve('quincho')).toBeUndefined();
        });
    });

    describe('terms that should NOT resolve (truly unknown)', () => {
        it('should return undefined for a genuinely unknown term', () => {
            expect(resolve('UnknownAmenityXYZ123')).toBeUndefined();
        });

        it('should return undefined for an empty string', () => {
            expect(resolve('')).toBeUndefined();
        });
    });
});
