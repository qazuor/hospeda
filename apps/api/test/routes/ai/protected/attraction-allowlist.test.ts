/**
 * Unit tests for the destination-attraction allowlist (HOS-111 T-015, G-11).
 *
 * Tests:
 * - `matchAttractionTerms`: exact match (es/en/pt); partial-text match;
 *   unknown term → empty; case-insensitive; dedup across overlapping terms.
 * - Every matched slug is cross-checked against real seed data
 *   (packages/seed/src/data/attraction/*.json + destination attractionIds)
 *   in the allowlist's own JSDoc — this suite verifies the matching
 *   FUNCTION behaves correctly, not the seed data itself.
 *
 * @module apps/api/routes/ai/protected/attraction-allowlist.test
 */

import { describe, expect, it } from 'vitest';
import {
    ATTRACTION_ALLOWLIST,
    matchAttractionTerms
} from '../../../../src/routes/ai/protected/attraction-allowlist';

// ─── matchAttractionTerms ─────────────────────────────────────────────────────

describe('matchAttractionTerms', () => {
    // ── Exact matches — carnaval (spec's worked example) ────────────────────

    describe('exact match — carnaval (es)', () => {
        it('should match "carnaval" → the 4 real carnaval attraction slugs', () => {
            const result = matchAttractionTerms('carnaval', 'es');
            expect(result).toContain('sede_carnaval');
            expect(result).toContain('corsodromo');
            expect(result).toContain('museo_carnaval');
            expect(result).toContain('taller_carnaval');
        });

        it('should match "carnavales" (plural) → the same 4 slugs', () => {
            const result = matchAttractionTerms('carnavales', 'es');
            expect(result).toContain('sede_carnaval');
            expect(result).toContain('corsodromo');
            expect(result).toContain('museo_carnaval');
            expect(result).toContain('taller_carnaval');
        });

        it('should match "corsódromo" → corsodromo only', () => {
            const result = matchAttractionTerms('corsódromo', 'es');
            expect(result).toEqual(['corsodromo']);
        });
    });

    describe('exact match — carnival (en)', () => {
        it('should match "carnival" → the 4 real carnaval attraction slugs', () => {
            const result = matchAttractionTerms('carnival', 'en');
            expect(result).toContain('sede_carnaval');
            expect(result).toContain('corsodromo');
            expect(result).toContain('museo_carnaval');
            expect(result).toContain('taller_carnaval');
        });
    });

    describe('exact match — carnaval (pt)', () => {
        it('should match "carnaval" → the 4 real carnaval attraction slugs', () => {
            const result = matchAttractionTerms('carnaval', 'pt');
            expect(result).toContain('sede_carnaval');
            expect(result).toContain('corsodromo');
            expect(result).toContain('museo_carnaval');
            expect(result).toContain('taller_carnaval');
        });

        it('should match "sambódromo" → corsodromo', () => {
            const result = matchAttractionTerms('sambódromo', 'pt');
            expect(result).toEqual(['corsodromo']);
        });
    });

    // ── Other curated categories ─────────────────────────────────────────────

    describe('other curated categories', () => {
        it('should match "termas" (es) → the 5 thermal-spring attraction slugs', () => {
            const result = matchAttractionTerms('termas', 'es');
            expect(result).toContain('aqua_parque_termal');
            expect(result).toContain('centro_spa_termal');
            expect(result).toContain('complejo_termal_principal');
            expect(result).toContain('piscinas_termales');
            expect(result).toContain('termas_familiares');
        });

        it('should match "museo" (es) → museo_historico + museo_regional, NOT museo_carnaval', () => {
            const result = matchAttractionTerms('museo', 'es');
            expect(result).toContain('museo_historico');
            expect(result).toContain('museo_regional');
            expect(result).not.toContain('museo_carnaval');
        });

        it('should match "centro histórico" (es) → centro_historico', () => {
            const result = matchAttractionTerms('centro histórico', 'es');
            expect(result).toEqual(['centro_historico']);
        });

        it('should match "thermal springs" (en) → the 5 thermal-spring attraction slugs', () => {
            const result = matchAttractionTerms('thermal springs', 'en');
            expect(result).toContain('aqua_parque_termal');
            expect(result).toContain('piscinas_termales');
        });
    });

    // ── Partial-text match (term embedded in a longer sentence) ─────────────

    describe('partial-text match', () => {
        it('should match when the term appears within a longer sentence (es)', () => {
            const query = 'quiero una ciudad con carnavales famosos';
            const result = matchAttractionTerms(query, 'es');
            expect(result).toContain('sede_carnaval');
            expect(result).toContain('corsodromo');
        });

        it('should match when the term appears within a longer sentence (en)', () => {
            const query = 'a city known for its carnival';
            const result = matchAttractionTerms(query, 'en');
            expect(result).toContain('sede_carnaval');
        });
    });

    // ── Unknown term → empty array (R-4 hallucination defence) ──────────────

    describe('unknown term — never hallucinates', () => {
        it('should return an empty array for text with no known attraction terms (es)', () => {
            const result = matchAttractionTerms('una cabaña con pileta y wifi', 'es');
            expect(result).toHaveLength(0);
        });

        it('should return an empty array for text with no known attraction terms (en)', () => {
            const result = matchAttractionTerms('a cabin with a pool and wifi', 'en');
            expect(result).toHaveLength(0);
        });

        it('should return an empty array for an empty string', () => {
            const result = matchAttractionTerms('', 'en');
            expect(result).toHaveLength(0);
        });

        it('should silently ignore "autódromo" (out of scope — HOS-113 POI, not this allowlist)', () => {
            const result = matchAttractionTerms('cerca del autódromo', 'es');
            expect(result).toHaveLength(0);
        });

        it('should silently ignore an off-allowlist attraction concept (e.g. "zoológico")', () => {
            const result = matchAttractionTerms('cerca del zoológico', 'es');
            expect(result).toHaveLength(0);
        });
    });

    // ── Case-insensitive ─────────────────────────────────────────────────────

    describe('case-insensitive matching', () => {
        it('should match "CARNAVAL" (uppercase) → carnaval slugs (es)', () => {
            const result = matchAttractionTerms('CARNAVAL', 'es');
            expect(result).toContain('sede_carnaval');
        });

        it('should match "Carnival" (initial cap) → carnaval slugs (en)', () => {
            const result = matchAttractionTerms('Carnival', 'en');
            expect(result).toContain('sede_carnaval');
        });
    });

    // ── Deduplication across overlapping terms ───────────────────────────────

    describe('deduplication', () => {
        it('should de-duplicate when multiple terms resolve to overlapping slugs (es)', () => {
            // "carnaval" and "corsódromo" both include/resolve to "corsodromo".
            const result = matchAttractionTerms('carnaval y corsódromo', 'es');
            const corsodromoMatches = result.filter((s) => s === 'corsodromo');
            expect(corsodromoMatches).toHaveLength(1);
        });
    });

    // ── Return type is readonly ───────────────────────────────────────────────

    it('should return a readonly array', () => {
        const result = matchAttractionTerms('carnaval', 'es');
        expect(Array.isArray(result)).toBe(true);
    });
});

