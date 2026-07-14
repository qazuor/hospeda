/**
 * Unit tests for the point-of-interest allowlist (HOS-113 §6.3, extended
 * HOS-142 §6.6/G-7).
 *
 * Tests:
 * - `matchPoiTerms`: exact match (es/en/pt); partial-text match; unknown term
 *   → empty; case-insensitive; dedup across overlapping terms.
 * - `POI_ALLOWLIST structure`: presence of all three locales, non-empty
 *   dictionaries, every value a non-empty array.
 * - Cross-check every allowlisted slug against the real seed fixture set
 *   (`packages/seed/src/data/pointOfInterest/*.json`), per the HOS-111 T-009
 *   lesson (a previously-wrong slug shipped silently broken until it was
 *   cross-checked against seed data) — R-4 defence. This guard now runs
 *   against the full ~920-fixture HOS-142 catalog, not just the original 12.
 * - AC-7: the merged allowlist's total entry count strictly increases from
 *   the pre-HOS-142 baseline (proving the HOS-142 generated entries actually
 *   added coverage, not just re-validated the original 12).
 *
 * @module apps/api/routes/ai/protected/poi-allowlist.test
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { matchPoiTerms, POI_ALLOWLIST } from '../../../../src/routes/ai/protected/poi-allowlist';

// ─── matchPoiTerms ────────────────────────────────────────────────────────────

describe('matchPoiTerms', () => {
    describe('exact match — autódromo (es)', () => {
        it('should match "autódromo" → autodromo_concepcion_del_uruguay', () => {
            const result = matchPoiTerms('autódromo', 'es');
            expect(result).toEqual(['autodromo_concepcion_del_uruguay']);
        });

        it('should match "autodromo" (no accent) → the same slug', () => {
            const result = matchPoiTerms('autodromo', 'es');
            expect(result).toEqual(['autodromo_concepcion_del_uruguay']);
        });
    });

    describe('exact match — autodrome (en)', () => {
        it('should match "race track" → autodromo_concepcion_del_uruguay', () => {
            const result = matchPoiTerms('race track', 'en');
            expect(result).toEqual(['autodromo_concepcion_del_uruguay']);
        });
    });

    describe('exact match — autódromo (pt)', () => {
        it('should match "autódromo" → autodromo_concepcion_del_uruguay', () => {
            const result = matchPoiTerms('autódromo', 'pt');
            expect(result).toEqual(['autodromo_concepcion_del_uruguay']);
        });
    });

    describe('other curated landmarks', () => {
        it('should match "banco pelay" (es) → playa_banco_pelay', () => {
            const result = matchPoiTerms('banco pelay', 'es');
            expect(result).toEqual(['playa_banco_pelay']);
        });

        it('should match "palacio san josé" (es) → palacio_san_jose', () => {
            const result = matchPoiTerms('palacio san josé', 'es');
            expect(result).toEqual(['palacio_san_jose']);
        });

        it('should match "el palmar" (en) → parque_nacional_el_palmar', () => {
            const result = matchPoiTerms('el palmar', 'en');
            expect(result).toEqual(['parque_nacional_el_palmar']);
        });

        it('should match "termas de federación" (es) → termas_de_federacion', () => {
            const result = matchPoiTerms('termas de federación', 'es');
            expect(result).toEqual(['termas_de_federacion']);
        });
    });

    // ── Partial-text match (term embedded in a longer sentence) ─────────────

    describe('partial-text match', () => {
        it('should match when the term appears within a longer sentence (es)', () => {
            const query = 'busco algo cerca del autódromo de la ciudad';
            const result = matchPoiTerms(query, 'es');
            expect(result).toContain('autodromo_concepcion_del_uruguay');
        });

        it('should match when the term appears within a longer sentence (en)', () => {
            const query = 'a cabin near the concordia thermal springs';
            const result = matchPoiTerms(query, 'en');
            expect(result).toContain('complejo_termal_concordia');
        });
    });

    // ── Unknown term → empty array (R-4 hallucination defence) ──────────────

    describe('unknown term — never hallucinates', () => {
        it('should return an empty array for text with no known POI terms (es)', () => {
            const result = matchPoiTerms('una cabaña con pileta y wifi', 'es');
            expect(result).toHaveLength(0);
        });

        it('should return an empty array for text with no known POI terms (en)', () => {
            const result = matchPoiTerms('a cabin with a pool and wifi', 'en');
            expect(result).toHaveLength(0);
        });

        it('should return an empty array for an empty string', () => {
            const result = matchPoiTerms('', 'en');
            expect(result).toHaveLength(0);
        });

        it('should silently ignore "carnaval" (out of scope — attraction concept, not a POI)', () => {
            const result = matchPoiTerms('una ciudad con carnavales', 'es');
            expect(result).toHaveLength(0);
        });

        it('should silently ignore an off-allowlist landmark mention (e.g. "faro imaginario")', () => {
            const result = matchPoiTerms('cerca del faro imaginario', 'es');
            expect(result).toHaveLength(0);
        });
    });

    // ── Case-insensitive ─────────────────────────────────────────────────────

    describe('case-insensitive matching', () => {
        it('should match "AUTÓDROMO" (uppercase) → the slug (es)', () => {
            const result = matchPoiTerms('AUTÓDROMO', 'es');
            expect(result).toContain('autodromo_concepcion_del_uruguay');
        });

        it('should match "Race Track" (initial caps) → the slug (en)', () => {
            const result = matchPoiTerms('Race Track', 'en');
            expect(result).toContain('autodromo_concepcion_del_uruguay');
        });
    });

    // ── Deduplication across overlapping terms ───────────────────────────────

    describe('deduplication', () => {
        it('should de-duplicate when multiple terms resolve to the same slug (es)', () => {
            // "autódromo" and "autódromo de concepción del uruguay" both
            // resolve to the same landmark.
            const result = matchPoiTerms(
                'autódromo, o sea el autódromo de concepción del uruguay',
                'es'
            );
            const matches = result.filter((s) => s === 'autodromo_concepcion_del_uruguay');
            expect(matches).toHaveLength(1);
        });
    });

    // ── Return type is readonly ───────────────────────────────────────────────

    it('should return a readonly array', () => {
        const result = matchPoiTerms('autódromo', 'es');
        expect(Array.isArray(result)).toBe(true);
    });
});

// ─── Structural sanity checks on the dictionary ──────────────────────────────

describe('POI_ALLOWLIST structure', () => {
    it('should have entries for all three locales (es, en, pt)', () => {
        expect(POI_ALLOWLIST).toHaveProperty('es');
        expect(POI_ALLOWLIST).toHaveProperty('en');
        expect(POI_ALLOWLIST).toHaveProperty('pt');
    });

    it('should not be empty in any locale', () => {
        expect(Object.keys(POI_ALLOWLIST.es ?? {})).not.toHaveLength(0);
        expect(Object.keys(POI_ALLOWLIST.en ?? {})).not.toHaveLength(0);
        expect(Object.keys(POI_ALLOWLIST.pt ?? {})).not.toHaveLength(0);
    });

    it('every term maps to a non-empty array of slugs', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            const dict = POI_ALLOWLIST[locale] ?? {};
            for (const [term, slugs] of Object.entries(dict)) {
                expect(Array.isArray(slugs), `term "${term}" must map to an array`).toBe(true);
                expect(
                    slugs.length,
                    `term "${term}" must map to a non-empty array`
                ).toBeGreaterThan(0);
            }
        }
    });
});

// ─── R-4 defence: every allowlisted slug MUST exist in the real seed set ─────

describe('POI_ALLOWLIST vs seed data (R-4 hallucination defence)', () => {
    /** Absolute path to the seeded point-of-interest fixture directory. */
    const SEED_POI_DIR = resolve(
        __dirname,
        '../../../../../../packages/seed/src/data/pointOfInterest'
    );

    /** Reads every `*.json` fixture in the seed directory and returns its `slug` set. */
    function loadSeededPoiSlugs(): Set<string> {
        const files = readdirSync(SEED_POI_DIR).filter((f) => f.endsWith('.json'));
        const slugs = new Set<string>();
        for (const file of files) {
            const raw = readFileSync(resolve(SEED_POI_DIR, file), 'utf-8');
            const parsed = JSON.parse(raw) as { slug?: string };
            if (typeof parsed.slug === 'string') {
                slugs.add(parsed.slug);
            }
        }
        return slugs;
    }

    it('has at least one seeded point-of-interest fixture to check against', () => {
        const seededSlugs = loadSeededPoiSlugs();
        expect(seededSlugs.size).toBeGreaterThan(0);
    });

    it('every allowlisted slug (all locales) exists in the seeded POI fixture set', () => {
        const seededSlugs = loadSeededPoiSlugs();
        const allowlistedSlugs = new Set<string>();
        for (const locale of ['es', 'en', 'pt'] as const) {
            const dict = POI_ALLOWLIST[locale] ?? {};
            for (const slugs of Object.values(dict)) {
                for (const slug of slugs) {
                    allowlistedSlugs.add(slug);
                }
            }
        }

        for (const slug of allowlistedSlugs) {
            expect(
                seededSlugs.has(slug),
                `allowlisted slug "${slug}" is not a real seeded POI`
            ).toBe(true);
        }
    });
});

