/**
 * @file review-strip.test.ts
 * @description HOS-2530 / AC-2.6: the strip takes at most 6 real reviews and never invents one.
 */
import { describe, expect, it } from 'vitest';
import { REVIEW_STRIP_LIMIT, toReviewStripItems } from '@/lib/review-strip';

const review = (n: number, extra: Record<string, unknown> = {}) => ({
    id: `r-${n}`,
    content: `Texto ${n}`,
    averageRating: 4.5,
    createdAt: '2026-01-02T00:00:00.000Z',
    user: { name: `Persona ${n}`, image: null },
    ...extra
});

describe('toReviewStripItems', () => {
    it('returns an empty list when there are no reviews (no placeholders)', () => {
        expect(toReviewStripItems({ items: [] })).toEqual([]);
    });

    it('caps the strip at 6 cards, keeping the API order', () => {
        const items = Array.from({ length: 10 }, (_, i) => review(i + 1));

        const cards = toReviewStripItems({ items });

        expect(REVIEW_STRIP_LIMIT).toBe(6);
        expect(cards).toHaveLength(6);
        expect(cards.map((card) => card.id)).toEqual(['r-1', 'r-2', 'r-3', 'r-4', 'r-5', 'r-6']);
    });

    it('skips reviews without text instead of filling them in', () => {
        const cards = toReviewStripItems({
            items: [review(1, { content: '   ' }), review(2, { content: undefined }), review(3)]
        });

        expect(cards.map((card) => card.id)).toEqual(['r-3']);
    });

    it('keeps null for missing author, avatar, rating and date', () => {
        const [card] = toReviewStripItems({
            items: [{ id: 'x', content: 'Hola', user: null, averageRating: 'n/a' }]
        });

        expect(card).toEqual({
            id: 'x',
            name: null,
            image: null,
            rating: null,
            content: 'Hola',
            createdAt: null,
            reply: null
        });
    });

    it('carries the host public reply and whether it was edited (HOS-2199)', () => {
        const cards = toReviewStripItems({
            items: [
                review(1, { reply: { content: ' Gracias! ', createdAt: 'x', editedAt: null } }),
                review(2, {
                    reply: { content: 'Ajustada', createdAt: 'x', editedAt: '2026-11-02' }
                }),
                review(3, { reply: { content: '   ', createdAt: 'x', editedAt: null } }),
                review(4)
            ]
        });

        expect(cards.map((card) => card.reply)).toEqual([
            { content: 'Gracias!', edited: false },
            { content: 'Ajustada', edited: true },
            null,
            null
        ]);
    });
});
