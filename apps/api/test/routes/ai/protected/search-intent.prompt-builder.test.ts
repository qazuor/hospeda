/**
 * Unit tests for `buildSearchIntentPrompt` (SPEC-199 T-009, §5.5).
 *
 * Covers:
 * - Returned string contains the correct amenity slugs for each locale (es/en/pt).
 * - Returned string contains the correct feature slugs for each locale (es/en/pt).
 * - User query is embedded verbatim (including special characters such as quotes).
 * - De-duplication: many NL terms map to the same slug → unique slugs only.
 * - Locale fallback: an unknown locale string falls back to 'es' dictionaries.
 * - No `messages` array is involved — the helper returns a plain string.
 *
 * @module apps/api/routes/ai/protected/search-intent.prompt-builder.test
 */

import { describe, expect, it } from 'vitest';
import {
    AMENITY_ALLOWLIST,
    FEATURE_ALLOWLIST
} from '../../../../src/routes/ai/protected/amenity-allowlist';
import { buildSearchIntentPrompt } from '../../../../src/routes/ai/protected/search-intent';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute the expected unique slug list for a given locale dictionary.
 * Mirrors the de-duplication logic inside `buildSearchIntentPrompt`.
 */
function uniqueSlugs(dict: Readonly<Record<string, string>>): string[] {
    return [...new Set(Object.values(dict))];
}

// ─── Amenity slug line — per locale ──────────────────────────────────────────

describe('buildSearchIntentPrompt — amenity slugs', () => {
    it('includes all unique amenity slugs for locale "es"', () => {
        // Arrange
        const esDict = AMENITY_ALLOWLIST.es as Readonly<Record<string, string>>;
        const expected = uniqueSlugs(esDict);

        // Act
        const result = buildSearchIntentPrompt({ query: 'test', locale: 'es' });

        // Assert — every slug appears in the amenity slug line
        for (const slug of expected) {
            expect(result).toContain(slug);
        }
    });

    it('includes all unique amenity slugs for locale "en"', () => {
        // Arrange
        const enDict = AMENITY_ALLOWLIST.en as Readonly<Record<string, string>>;
        const expected = uniqueSlugs(enDict);

        // Act
        const result = buildSearchIntentPrompt({ query: 'test', locale: 'en' });

        // Assert
        for (const slug of expected) {
            expect(result).toContain(slug);
        }
    });

    it('includes all unique amenity slugs for locale "pt"', () => {
        // Arrange
        const ptDict = AMENITY_ALLOWLIST.pt as Readonly<Record<string, string>>;
        const expected = uniqueSlugs(ptDict);

        // Act
        const result = buildSearchIntentPrompt({ query: 'test', locale: 'pt' });

        // Assert
        for (const slug of expected) {
            expect(result).toContain(slug);
        }
    });

    it('amenity slug line appears before the query line', () => {
        // Arrange
        const query = 'cabaña con pileta';

        // Act
        const result = buildSearchIntentPrompt({ query, locale: 'es' });
        const lines = result.split('\n');

        // Assert — amenity line is line 0 (before user query which contains the query text)
        const amenityLineIndex = lines.findIndex((l) =>
            l.startsWith('Allowed amenity slugs for this request')
        );
        const queryLineIndex = lines.findIndex((l) => l.includes(query));
        expect(amenityLineIndex).toBeLessThan(queryLineIndex);
    });

    it('amenity slug line does NOT contain raw NL term variants — only slugs', () => {
        // Arrange — "pileta" is a term variant, "pool" is its slug
        const result = buildSearchIntentPrompt({ query: 'test', locale: 'es' });
        const lines = result.split('\n');
        const amenityLine = lines.find((l) =>
            l.startsWith('Allowed amenity slugs for this request')
        );

        // Assert
        expect(amenityLine).toBeDefined();
        // Slug values appear
        expect(amenityLine).toContain('pool');
        // NL variants should NOT appear on the slug line
        // (they appear only in the amenity-allowlist, not in the prompt's slug enumeration)
        expect(amenityLine).not.toContain('pileta');
        expect(amenityLine).not.toContain('natación');
    });

    it('de-duplicates amenity slugs — multiple terms mapping to the same slug produce only one occurrence', () => {
        // Arrange — es dict has "parrilla", "asador", "barbacoa", "bbq" all → 'bbq'
        const result = buildSearchIntentPrompt({ query: 'test', locale: 'es' });
        const lines = result.split('\n');
        const amenityLine =
            lines.find((l) => l.startsWith('Allowed amenity slugs for this request')) ?? '';

        // Assert — 'bbq' appears exactly once in the amenity slug line
        const occurrences = amenityLine.split('bbq').length - 1;
        expect(occurrences).toBe(1);
    });
});

