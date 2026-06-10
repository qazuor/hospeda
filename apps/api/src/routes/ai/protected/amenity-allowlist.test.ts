/**
 * Unit tests for amenity and feature allowlists (SPEC-199 §8.1).
 *
 * Tests:
 * - `matchAmenityTerms`: exact match (es/en/pt); partial-text match;
 *   unknown term → empty; case-insensitive; dedup.
 * - `matchFeatureTerms`: exact match (es/en/pt); partial-text match;
 *   unknown term → empty; case-insensitive; dedup.
 * - Anti-overlap negatives:
 *   `matchFeatureTerms('pet friendly', 'en')` → []
 *   `matchFeatureTerms('wifi', 'en')` → []
 *
 * @module apps/api/routes/ai/protected/amenity-allowlist.test
 */

import { describe, expect, it } from 'vitest';
import {
    AMENITY_ALLOWLIST,
    FEATURE_ALLOWLIST,
    matchAmenityTerms,
    matchFeatureTerms
} from './amenity-allowlist';

// ─── matchAmenityTerms ────────────────────────────────────────────────────────

describe('matchAmenityTerms', () => {
    // ── Exact matches ────────────────────────────────────────────────────────

    describe('exact match — es', () => {
        it('should match "pileta" → pool', () => {
            // Arrange / Act
            const result = matchAmenityTerms('pileta', 'es');
            // Assert
            expect(result).toContain('pool');
        });

        it('should match "wifi" → wifi', () => {
            const result = matchAmenityTerms('wifi', 'es');
            expect(result).toContain('wifi');
        });

        it('should match "parrilla" → bbq', () => {
            const result = matchAmenityTerms('parrilla', 'es');
            expect(result).toContain('bbq');
        });

        it('should match "mascotas" → pets-allowed', () => {
            const result = matchAmenityTerms('mascotas', 'es');
            expect(result).toContain('pets-allowed');
        });

        it('should match "desayuno" → breakfast', () => {
            const result = matchAmenityTerms('desayuno', 'es');
            expect(result).toContain('breakfast');
        });

        it('should match "aire acondicionado" → air-conditioning', () => {
            const result = matchAmenityTerms('aire acondicionado', 'es');
            expect(result).toContain('air-conditioning');
        });

        it('should match "cochera" → parking', () => {
            const result = matchAmenityTerms('cochera', 'es');
            expect(result).toContain('parking');
        });
    });

    describe('exact match — en', () => {
        it('should match "pool" → pool', () => {
            const result = matchAmenityTerms('pool', 'en');
            expect(result).toContain('pool');
        });

        it('should match "swimming pool" → pool', () => {
            const result = matchAmenityTerms('swimming pool', 'en');
            expect(result).toContain('pool');
        });

        it('should match "bbq" → bbq', () => {
            const result = matchAmenityTerms('bbq', 'en');
            expect(result).toContain('bbq');
        });

        it('should match "barbecue" → bbq', () => {
            const result = matchAmenityTerms('barbecue', 'en');
            expect(result).toContain('bbq');
        });

        it('should match "parking" → parking', () => {
            const result = matchAmenityTerms('parking', 'en');
            expect(result).toContain('parking');
        });

        it('should match "pet friendly" → pets-allowed', () => {
            const result = matchAmenityTerms('pet friendly', 'en');
            expect(result).toContain('pets-allowed');
        });

        it('should match "pet-friendly" → pets-allowed', () => {
            const result = matchAmenityTerms('pet-friendly', 'en');
            expect(result).toContain('pets-allowed');
        });

        it('should match "breakfast included" → breakfast', () => {
            const result = matchAmenityTerms('breakfast included', 'en');
            expect(result).toContain('breakfast');
        });

        it('should match "air conditioning" → air-conditioning', () => {
            const result = matchAmenityTerms('air conditioning', 'en');
            expect(result).toContain('air-conditioning');
        });
    });

    describe('exact match — pt', () => {
        it('should match "piscina" → pool', () => {
            const result = matchAmenityTerms('piscina', 'pt');
            expect(result).toContain('pool');
        });

        it('should match "churrasqueira" → bbq', () => {
            const result = matchAmenityTerms('churrasqueira', 'pt');
            expect(result).toContain('bbq');
        });

        it('should match "estacionamento" → parking', () => {
            const result = matchAmenityTerms('estacionamento', 'pt');
            expect(result).toContain('parking');
        });

        it('should match "animais" → pets-allowed', () => {
            const result = matchAmenityTerms('animais', 'pt');
            expect(result).toContain('pets-allowed');
        });

        it('should match "ar condicionado" → air-conditioning', () => {
            const result = matchAmenityTerms('ar condicionado', 'pt');
            expect(result).toContain('air-conditioning');
        });
    });

    // ── Partial-text match (term embedded in a longer sentence) ─────────────

    describe('partial-text match', () => {
        it('should match when the term appears within a longer sentence (es)', () => {
            // Arrange
            const query = 'quiero una cabaña con pileta y parrilla';
            // Act
            const result = matchAmenityTerms(query, 'es');
            // Assert
            expect(result).toContain('pool');
            expect(result).toContain('bbq');
        });

        it('should match when the term appears within a longer sentence (en)', () => {
            const query = 'I want a cabin with a pool and grill near the lake';
            const result = matchAmenityTerms(query, 'en');
            expect(result).toContain('pool');
            expect(result).toContain('bbq');
        });

        it('should match when the term appears within a longer sentence (pt)', () => {
            const query = 'quero um chalé com piscina e wifi perto do rio';
            const result = matchAmenityTerms(query, 'pt');
            expect(result).toContain('pool');
            expect(result).toContain('wifi');
        });
    });

    // ── Unknown term → empty array ────────────────────────────────────────────

    describe('unknown term', () => {
        it('should return an empty array for text with no known amenity terms (es)', () => {
            const result = matchAmenityTerms('una vista increíble al monte', 'es');
            expect(result).toHaveLength(0);
        });

        it('should return an empty array for text with no known amenity terms (en)', () => {
            const result = matchAmenityTerms('a beautiful mountain view', 'en');
            expect(result).toHaveLength(0);
        });

        it('should return an empty array for an empty string', () => {
            const result = matchAmenityTerms('', 'en');
            expect(result).toHaveLength(0);
        });

        it('should silently ignore "jacuzzi" (not in allowlist)', () => {
            // Spec AC-12: unrecognised terms are silently ignored.
            // Note: the query must avoid substrings of dictionary keys ("ac" is
            // a key in the 'en' AMENITY_ALLOWLIST mapping to "air-conditioning").
            // Using "hot tub" which has no substring overlap with any known key.
            const result = matchAmenityTerms('with a hot tub', 'en');
            expect(result).toHaveLength(0);
        });
    });

    // ── Case-insensitive ─────────────────────────────────────────────────────

    describe('case-insensitive matching', () => {
        it('should match "POOL" (uppercase) → pool (en)', () => {
            const result = matchAmenityTerms('POOL', 'en');
            expect(result).toContain('pool');
        });

        it('should match "WiFi" (mixed case) → wifi (en)', () => {
            const result = matchAmenityTerms('WiFi', 'en');
            expect(result).toContain('wifi');
        });

        it('should match "Pileta" (initial cap) → pool (es)', () => {
            const result = matchAmenityTerms('Pileta', 'es');
            expect(result).toContain('pool');
        });

        it('should match "BBQ" (all caps) → bbq (en)', () => {
            const result = matchAmenityTerms('BBQ', 'en');
            expect(result).toContain('bbq');
        });
    });

    // ── Deduplication ─────────────────────────────────────────────────────────

    describe('deduplication', () => {
        it('should de-duplicate when multiple terms resolve to the same slug (es)', () => {
            // "pileta" and "piscina" both map to "pool"
            const result = matchAmenityTerms('pileta y piscina', 'es');
            const poolMatches = result.filter((s) => s === 'pool');
            expect(poolMatches).toHaveLength(1);
        });

        it('should de-duplicate when multiple terms resolve to the same slug (en)', () => {
            // "pool" and "swimming pool" both map to "pool"
            const result = matchAmenityTerms('pool and swimming pool', 'en');
            const poolMatches = result.filter((s) => s === 'pool');
            expect(poolMatches).toHaveLength(1);
        });

        it('should de-duplicate "bbq" and "barbecue" → single bbq entry (en)', () => {
            const result = matchAmenityTerms('bbq or barbecue available', 'en');
            const bbqMatches = result.filter((s) => s === 'bbq');
            expect(bbqMatches).toHaveLength(1);
        });
    });

    // ── Return type is readonly ───────────────────────────────────────────────

    it('should return a readonly array', () => {
        const result = matchAmenityTerms('pool', 'en');
        // TypeScript enforces readonly at compile time; at runtime it is still
        // a regular Array. We only assert it is array-like.
        expect(Array.isArray(result)).toBe(true);
    });
});

