/**
 * @file amenity-attributes-payload.test.ts
 * @description The services page's `amenityAttributes` PATCH field (HOS-2058).
 *
 * The API applies the list to the FINAL linked set and rejects an entry for an
 * amenity that is not linked, so what this builder sends must be: checked
 * amenities only, declared values only, and nothing at all when the effective
 * declarations did not change by value.
 */

import { describe, expect, it } from 'vitest';
import {
    buildAmenityAttributesList,
    buildAmenityAttributesPayload
} from '../../../../src/components/host/editor/amenity-attributes-payload';

describe('buildAmenityAttributesList', () => {
    it('keeps checked amenities with a declaration, in checked order', () => {
        const list = buildAmenityAttributesList({
            amenityIds: ['b', 'a', 'c'],
            amenityAttributes: {
                a: { scope: 'private', availability: null },
                b: { scope: null, availability: 'seasonal' }
            }
        });

        expect(list).toEqual([
            { amenityId: 'b', scope: null, availability: 'seasonal' },
            { amenityId: 'a', scope: 'private', availability: null }
        ]);
    });

    it('drops declarations of unchecked amenities and all-null entries', () => {
        const list = buildAmenityAttributesList({
            amenityIds: ['a'],
            amenityAttributes: {
                a: { scope: null, availability: null },
                gone: { scope: 'shared', availability: 'year_round' }
            }
        });

        expect(list).toEqual([]);
    });

    it('tolerates a missing map', () => {
        expect(buildAmenityAttributesList({ amenityIds: ['a'] })).toEqual([]);
    });
});

describe('buildAmenityAttributesPayload', () => {
    const baseline = {
        amenityIds: ['a', 'b'],
        amenityAttributes: { a: { scope: 'private' as const, availability: null } }
    };

    it('sends nothing when nothing changed', () => {
        expect(buildAmenityAttributesPayload({ values: baseline, baseline })).toEqual({});
    });

    it('sends nothing when a value is changed and then put back (value, not identity)', () => {
        const values = {
            ...baseline,
            amenityAttributes: { a: { scope: 'private' as const, availability: null } }
        };

        expect(buildAmenityAttributesPayload({ values, baseline })).toEqual({});
    });

    it('sends the whole effective list when one declaration changes', () => {
        const values = {
            amenityIds: ['a', 'b'],
            amenityAttributes: {
                a: { scope: 'private' as const, availability: null },
                b: { scope: 'shared' as const, availability: 'seasonal' as const }
            }
        };

        expect(buildAmenityAttributesPayload({ values, baseline })).toEqual({
            amenityAttributes: [
                { amenityId: 'a', scope: 'private', availability: null },
                { amenityId: 'b', scope: 'shared', availability: 'seasonal' }
            ]
        });
    });

    it('sends a list without an amenity that was unchecked, so no entry targets an unlinked row', () => {
        const values = { ...baseline, amenityIds: ['b'] };

        expect(buildAmenityAttributesPayload({ values, baseline })).toEqual({
            amenityAttributes: []
        });
    });

    it('sends an empty list when the last declaration is cleared to "not specified"', () => {
        const values = {
            ...baseline,
            amenityAttributes: { a: { scope: null, availability: null } }
        };

        expect(buildAmenityAttributesPayload({ values, baseline })).toEqual({
            amenityAttributes: []
        });
    });
});