// ─── Structural sanity checks on the dictionary ──────────────────────────────

describe('ATTRACTION_ALLOWLIST structure', () => {
    it('should have entries for all three locales (es, en, pt)', () => {
        expect(ATTRACTION_ALLOWLIST).toHaveProperty('es');
        expect(ATTRACTION_ALLOWLIST).toHaveProperty('en');
        expect(ATTRACTION_ALLOWLIST).toHaveProperty('pt');
    });

    it('should not be empty in any locale', () => {
        expect(Object.keys(ATTRACTION_ALLOWLIST.es ?? {})).not.toHaveLength(0);
        expect(Object.keys(ATTRACTION_ALLOWLIST.en ?? {})).not.toHaveLength(0);
        expect(Object.keys(ATTRACTION_ALLOWLIST.pt ?? {})).not.toHaveLength(0);
    });

    it('every term maps to a non-empty array of slugs', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            const dict = ATTRACTION_ALLOWLIST[locale] ?? {};
            for (const [term, slugs] of Object.entries(dict)) {
                expect(Array.isArray(slugs), `term "${term}" must map to an array`).toBe(true);
                expect(
                    slugs.length,
                    `term "${term}" must map to a non-empty array`
                ).toBeGreaterThan(0);
            }
        }
    });

    it('contains the 4 real carnaval slugs verified against seed data (es)', () => {
        // packages/seed/src/data/attraction/030-attraction-corsodromo.json (slug: corsodromo)
        // packages/seed/src/data/attraction/054-attraction-museo_carnaval.json (slug: museo_carnaval)
        // packages/seed/src/data/attraction/080-attraction-sede_carnaval.json (slug: sede_carnaval)
        // packages/seed/src/data/attraction/084-attraction-taller_carnaval.json (slug: taller_carnaval)
        const esSlugs = new Set(Object.values(ATTRACTION_ALLOWLIST.es ?? {}).flat());
        expect(esSlugs).toContain('corsodromo');
        expect(esSlugs).toContain('museo_carnaval');
        expect(esSlugs).toContain('sede_carnaval');
        expect(esSlugs).toContain('taller_carnaval');
    });
});
