/** Source-based regression tests for the Astro homepage section. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SECTION = resolve(
    __dirname,
    '../../../src/components/sections/FeaturedAccommodationsSection.astro'
);

/** Argument text of a call, anchored on the call so comments cannot satisfy assertions. */
function callArgsOf(source: string, call: string): string {
    const start = source.indexOf(`${call}(`);
    expect(start, `${call}( not found`).toBeGreaterThan(-1);

    let depth = 0;
    for (let i = start + call.length; i < source.length; i++) {
        const char = source[i];
        if (char === '(') depth++;
        if (char === ')') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error(`unbalanced parentheses after ${call}(`);
}

describe('FeaturedAccommodationsSection source (HOS-1764)', () => {
    const source = readFileSync(SECTION, 'utf8');
    const listArgs = callArgsOf(source, 'accommodationsApi.list');

    it('does not overwrite item featured state or filter cards by featured state', () => {
        expect(source).not.toMatch(/\bisFeatured\s*:|\bisFeatured\s*=/);
        expect(source).not.toContain(['filterFeatured', 'Cards'].join(''));
        expect(listArgs).not.toMatch(/\bisFeatured\s*:\s*true/);
    });

    it('shows the empty state only when no cards were selected', () => {
        expect(source).toContain('items.length === 0');
        expect(source).not.toContain(['filterFeatured', 'Cards'].join(''));
    });

    it('keeps the public cache and best-rated request order without session data', () => {
        expect(source).toContain('cacheTtlMs: SSR_PUBLIC_CACHE_TTL_MS');
        expect(listArgs).toMatch(/pageSize:\s*(?:8|HOME_FEATURED_ACCOMMODATIONS_LIMIT)/);
        expect(listArgs).toContain("sortBy: 'averageRating'");
        expect(listArgs).toContain("sortOrder: 'desc'");
        expect(listArgs).not.toContain("sortBy: 'createdAt'");
        expect(source).not.toContain('Astro.locals.user');
        expect(source).not.toContain('cookie');
        expect(source).not.toContain('Astro.request.headers');
    });
});