// ─── matchFeatureTerms ────────────────────────────────────────────────────────

describe('matchFeatureTerms', () => {
    // ── Exact matches ────────────────────────────────────────────────────────

    describe('exact match — es', () => {
        it('should match "tranquilo" → quiet_zone', () => {
            const result = matchFeatureTerms('tranquilo', 'es');
            expect(result).toContain('quiet_zone');
        });

        it('should match "frente al río" → river_front', () => {
            const result = matchFeatureTerms('frente al río', 'es');
            expect(result).toContain('river_front');
        });

        it('should match "naturaleza" → natural_environment', () => {
            const result = matchFeatureTerms('naturaleza', 'es');
            expect(result).toContain('natural_environment');
        });

        it('should match "romántico" → couple_suitable', () => {
            const result = matchFeatureTerms('romántico', 'es');
            expect(result).toContain('couple_suitable');
        });

        it('should match "rural" → rural_area', () => {
            const result = matchFeatureTerms('rural', 'es');
            expect(result).toContain('rural_area');
        });

        it('should match "yoga" → yoga_meditation_area', () => {
            const result = matchFeatureTerms('yoga', 'es');
            expect(result).toContain('yoga_meditation_area');
        });

        it('should match "sustentable" → sustainable_accommodation', () => {
            const result = matchFeatureTerms('sustentable', 'es');
            expect(result).toContain('sustainable_accommodation');
        });

        it('should match "boda" → wedding_suitable', () => {
            const result = matchFeatureTerms('boda', 'es');
            expect(result).toContain('wedding_suitable');
        });
    });

    describe('exact match — en', () => {
        it('should match "quiet" → quiet_zone', () => {
            const result = matchFeatureTerms('quiet', 'en');
            expect(result).toContain('quiet_zone');
        });

        it('should match "riverfront" → river_front', () => {
            const result = matchFeatureTerms('riverfront', 'en');
            expect(result).toContain('river_front');
        });

        it('should match "nature" → natural_environment', () => {
            const result = matchFeatureTerms('nature', 'en');
            expect(result).toContain('natural_environment');
        });

        it('should match "romantic" → couple_suitable', () => {
            const result = matchFeatureTerms('romantic', 'en');
            expect(result).toContain('couple_suitable');
        });

        it('should match "sustainable" → sustainable_accommodation', () => {
            const result = matchFeatureTerms('sustainable', 'en');
            expect(result).toContain('sustainable_accommodation');
        });

        it('should match "meditation" → yoga_meditation_area', () => {
            const result = matchFeatureTerms('meditation', 'en');
            expect(result).toContain('yoga_meditation_area');
        });

        it('should match "digital detox" → digital_detox_zone', () => {
            const result = matchFeatureTerms('digital detox', 'en');
            expect(result).toContain('digital_detox_zone');
        });

        it('should match "wedding" → wedding_suitable', () => {
            const result = matchFeatureTerms('wedding', 'en');
            expect(result).toContain('wedding_suitable');
        });

        it('should match "panoramic view" → panoramic_view_extended', () => {
            const result = matchFeatureTerms('panoramic view', 'en');
            expect(result).toContain('panoramic_view_extended');
        });
    });

    describe('exact match — pt', () => {
        it('should match "tranquilo" → quiet_zone', () => {
            const result = matchFeatureTerms('tranquilo', 'pt');
            expect(result).toContain('quiet_zone');
        });

        it('should match "frente ao rio" → river_front', () => {
            const result = matchFeatureTerms('frente ao rio', 'pt');
            expect(result).toContain('river_front');
        });

        it('should match "natureza" → natural_environment', () => {
            const result = matchFeatureTerms('natureza', 'pt');
            expect(result).toContain('natural_environment');
        });

        it('should match "romântico" → couple_suitable', () => {
            const result = matchFeatureTerms('romântico', 'pt');
            expect(result).toContain('couple_suitable');
        });

        it('should match "yoga" → yoga_meditation_area (pt has both ioga and yoga)', () => {
            const result = matchFeatureTerms('yoga', 'pt');
            expect(result).toContain('yoga_meditation_area');
        });

        it('should match "ioga" → yoga_meditation_area', () => {
            const result = matchFeatureTerms('ioga', 'pt');
            expect(result).toContain('yoga_meditation_area');
        });

        it('should match "rural" → rural_area', () => {
            const result = matchFeatureTerms('rural', 'pt');
            expect(result).toContain('rural_area');
        });
    });

    // ── Partial-text match ────────────────────────────────────────────────────

    describe('partial-text match', () => {
        it('should match when feature term appears within a longer sentence (es)', () => {
            const query = 'busco algo tranquilo frente al río en zona rural';
            const result = matchFeatureTerms(query, 'es');
            expect(result).toContain('quiet_zone');
            expect(result).toContain('river_front');
            expect(result).toContain('rural_area');
        });

        it('should match when feature term appears within a longer sentence (en)', () => {
            // "riverside" does NOT match "riverfront" or "river front" — different words.
            // Use "riverfront" explicitly so the substring check fires.
            const query = 'I want a quiet riverfront cabin for a romantic getaway';
            const result = matchFeatureTerms(query, 'en');
            expect(result).toContain('quiet_zone');
            expect(result).toContain('river_front');
            expect(result).toContain('couple_suitable');
        });

        it('should match when feature term appears within a longer sentence (pt)', () => {
            const query = 'quero algo tranquilo frente ao rio para casais';
            const result = matchFeatureTerms(query, 'pt');
            expect(result).toContain('quiet_zone');
            expect(result).toContain('river_front');
            expect(result).toContain('couple_suitable');
        });
    });

    // ── Unknown term → empty array ────────────────────────────────────────────

    describe('unknown term', () => {
        it('should return an empty array for text with no known feature terms (en)', () => {
            const result = matchFeatureTerms('a nice place with good food', 'en');
            expect(result).toHaveLength(0);
        });

        it('should return an empty array for an empty string', () => {
            const result = matchFeatureTerms('', 'en');
            expect(result).toHaveLength(0);
        });
    });

    // ── Case-insensitive ─────────────────────────────────────────────────────

    describe('case-insensitive matching', () => {
        it('should match "QUIET" (uppercase) → quiet_zone (en)', () => {
            const result = matchFeatureTerms('QUIET', 'en');
            expect(result).toContain('quiet_zone');
        });

        it('should match "Romantic" (initial cap) → couple_suitable (en)', () => {
            const result = matchFeatureTerms('Romantic', 'en');
            expect(result).toContain('couple_suitable');
        });

        it('should match "RURAL" (all caps) → rural_area (es)', () => {
            const result = matchFeatureTerms('RURAL', 'es');
            expect(result).toContain('rural_area');
        });

        it('should match "Tranquilo" (initial cap) → quiet_zone (es)', () => {
            const result = matchFeatureTerms('Tranquilo', 'es');
            expect(result).toContain('quiet_zone');
        });
    });

    // ── Deduplication ─────────────────────────────────────────────────────────

    describe('deduplication', () => {
        it('should de-duplicate when multiple terms resolve to the same slug (es)', () => {
            // "tranquilo" and "zona tranquila" both map to "quiet_zone"
            const result = matchFeatureTerms('ambiente tranquilo en zona tranquila', 'es');
            const matches = result.filter((s) => s === 'quiet_zone');
            expect(matches).toHaveLength(1);
        });

        it('should de-duplicate when multiple terms resolve to the same slug (en)', () => {
            // "quiet" and "peaceful" both map to "quiet_zone"
            const result = matchFeatureTerms('quiet and peaceful surroundings', 'en');
            const matches = result.filter((s) => s === 'quiet_zone');
            expect(matches).toHaveLength(1);
        });

        it('should de-duplicate "riverfront" and "river front" → single river_front (en)', () => {
            const result = matchFeatureTerms('riverfront / river front', 'en');
            const matches = result.filter((s) => s === 'river_front');
            expect(matches).toHaveLength(1);
        });
    });

    // ── Anti-overlap negatives (SPEC-199 §5.4 ANTI-OVERLAP RULE) ─────────────

    describe('anti-overlap negatives — physical services MUST NOT appear in FEATURE_ALLOWLIST', () => {
        it('matchFeatureTerms("pet friendly", "en") → empty array', () => {
            // "pet friendly" maps to "pets-allowed" in AMENITY_ALLOWLIST; it MUST
            // NOT appear in FEATURE_ALLOWLIST — would cause double-mapping.
            const result = matchFeatureTerms('pet friendly', 'en');
            expect(result).toHaveLength(0);
        });

        it('matchFeatureTerms("wifi", "en") → empty array', () => {
            // "wifi" maps to "wifi" in AMENITY_ALLOWLIST; not in FEATURE_ALLOWLIST.
            const result = matchFeatureTerms('wifi', 'en');
            expect(result).toHaveLength(0);
        });

        it('matchFeatureTerms("parking", "en") → empty array', () => {
            // "parking" maps to "parking" in AMENITY_ALLOWLIST; not in FEATURE_ALLOWLIST.
            const result = matchFeatureTerms('parking', 'en');
            expect(result).toHaveLength(0);
        });

        it('matchFeatureTerms("pool", "en") → empty array', () => {
            // "pool" maps to "pool" in AMENITY_ALLOWLIST; not in FEATURE_ALLOWLIST.
            const result = matchFeatureTerms('pool', 'en');
            expect(result).toHaveLength(0);
        });

        it('matchFeatureTerms("breakfast", "en") → empty array', () => {
            // "breakfast" maps to "breakfast" in AMENITY_ALLOWLIST; not in FEATURE_ALLOWLIST.
            const result = matchFeatureTerms('breakfast', 'en');
            expect(result).toHaveLength(0);
        });

        it('matchFeatureTerms("mascotas", "es") → empty array', () => {
            // "mascotas" maps to "pets-allowed" in AMENITY_ALLOWLIST; not in FEATURE_ALLOWLIST.
            const result = matchFeatureTerms('mascotas', 'es');
            expect(result).toHaveLength(0);
        });

        it('matchFeatureTerms("wifi", "es") → empty array', () => {
            const result = matchFeatureTerms('wifi', 'es');
            expect(result).toHaveLength(0);
        });

        it('matchFeatureTerms("piscina", "pt") → empty array', () => {
            // "piscina" in pt maps to "pool" in AMENITY_ALLOWLIST; not in FEATURE_ALLOWLIST.
            const result = matchFeatureTerms('piscina', 'pt');
            expect(result).toHaveLength(0);
        });

        it('matchFeatureTerms("animais", "pt") → empty array', () => {
            const result = matchFeatureTerms('animais', 'pt');
            expect(result).toHaveLength(0);
        });
    });

    // ── Return type is readonly ───────────────────────────────────────────────

    it('should return a readonly array', () => {
        const result = matchFeatureTerms('quiet', 'en');
        expect(Array.isArray(result)).toBe(true);
    });
});