// ─── Feature slug line — per locale ──────────────────────────────────────────

describe('buildSearchIntentPrompt — feature slugs', () => {
    it('includes all unique feature slugs for locale "es"', () => {
        // Arrange
        const esDict = FEATURE_ALLOWLIST.es as Readonly<Record<string, string>>;
        const expected = uniqueSlugs(esDict);

        // Act
        const result = buildSearchIntentPrompt({ query: 'test', locale: 'es' });

        // Assert
        for (const slug of expected) {
            expect(result).toContain(slug);
        }
    });

    it('includes all unique feature slugs for locale "en"', () => {
        // Arrange
        const enDict = FEATURE_ALLOWLIST.en as Readonly<Record<string, string>>;
        const expected = uniqueSlugs(enDict);

        // Act
        const result = buildSearchIntentPrompt({ query: 'test', locale: 'en' });

        // Assert
        for (const slug of expected) {
            expect(result).toContain(slug);
        }
    });

    it('includes all unique feature slugs for locale "pt"', () => {
        // Arrange
        const ptDict = FEATURE_ALLOWLIST.pt as Readonly<Record<string, string>>;
        const expected = uniqueSlugs(ptDict);

        // Act
        const result = buildSearchIntentPrompt({ query: 'test', locale: 'pt' });

        // Assert
        for (const slug of expected) {
            expect(result).toContain(slug);
        }
    });

    it('feature slug line appears after the amenity line and before the query line', () => {
        // Arrange
        const query = 'algo tranquilo frente al río';

        // Act
        const result = buildSearchIntentPrompt({ query, locale: 'es' });
        const lines = result.split('\n');

        const amenityIdx = lines.findIndex((l) =>
            l.startsWith('Allowed amenity slugs for this request')
        );
        const featureIdx = lines.findIndex((l) =>
            l.startsWith('Allowed feature slugs for this request')
        );
        const queryIdx = lines.findIndex((l) => l.includes(query));

        // Assert
        expect(amenityIdx).toBeLessThan(featureIdx);
        expect(featureIdx).toBeLessThan(queryIdx);
    });

    it('de-duplicates feature slugs — multiple terms mapping to the same slug produce only one occurrence', () => {
        // Arrange — 'es' dict has 'frente al río', 'cerca del río', 'sobre el río' → 'river_front'
        const result = buildSearchIntentPrompt({ query: 'test', locale: 'es' });
        const lines = result.split('\n');
        const featureLine =
            lines.find((l) => l.startsWith('Allowed feature slugs for this request')) ?? '';

        // Assert — 'river_front' appears exactly once in the feature slug line
        const occurrences = featureLine.split('river_front').length - 1;
        expect(occurrences).toBe(1);
    });

    it('feature slug count matches 18 unique slugs', () => {
        // Arrange — all three locales resolve to the same 18 unique feature slugs
        const result = buildSearchIntentPrompt({ query: 'test', locale: 'es' });
        const lines = result.split('\n');
        const featureLine =
            lines.find((l) => l.startsWith('Allowed feature slugs for this request')) ?? '';

        // Extract the slug list from the line (after the colon)
        const colonIdx = featureLine.indexOf(': ');
        const slugList = featureLine.slice(colonIdx + 2).split(', ');

        // Assert
        expect(slugList).toHaveLength(18);
    });
});

// ─── User query embedding ─────────────────────────────────────────────────────

