/**
 * HOS-1764 replaces the HOS-929 rule that non-featured cards must not backfill.
 * The owner decided to show featured cards first, then fill with the best-rated
 * cards already ordered by the API.
 */
import { describe, expect, it } from 'vitest';
import {
    type HomeFeaturedCandidate,
    selectHomeAccommodationCards
} from '@/lib/sections/featured-accommodations';

function card(id: string, isFeatured: boolean): HomeFeaturedCandidate {
    return { id, isFeatured };
}

describe('selectHomeAccommodationCards', () => {
    it('fills the limit with featured cards first and keeps input order within each group', () => {
        const cards = [
            card('a', false),
            card('b', false),
            card('c', true),
            card('d', false),
            card('e', true)
        ];

        expect(selectHomeAccommodationCards({ cards, limit: 4 }).map(({ id }) => id)).toEqual([
            'c',
            'e',
            'a',
            'b'
        ]);
        expect(selectHomeAccommodationCards({ cards, limit: 8 })).toEqual([
            cards[2],
            cards[4],
            cards[0],
            cards[1],
            cards[3]
        ]);
    });

    it('keeps only the first appearance of each id', () => {
        const first = card('same', false);
        const later = card('same', true);
        const other = card('other', true);

        expect(selectHomeAccommodationCards({ cards: [first, later, other], limit: 3 })).toEqual([
            other,
            first
        ]);
    });

    it('returns original references without changing featured state', () => {
        const featured = card('featured', true);
        const regular = card('regular', false);

        const result = selectHomeAccommodationCards({ cards: [regular, featured], limit: 2 });

        expect(result[0]).toBe(featured);
        expect(result[1]).toBe(regular);
        expect(result[1]?.isFeatured).toBe(false);
    });

    it('returns empty only for empty input, and retains cards when none are featured', () => {
        const cards = [card('a', false), card('b', false)];

        expect(selectHomeAccommodationCards({ cards: [], limit: 8 })).toEqual([]);
        expect(selectHomeAccommodationCards({ cards, limit: 8 })).toEqual(cards);
    });

    it('preserves relative order of featured and non-featured cards and returns empty at limit zero', () => {
        const cards = [card('n1', false), card('f1', true), card('n2', false), card('f2', true)];

        expect(selectHomeAccommodationCards({ cards, limit: 4 }).map(({ id }) => id)).toEqual([
            'f1',
            'f2',
            'n1',
            'n2'
        ]);
        expect(selectHomeAccommodationCards({ cards, limit: 0 })).toEqual([]);
    });
});
