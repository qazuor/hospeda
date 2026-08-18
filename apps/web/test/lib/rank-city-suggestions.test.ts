/**
 * @file rank-city-suggestions.test.ts
 * @description Guards the city autocomplete ranking (H-136, smoke agosto 2026).
 *
 * This ranking only became load-bearing once the search stopped caring about
 * accents. Before that, an unaccented query returned nothing at all, so the
 * order of the results was moot. Now `colon` returns `Colón` — and if the
 * ranking still compared raw strings, that hit would count as neither exact
 * nor prefix and could sort below an unrelated substring match. The right
 * city would arrive and still look wrong.
 */

import { describe, expect, it } from 'vitest';
import { foldForRanking, rankCitySuggestions } from '@/lib/rank-city-suggestions';

/** The live catalog's accented cities, verified against production 2026-08-15. */
const COLON = { id: 'col', label: 'Colón' };
const CONCEPCION = { id: 'cdu', label: 'Concepción del Uruguay' };
const GUALEGUAYCHU = { id: 'gchu', label: 'Gualeguaychú' };
const CHAJARI = { id: 'cha', label: 'Chajarí' };
const FEDERACION = { id: 'fed', label: 'Federación' };
const SAN_JOSE = { id: 'sjo', label: 'San José' };

const labels = (items: readonly { label: string }[]) => items.map((item) => item.label);

describe('foldForRanking', () => {
    it.each([
        ['Colón', 'colon'],
        ['Concepción del Uruguay', 'concepcion del uruguay'],
        ['Gualeguaychú', 'gualeguaychu'],
        ['Chajarí', 'chajari'],
        ['Federación', 'federacion'],
        ['San José', 'san jose']
    ])('should fold %s to %s', (input, expected) => {
        expect(foldForRanking(input)).toBe(expected);
    });

    it('should trim surrounding whitespace', () => {
        expect(foldForRanking('  Colón  ')).toBe('colon');
    });

    it('should leave an already-plain name untouched', () => {
        expect(foldForRanking('Concordia')).toBe('concordia');
    });

    it('should fold ñ to n, matching what PostgreSQL unaccent() does', () => {
        // Verified against production: `unaccent('Cañada')` returns 'Canada'.
        // The instinct is to protect the ñ — it is a letter in Spanish, not an
        // accented n — but this ranking's only job is to agree with the server
        // that produced the results. If it folded less than `unaccent()` does,
        // a row the search legitimately returned would score as a non-match and
        // sort last, which is the exact bug this helper exists to prevent.
        expect(foldForRanking('Cañada')).toBe('canada');
    });
});

describe('rankCitySuggestions — accent-blind ordering (H-136)', () => {
    it('should rank the exact city first when typed WITHOUT its accent', () => {
        // Arrange — Colón must beat the longer substring match.
        const items = [CONCEPCION, COLON];

        // Act
        const ranked = rankCitySuggestions({ query: 'colon', items });

        // Assert
        expect(labels(ranked)[0]).toBe('Colón');
    });

    it('should rank the exact city first when typed WITH its accent', () => {
        // Arrange
        const items = [CONCEPCION, COLON];

        // Act
        const ranked = rankCitySuggestions({ query: 'Colón', items });

        // Assert
        expect(labels(ranked)[0]).toBe('Colón');
    });

    it.each([
        ['concepcion', 'Concepción del Uruguay'],
        ['gualeguaychu', 'Gualeguaychú'],
        ['chajari', 'Chajarí'],
        ['federacion', 'Federación'],
        ['san jose', 'San José']
    ])('should rank %s first from an unaccented prefix', (query, expected) => {
        // Arrange
        const items = [COLON, CONCEPCION, GUALEGUAYCHU, CHAJARI, FEDERACION, SAN_JOSE];

        // Act
        const ranked = rankCitySuggestions({ query, items });

        // Assert
        expect(labels(ranked)[0]).toBe(expected);
    });

    it('should prefer a prefix match over a mid-string match', () => {
        // Arrange — both contain "uruguay"; only one starts with it.
        const items = [CONCEPCION, { id: 'uru', label: 'Uruguay Chico' }];

        // Act
        const ranked = rankCitySuggestions({ query: 'uruguay', items });

        // Assert
        expect(labels(ranked)[0]).toBe('Uruguay Chico');
    });

    it('should fall back to alphabetical order when nothing matches better', () => {
        // Arrange
        const items = [GUALEGUAYCHU, CHAJARI, COLON];

        // Act
        const ranked = rankCitySuggestions({ query: 'zzz', items });

        // Assert
        expect(labels(ranked)).toStrictEqual(['Chajarí', 'Colón', 'Gualeguaychú']);
    });

    it('should not mutate the caller array', () => {
        // Arrange
        const items = [CONCEPCION, COLON];
        const before = labels(items);

        // Act
        rankCitySuggestions({ query: 'colon', items });

        // Assert
        expect(labels(items)).toStrictEqual(before);
    });

    it('should return an empty list unchanged', () => {
        expect(rankCitySuggestions({ query: 'colon', items: [] })).toStrictEqual([]);
    });
});
