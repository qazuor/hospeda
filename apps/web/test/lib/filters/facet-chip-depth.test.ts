/**
 * @file facet-chip-depth.test.ts
 * @description Regression tests for the quick-filter chip DEPTH CAP (HOS-524).
 *
 * The bug this pins: every already-filtered listing re-emitted a chip per
 * remaining value, each linking one value DEEPER (`?types=A` published 12
 * `?types=A,<X>` links, which published 11 more each, ...). Following those
 * links depth-first walks the whole subset lattice — 2^13 for accommodation
 * types, 2^18 for post categories, 2^n for the destinos attraction badges.
 * Capping the ADD affordance at {@link FACET_CHIP_MAX_ACTIVE_VALUES} bounds
 * the crawlable space to the subsets of size <= N.
 */

import { describe, expect, it } from 'vitest';
import {
    FACET_CHIP_MAX_ACTIVE_VALUES,
    resolveFacetChipHref
} from '../../../src/lib/filters/facet-chip-depth';

const baseUrl = '/es/alojamientos/';

describe('resolveFacetChipHref', () => {
    it('caps at 3 active values (the owner-decided N)', () => {
        expect(FACET_CHIP_MAX_ACTIVE_VALUES).toBe(3);
    });

    it('returns an href for an ADD chip while below the cap', () => {
        const href = resolveFacetChipHref({
            baseUrl,
            searchParams: new URLSearchParams('types=CABIN,HOTEL'),
            key: 'types',
            value: 'ROOM',
            activeValues: ['CABIN', 'HOTEL']
        });
        expect(href).toBe('/es/alojamientos/?types=CABIN%2CHOTEL%2CROOM');
    });

    it('returns undefined for an ADD chip once the cap is reached (HOS-524)', () => {
        const href = resolveFacetChipHref({
            baseUrl,
            searchParams: new URLSearchParams('types=APARTMENT,CABIN,HOTEL'),
            key: 'types',
            value: 'ROOM',
            activeValues: ['APARTMENT', 'CABIN', 'HOTEL']
        });
        expect(href).toBeUndefined();
    });

    it('still returns undefined past the cap, for a crafted deeper URL', () => {
        const href = resolveFacetChipHref({
            baseUrl,
            searchParams: new URLSearchParams('types=APARTMENT,CABIN,HOTEL,ROOM'),
            key: 'types',
            value: 'MOTEL',
            activeValues: ['APARTMENT', 'CABIN', 'HOTEL', 'ROOM']
        });
        expect(href).toBeUndefined();
    });

    it('ALWAYS keeps the REMOVE href for an active chip, even past the cap', () => {
        // The cap must never trap a user (or a crawler) inside a filtered URL
        // with no way back out — removal is what makes the capped state exitable.
        const href = resolveFacetChipHref({
            baseUrl,
            searchParams: new URLSearchParams('types=APARTMENT,CABIN,HOTEL,ROOM'),
            key: 'types',
            value: 'CABIN',
            activeValues: ['APARTMENT', 'CABIN', 'HOTEL', 'ROOM']
        });
        expect(href).toBe('/es/alojamientos/?types=APARTMENT%2CHOTEL%2CROOM');
    });

    it('serializes through the canonical order (two click orders, one URL)', () => {
        const a = resolveFacetChipHref({
            baseUrl,
            searchParams: new URLSearchParams('types=HOTEL'),
            key: 'types',
            value: 'CABIN',
            activeValues: ['HOTEL']
        });
        const b = resolveFacetChipHref({
            baseUrl,
            searchParams: new URLSearchParams('types=CABIN'),
            key: 'types',
            value: 'HOTEL',
            activeValues: ['CABIN']
        });
        expect(a).toBe(b);
    });

    it('honors the legacy singular param when seeding the active set', () => {
        const href = resolveFacetChipHref({
            baseUrl: '/es/eventos/',
            searchParams: new URLSearchParams('category=MUSIC'),
            key: 'categories',
            value: 'CULTURE',
            singularKey: 'category',
            activeValues: ['MUSIC']
        });
        expect(href).toBe('/es/eventos/?categories=CULTURE%2CMUSIC');
    });

    it('bounds the emitted link space to subsets of size <= N (the whole point)', () => {
        // Walk the chip row the way a crawler does and count DISTINCT hrefs
        // reachable from the unfiltered listing.
        const values = ['A', 'B', 'C', 'D', 'E', 'F'];
        const seen = new Set<string>();
        const walk = (active: readonly string[]): void => {
            for (const value of values) {
                const href = resolveFacetChipHref({
                    baseUrl,
                    searchParams: new URLSearchParams(
                        active.length > 0 ? `types=${active.join(',')}` : ''
                    ),
                    key: 'types',
                    value,
                    activeValues: active
                });
                if (href === undefined || seen.has(href)) continue;
                seen.add(href);
                const next = active.includes(value)
                    ? active.filter((member) => member !== value)
                    : [...active, value].sort();
                walk(next);
            }
        };
        walk([]);
        // C(6,1) + C(6,2) + C(6,3) = 6 + 15 + 20 = 41 filtered URLs, plus the
        // bare listing reached by removing the last active value.
        expect(seen.size).toBe(42);
    });
});