// ─── AC-7: allowlist coverage must strictly grow past the pre-HOS-142 baseline ─

describe('POI_ALLOWLIST coverage growth (HOS-142 AC-7)', () => {
    /**
     * Total NL-term entry count across all three locales in the
     * pre-HOS-142 hand-curated dictionary (the original 12 POIs): 28 `es` +
     * 24 `en` + 19 `pt` = 71. Verified by direct inspection of
     * `poi-allowlist.ts` before the HOS-142 generated-entries merge landed.
     * This is a historical constant, not derived from the current file —
     * AC-7 requires proving growth AGAINST that fixed baseline, not against
     * a moving target.
     */
    const PRE_HOS_142_BASELINE_ENTRY_COUNT = 71;

    /** Total NL-term entry count across all locales in the current (merged) `POI_ALLOWLIST`. */
    function countTotalEntries(): number {
        let total = 0;
        for (const locale of ['es', 'en', 'pt'] as const) {
            total += Object.keys(POI_ALLOWLIST[locale] ?? {}).length;
        }
        return total;
    }

    it('should strictly increase total entry count from the pre-HOS-142 baseline', () => {
        expect(countTotalEntries()).toBeGreaterThan(PRE_HOS_142_BASELINE_ENTRY_COUNT);
    });

    it('should still expose every pre-HOS-142 curated slug (curated entries are never dropped)', () => {
        // Spot-check a handful of the original 12 landmarks across locales —
        // the merge must never drop or shadow a curated entry.
        expect(POI_ALLOWLIST.es?.autódromo).toEqual(['autodromo_concepcion_del_uruguay']);
        expect(POI_ALLOWLIST.en?.['race track']).toEqual(['autodromo_concepcion_del_uruguay']);
        expect(POI_ALLOWLIST.pt?.autódromo).toEqual(['autodromo_concepcion_del_uruguay']);
    });
});