describe('buildSearchIntentPrompt — query embedding', () => {
    it('embeds a simple query verbatim', () => {
        // Arrange
        const query = 'cabaña cerca del río para 4 personas';

        // Act
        const result = buildSearchIntentPrompt({ query, locale: 'es' });

        // Assert
        expect(result).toContain(query);
    });

    it('embeds query with double-quote characters verbatim', () => {
        // Arrange — query contains literal double quotes
        const query = 'cabin "near the river" for 4';

        // Act
        const result = buildSearchIntentPrompt({ query, locale: 'en' });

        // Assert — the raw query (with its own quotes) is present inside the triple-quote wrapper
        expect(result).toContain(query);
    });

    it('embeds query with single-quote characters verbatim', () => {
        // Arrange
        const query = "cabaña c'est la vie";

        // Act
        const result = buildSearchIntentPrompt({ query, locale: 'es' });

        // Assert
        expect(result).toContain(query);
    });

    it('wraps the query in triple double-quotes', () => {
        // Arrange
        const query = 'pool with view';

        // Act
        const result = buildSearchIntentPrompt({ query, locale: 'en' });

        // Assert — the result contains the triple-quoted form
        expect(result).toContain(`"""${query}"""`);
    });

    it('query line uses the "User query:" prefix', () => {
        // Arrange
        const query = 'apartamento en el centro';

        // Act
        const result = buildSearchIntentPrompt({ query, locale: 'es' });

        // Assert
        expect(result).toContain(`User query: """${query}"""`);
    });

    it('embeds a query with special characters (backslash, newline-in-string, percent)', () => {
        // Arrange — edge-case characters that must pass through unchanged
        const query = 'query with 100% satisfaction & a\\b slash';

        // Act
        const result = buildSearchIntentPrompt({ query, locale: 'en' });

        // Assert
        expect(result).toContain(query);
    });
});

// ─── Locale fallback ──────────────────────────────────────────────────────────

describe('buildSearchIntentPrompt — locale fallback', () => {
    it('falls back to "es" dictionary for an unrecognised locale', () => {
        // Arrange — cast an unknown locale through the type to simulate a runtime mismatch
        const unknownLocale = 'fr' as 'es' | 'en' | 'pt';

        const esAmenityDict = AMENITY_ALLOWLIST.es as Readonly<Record<string, string>>;
        const esFeatureDict = FEATURE_ALLOWLIST.es as Readonly<Record<string, string>>;
        const expectedAmenitySlugs = uniqueSlugs(esAmenityDict);
        const expectedFeatureSlugs = uniqueSlugs(esFeatureDict);

        // Act
        const result = buildSearchIntentPrompt({ query: 'test', locale: unknownLocale });

        // Assert — 'es' slugs appear in the result
        for (const slug of expectedAmenitySlugs) {
            expect(result).toContain(slug);
        }
        for (const slug of expectedFeatureSlugs) {
            expect(result).toContain(slug);
        }
    });

    it('fallback result is identical to explicit "es" call', () => {
        // Arrange
        const unknownLocale = 'zh' as 'es' | 'en' | 'pt';
        const query = 'some query';

        // Act
        const fallbackResult = buildSearchIntentPrompt({ query, locale: unknownLocale });
        const explicitEsResult = buildSearchIntentPrompt({ query, locale: 'es' });

        // Assert
        expect(fallbackResult).toBe(explicitEsResult);
    });
});

// ─── Return type — plain string, no messages array ───────────────────────────

describe('buildSearchIntentPrompt — return type', () => {
    it('returns a string (not an object or array)', () => {
        // Arrange / Act
        const result = buildSearchIntentPrompt({ query: 'test', locale: 'en' });

        // Assert
        expect(typeof result).toBe('string');
    });

    it('returned string is non-empty', () => {
        // Arrange / Act
        const result = buildSearchIntentPrompt({ query: 'test', locale: 'es' });

        // Assert
        expect(result.length).toBeGreaterThan(0);
    });

    it('result has exactly 4 lines (amenity, feature, blank, query)', () => {
        // Arrange
        const query = 'single line query';

        // Act
        const result = buildSearchIntentPrompt({ query, locale: 'en' });
        const lines = result.split('\n');

        // Assert — 4 lines: amenity slugs, feature slugs, blank, user query
        expect(lines).toHaveLength(4);
        expect(lines[2]).toBe('');
    });
});
