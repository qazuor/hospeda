/**
 * HOS-929 regression — `filterFeaturedCards` must drop non-featured cards
 * rather than let them backfill the homepage "Destacados" section.
 *
 * `AccommodationModel.search()` never applies `isFeatured` as a WHERE filter
 * (only `featuredFirst` ordering exists), so before this filter existed the
 * section silently showed non-featured cards whenever fewer than `pageSize`
 * accommodations were genuinely featured — including, in the worst case,
 * ZERO featured accommodations rendering a full page of unrelated ones.
 */
import { describe, expect, it } from 'vitest';
import { filterFeaturedCards } from '@/lib/sections/featured-accommodations';

function card(id: string, isFeatured: boolean) {
    return { id, isFeatured };
}

describe('filterFeaturedCards', () => {
    it('keeps only cards whose isFeatured is true', () => {
        const cards = [card('a', true), card('b', false), card('c', true)];

        const result = filterFeaturedCards(cards);

        expect(result).toEqual([card('a', true), card('c', true)]);
    });

    it('returns an empty array when no card is featured (worst case: EmptyState renders)', () => {
        const cards = [card('a', false), card('b', false)];

        const result = filterFeaturedCards(cards);

        expect(result).toEqual([]);
    });

    it('returns every card when all are featured', () => {
        const cards = [card('a', true), card('b', true)];

        const result = filterFeaturedCards(cards);

        expect(result).toEqual(cards);
    });

    it('preserves input order (featured-first, per the forced featuredFirst sort)', () => {
        const cards = [card('a', true), card('b', true), card('c', false)];

        const result = filterFeaturedCards(cards);

        expect(result.map((c) => c.id)).toEqual(['a', 'b']);
    });

    it('returns an empty array for an empty input', () => {
        expect(filterFeaturedCards([])).toEqual([]);
    });
});
