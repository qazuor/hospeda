/**
 * @file business-line-collection.test.ts
 * @description Behaviour tests for the pure business-line collection helpers
 * (HOS-1787 leaf 6.8).
 *
 * The route segment is the Spanish slug and the API filter is the internal
 * catalog value. The resolver delegates both directions to `@repo/schemas`, so
 * these tests pin the contract the page, sitemap and menu will consume: exact
 * matching, `null` for anything that is not a public slug, and a canonical path
 * built from the catalog rather than from the passed segment.
 */
import { businessLineToUrlSlug, listPublicBusinessLines } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildVenueBusinessLineCollectionPath,
    buildVenueBusinessLineCollectionSitemapPath,
    buildVenueCollectionNavItems,
    isVenueCollectionEmpty,
    listVenueBusinessLineCollections,
    resolveVenueBusinessLineCollection,
    resolveVenueCollectionCopy
} from '../../../src/lib/venue/business-line-collection';

describe('resolveVenueBusinessLineCollection', () => {
    it('resolves the public collection slugs to their internal values', () => {
        const foodSlug = businessLineToUrlSlug({ value: 'food' }).urlSlug;
        const nightlifeSlug = businessLineToUrlSlug({ value: 'nightlife' }).urlSlug;

        expect(resolveVenueBusinessLineCollection({ urlSlug: foodSlug })).toEqual({
            businessLine: 'food',
            urlSlug: foodSlug
        });
        expect(resolveVenueBusinessLineCollection({ urlSlug: nightlifeSlug })).toEqual({
            businessLine: 'nightlife',
            urlSlug: nightlifeSlug
        });
    });

    it('returns null for unreachable segments (case, internal value, empty, unknown, absent)', () => {
        const traps: readonly (string | undefined)[] = [
            'Noche', // exact comparison: case matters
            'nightlife', // internal value is not a URL slug
            'food', // same, for the other direction
            '', // empty segment
            'rubro', // reserved segment, never a business line
            undefined // segment absent
        ];

        for (const urlSlug of traps) {
            expect(resolveVenueBusinessLineCollection({ urlSlug })).toBeNull();
        }
    });
});

describe('buildVenueBusinessLineCollectionPath', () => {
    it('builds the locale-prefixed collection path with a trailing slash', () => {
        const { urlSlug } = businessLineToUrlSlug({ value: 'nightlife' });

        expect(
            buildVenueBusinessLineCollectionPath({ locale: 'en', businessLine: 'nightlife' })
        ).toBe(`/en/comer-y-salir/rubro/${urlSlug}/`);
    });
});

describe('venue collection navigation and copy', () => {
    it('builds translated links in catalog order', () => {
        const calls: string[] = [];
        const items = buildVenueCollectionNavItems({
            locale: 'es',
            t: (key) => {
                calls.push(key);
                return key;
            }
        });
        const catalog = listPublicBusinessLines({ vertical: 'venue' });
        expect(items).toHaveLength(catalog.length);
        expect(items.map(({ label }) => label)).toEqual(
            catalog.map(({ value }) => `venue.owner.businessLines.${value}.label`)
        );
        expect(items.map(({ href }, index) => href)).toEqual(
            catalog.map(({ value }) =>
                buildVenueBusinessLineCollectionPath({ locale: 'es', businessLine: value })
            )
        );
        expect(calls).toHaveLength(catalog.length);
    });

    it('requests all collection copy fields with destination interpolation', () => {
        const calls: { key: string; params?: Record<string, unknown> }[] = [];
        const copy = resolveVenueCollectionCopy({
            businessLine: listPublicBusinessLines({ vertical: 'venue' })[0].value,
            destinationName: 'Colón',
            t: (key, _fallback, params) => {
                calls.push({ key, params });
                return key;
            }
        });
        expect(Object.keys(copy)).toEqual([
            'pageTitle',
            'description',
            'heading',
            'intro',
            'ogTagline'
        ]);
        expect(calls).toHaveLength(5);
        expect(calls.every(({ key }) => key.startsWith('venue.collections.'))).toBe(true);
        expect(calls.every(({ params }) => params?.destino === 'Colón')).toBe(true);
    });
});

describe('listVenueBusinessLineCollections', () => {
    it('returns the catalog public collections in order', () => {
        const expected = listPublicBusinessLines({ vertical: 'venue' }).map(
            ({ value, urlSlug }) => ({ businessLine: value, urlSlug })
        );

        expect(listVenueBusinessLineCollections()).toEqual(expected);
        expect(listVenueBusinessLineCollections().length).toBeGreaterThan(0);
    });
});

describe('buildVenueBusinessLineCollectionSitemapPath', () => {
    it('builds the locale-agnostic path from the catalog slug with both slashes', () => {
        for (const { value, urlSlug } of listPublicBusinessLines({ vertical: 'venue' })) {
            const path = buildVenueBusinessLineCollectionSitemapPath({ businessLine: value });

            expect(path).toBe(`/comer-y-salir/rubro/${urlSlug}/`);
            expect(path).not.toMatch(/^\/(es|en|pt)\//);
        }
    });
});

describe('isVenueCollectionEmpty', () => {
    it('is empty only when the fetch succeeded and reported zero results', () => {
        expect(isVenueCollectionEmpty({ fetchOk: true, total: 0 })).toBe(true);
        expect(isVenueCollectionEmpty({ fetchOk: true, total: 3 })).toBe(false);
        // A failed request is not an empty collection: a 503 must never noindex
        // a page that simply could not be counted.
        expect(isVenueCollectionEmpty({ fetchOk: false, total: 0 })).toBe(false);
    });
});
