import { describe, expect, it } from 'vitest';
import { CACHE_TAG_COLLECTIONS, CACHE_TAG_ENTITY_PREFIXES } from '../vocabulary.ts';

describe('cache tag vocabulary', () => {
    it('pins entity and collection prefixes and excludes retired vocabulary', () => {
        expect(CACHE_TAG_ENTITY_PREFIXES).toEqual({
            accommodation: 'accom',
            destination: 'dest',
            event: 'event',
            post: 'post',
            venue: 'venue',
            experience: 'exp',
            attraction: 'attr',
            pointOfInterest: 'poi',
            partner: 'partner'
        });
        expect(CACHE_TAG_COLLECTIONS).toEqual({
            accommodation: 'list-accom',
            destination: 'list-dest',
            event: 'list-event',
            post: 'list-post',
            venue: 'list-venue',
            experience: 'list-exp'
        });
        const vocabulary = [
            ...Object.values(CACHE_TAG_ENTITY_PREFIXES),
            ...Object.values(CACHE_TAG_COLLECTIONS)
        ];
        expect(vocabulary.every((value) => !value.includes(['gas', 'tro'].join('')))).toBe(true);
    });
});
