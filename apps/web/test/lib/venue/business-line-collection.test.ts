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
import { businessLineToUrlSlug } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildVenueBusinessLineCollectionPath,
    resolveVenueBusinessLineCollection
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
        expect(
            buildVenueBusinessLineCollectionPath({ locale: 'en', businessLine: 'nightlife' })
        ).toBe('/en/comer-y-salir/rubro/noche/');
    });
});
