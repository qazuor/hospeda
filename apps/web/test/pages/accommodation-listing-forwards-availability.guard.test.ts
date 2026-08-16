/**
 * Guard for H-120 — every accommodation listing surface must forward the
 * availability range to the API.
 *
 * ## Why a source guard and not a render test
 *
 * The three surfaces are `.astro` pages, which cannot be rendered under Vitest.
 * The defect being guarded is a pure omission: the page had the dates, showed
 * them in the sidebar, and simply never put them in the request. Nothing about
 * the rendered output distinguishes that from a correctly-wired page whose
 * dates happen to match everything — which is exactly why it survived so long.
 *
 * ## What this guard actually proves, and what it does not
 *
 * It extracts the `accommodationsApi.list({ … })` call by brace-matching and
 * asserts the spread appears INSIDE that call. It deliberately does not grep
 * the whole file: `availabilityParams` is also declared and (on the map) used
 * in a second object, so a file-wide search would stay green if the spread were
 * deleted from the request itself — the precise regression this exists to
 * catch.
 *
 * It cannot prove the request is well-formed at runtime; that is
 * `availability-params.test.ts`'s job, and the staging smoke's. It proves only
 * that the wire is still attached, which is the thing that was missing.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The spread, anchored on a word boundary.
 *
 * A bare `toContain('...availabilityParams')` also matches
 * `...availabilityParamsX` — deleting the spread and renaming it are different
 * mutations, and the unanchored form only catches the first. Verified: the
 * rename survived the unanchored check.
 */
const SPREAD = /\.\.\.availabilityParams\b/;

const PAGES_ROOT = join(import.meta.dirname, '../../src/pages/[lang]/alojamientos');

/**
 * Every listing surface that reads `checkIn`/`checkOut` from the URL and must
 * therefore also send them to the API.
 */
const LISTING_PAGES = [
    { label: 'base listing', path: join(PAGES_ROOT, 'index.astro') },
    { label: 'map view', path: join(PAGES_ROOT, 'mapa.astro') },
    { label: 'type landing', path: join(PAGES_ROOT, 'tipo/[type]/index.astro') }
] as const;

/**
 * Returns the source of the first `accommodationsApi.list(` call in `source`,
 * from the opening parenthesis to its match.
 *
 * Brace/paren matching rather than a regex, because the call spans dozens of
 * lines and contains nested object and call literals.
 */
function extractListCall(source: string): string {
    const marker = 'accommodationsApi.list(';
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error('no accommodationsApi.list( call found');
    }

    let depth = 0;
    for (let i = start + marker.length - 1; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === '(') {
            depth += 1;
        } else if (ch === ')') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(start, i + 1);
            }
        }
    }
    throw new Error('unbalanced parentheses in accommodationsApi.list( call');
}

describe('H-120 guard — listing surfaces forward the availability range', () => {
    for (const page of LISTING_PAGES) {
        describe(page.label, () => {
            const source = readFileSync(page.path, 'utf8');

            it('reads checkIn and checkOut from the URL', () => {
                expect(source).toContain("url.searchParams.get('checkIn')");
                expect(source).toContain("url.searchParams.get('checkOut')");
            });

            it('builds the pair through the shared both-or-neither helper', () => {
                // Hand-rolling the rule per page is how one of the three ends up
                // sending a lone date that the server silently drops.
                expect(source).toContain('buildAvailabilityParams(');
            });

            it('spreads the range INSIDE the accommodationsApi.list call', () => {
                const call = extractListCall(source);
                expect(call).toMatch(SPREAD);
            });
        });
    }

    it('the map also forwards the range on every viewport refetch', () => {
        // BETA-166 established that filters missing from `mapExtraSearchParams`
        // are silently reinstated a few hundred ms after load, when the first
        // `moveend` refetches with the bbox only. A filter that survives SSR and
        // dies on the first pan is worse than one that never worked.
        const source = readFileSync(join(PAGES_ROOT, 'mapa.astro'), 'utf8');
        const start = source.indexOf('const mapExtraSearchParams');
        expect(start).toBeGreaterThan(-1);

        const end = source.indexOf('};', start);
        expect(end).toBeGreaterThan(start);

        expect(source.slice(start, end)).toMatch(SPREAD);
    });
});