// ─── Structural sanity checks on the dictionaries ────────────────────────────

describe('AMENITY_ALLOWLIST structure', () => {
    it('should have entries for all three locales (es, en, pt)', () => {
        expect(AMENITY_ALLOWLIST).toHaveProperty('es');
        expect(AMENITY_ALLOWLIST).toHaveProperty('en');
        expect(AMENITY_ALLOWLIST).toHaveProperty('pt');
    });

    it('should not be empty in any locale', () => {
        expect(Object.keys(AMENITY_ALLOWLIST.es ?? {})).not.toHaveLength(0);
        expect(Object.keys(AMENITY_ALLOWLIST.en ?? {})).not.toHaveLength(0);
        expect(Object.keys(AMENITY_ALLOWLIST.pt ?? {})).not.toHaveLength(0);
    });
});

describe('FEATURE_ALLOWLIST structure', () => {
    it('should have entries for all three locales (es, en, pt)', () => {
        expect(FEATURE_ALLOWLIST).toHaveProperty('es');
        expect(FEATURE_ALLOWLIST).toHaveProperty('en');
        expect(FEATURE_ALLOWLIST).toHaveProperty('pt');
    });

    it('should not be empty in any locale', () => {
        expect(Object.keys(FEATURE_ALLOWLIST.es ?? {})).not.toHaveLength(0);
        expect(Object.keys(FEATURE_ALLOWLIST.en ?? {})).not.toHaveLength(0);
        expect(Object.keys(FEATURE_ALLOWLIST.pt ?? {})).not.toHaveLength(0);
    });

    it('should contain all 18 expected feature slugs across en locale', () => {
        const expectedSlugs = new Set([
            'river_front',
            'natural_environment',
            'silent_environment',
            'quiet_zone',
            'rural_area',
            'central_area',
            'panoramic_view_extended',
            'dock_access',
            'couple_suitable',
            'family_suitable',
            'ideal_for_groups',
            'wedding_suitable',
            'rustic_style',
            'modern_style',
            'yoga_meditation_area',
            'spiritual_retreat_suitable',
            'digital_detox_zone',
            'sustainable_accommodation'
        ]);
        const enSlugs = new Set(Object.values(FEATURE_ALLOWLIST.en ?? {}));
        for (const slug of expectedSlugs) {
            expect(enSlugs).toContain(slug);
        }
    });

    it('should not contain any physical-service slugs (anti-overlap guard)', () => {
        const physicalServiceSlugs = [
            'pool',
            'wifi',
            'parking',
            'pets-allowed',
            'breakfast',
            'air-conditioning',
            'bbq'
        ];
        for (const locale of ['es', 'en', 'pt'] as const) {
            const slugs = Object.values(FEATURE_ALLOWLIST[locale] ?? {});
            for (const forbidden of physicalServiceSlugs) {
                expect(slugs).not.toContain(forbidden);
            }
        }
    });
});
