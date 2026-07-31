/**
 * @file facet-crawl-policy.test.ts
 * @description Unit tests for the HOS-369 WA-1/WA-2 facet crawl policy — the
 * shared source of truth behind both the `robots.txt` facet `Disallow`s and the
 * `rel="nofollow"` rule on facet chip links.
 *
 * The load-bearing assertions here are the NEGATIVE ones (spec R-8): a rule
 * broad enough to catch `/alojamientos/tipo/hotel/` would silently de-index
 * deliberate SEO surface, and that damage takes weeks to show up in Search
 * Console. Both directions are covered.
 */

import { describe, expect, it } from 'vitest';
import { FACET_CONFIGS } from '../../../src/lib/filters/facet-config';
import {
    buildFacetDisallowDirectives,
    FACET_QUERY_PARAM_KEYS,
    shouldNofollowFacetHref
} from '../../../src/lib/filters/facet-crawl-policy';

describe('FACET_QUERY_PARAM_KEYS', () => {
    it('covers every param key declared by the facet config model', () => {
        // Derived, not duplicated: adding a facet to `facet-config.ts` without
        // covering its params here must fail.
        for (const facet of FACET_CONFIGS) {
            expect(FACET_QUERY_PARAM_KEYS, `paramKey "${facet.paramKey}"`).toContain(
                facet.paramKey
            );
            if (facet.singularParamKey) {
                expect(
                    FACET_QUERY_PARAM_KEYS,
                    `singularParamKey "${facet.singularParamKey}"`
                ).toContain(facet.singularParamKey);
            }
        }
    });

    it('covers the date/occupancy params named by the spec (WA-1)', () => {
        for (const key of ['checkIn', 'checkOut', 'adults', 'children']) {
            expect(FACET_QUERY_PARAM_KEYS).toContain(key);
        }
    });

    it('does NOT include `page` — pagination is legitimate discovery surface', () => {
        expect(FACET_QUERY_PARAM_KEYS).not.toContain('page');
    });

    it('is frozen (single source of truth, no runtime mutation)', () => {
        expect(Object.isFrozen(FACET_QUERY_PARAM_KEYS)).toBe(true);
    });

    it('has no duplicate keys', () => {
        expect(new Set(FACET_QUERY_PARAM_KEYS).size).toBe(FACET_QUERY_PARAM_KEYS.length);
    });
});

describe('shouldNofollowFacetHref', () => {
    describe('facet query views are nofollowed', () => {
        it.each([
            ['/es/alojamientos/?types=HOTEL', 'accommodation types'],
            ['/es/alojamientos/?types=HOTEL%2CCABIN', 'multi-value accommodation types'],
            ['/es/eventos/?categories=MUSIC', 'event categories'],
            ['/es/eventos/?category=MUSIC', 'legacy singular event category'],
            ['/pt/destinos/concepcion-del-uruguay/?categories=termas', 'POI categories'],
            ['?categories=termas', 'query-only href (island SSR shape)'],
            ['/es/destinos/?attractions=a,b#dest-filter-top', 'destinos attractions + fragment'],
            ['/es/gastronomia/?type=RESTAURANT', 'gastronomy type'],
            ['/es/alojamientos/?sortBy=price&checkIn=2026-08-01', 'date param in 2nd position'],
            ['/es/alojamientos/?q=cabana', 'internal search results']
        ])('nofollows %s (%s)', (href) => {
            expect(shouldNofollowFacetHref({ href })).toBe(true);
        });
    });

    describe('R-8 — path-based facet landings stay followable', () => {
        it.each([
            '/es/alojamientos/tipo/hotel/',
            '/es/eventos/categoria/music/',
            '/es/publicaciones/categoria/guias/',
            '/es/destinos/atraccion/termas/',
            '/es/alojamientos/',
            '/es/alojamientos/page/2/',
            '/es/destinos/concepcion-del-uruguay/'
        ])('does not nofollow %s', (href) => {
            expect(shouldNofollowFacetHref({ href })).toBe(false);
        });

        it('does not nofollow a non-facet query param', () => {
            expect(shouldNofollowFacetHref({ href: '/es/alojamientos/?page=2' })).toBe(false);
        });

        it('does not nofollow a fragment-only href', () => {
            expect(shouldNofollowFacetHref({ href: '#dest-filter-top' })).toBe(false);
        });

        it('does not nofollow an empty query string', () => {
            expect(shouldNofollowFacetHref({ href: '/es/alojamientos/?' })).toBe(false);
        });

        it('does not nofollow when a facet key appears only inside the fragment', () => {
            // A fragment is never sent to the server, so it cannot fragment the
            // URL space — parsing it as query would be a false positive.
            expect(shouldNofollowFacetHref({ href: '/es/alojamientos/#categories=X' })).toBe(false);
        });

        it('does not nofollow a key that merely CONTAINS a facet key as a substring', () => {
            expect(shouldNofollowFacetHref({ href: '/es/alojamientos/?subcategories=X' })).toBe(
                false
            );
        });
    });
});

describe('buildFacetDisallowDirectives', () => {
    it('emits one Disallow per facet key, in declaration order', () => {
        const directives = buildFacetDisallowDirectives();
        expect(directives).toHaveLength(FACET_QUERY_PARAM_KEYS.length);
        expect(directives[0]).toBe(`Disallow: /*?*${FACET_QUERY_PARAM_KEYS[0]}=`);
    });

    it('uses the `/*?*<key>=` shape so the param matches in any position', () => {
        // `?categories=` (first) and `?sortBy=x&categories=` (later) must both
        // match; a literal `/*?<key>=` prefix rule would only catch the first.
        for (const directive of buildFacetDisallowDirectives()) {
            expect(directive).toMatch(/^Disallow: \/\*\?\*[A-Za-z]+=$/);
        }
    });

    it('never emits a blanket wildcard that would swallow path landings (R-8)', () => {
        const directives = buildFacetDisallowDirectives();
        expect(directives).not.toContain('Disallow: /*?*');
        expect(directives).not.toContain('Disallow: /*?');
        // Every directive is anchored on a concrete param name.
        for (const directive of directives) {
            expect(directive.endsWith('=')).toBe(true);
        }
    });
});
