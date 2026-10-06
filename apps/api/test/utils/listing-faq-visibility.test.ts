import { describe, expect, it } from 'vitest';
import { filterPublicFaqs, withPublicVisibleFaqs } from '../../src/utils/listing-faq-visibility';

const row = (q: number, extra: Record<string, unknown> = {}) => ({
    q,
    lifecycleState: 'ACTIVE',
    deletedAt: null,
    ...extra
});

describe('filterPublicFaqs', () => {
    it('drops FAQs with isVisibleOnListing=false, keeps true, null and missing', () => {
        // Arrange
        const faqs = [
            row(1, { isVisibleOnListing: true }),
            row(2),
            row(3, { isVisibleOnListing: null }),
            row(4, { isVisibleOnListing: false })
        ];

        // Act
        const result = filterPublicFaqs(faqs);

        // Assert
        expect(result.map((f) => f.q)).toEqual([1, 2, 3]);
    });

    it('drops soft-deleted FAQs', () => {
        const faqs = [row(1), row(2, { deletedAt: new Date('2026-01-01') })];
        expect(filterPublicFaqs(faqs).map((f) => f.q)).toEqual([1]);
    });

    it.each(['DRAFT', 'ARCHIVED', undefined, null])('drops lifecycleState=%s', (state) => {
        const faqs = [row(1), row(2, { lifecycleState: state })];
        expect(filterPublicFaqs(faqs).map((f) => f.q)).toEqual([1]);
    });
});

describe('withPublicVisibleFaqs', () => {
    it('filters the embedded faqs and keeps the rest of the entity', () => {
        const entity = { id: 'a', faqs: [row(1), row(2, { isVisibleOnListing: false })] };
        const result = withPublicVisibleFaqs(entity);
        expect(result.faqs.map((f) => f.q)).toEqual([1]);
        expect(result.id).toBe('a');
    });

    it('returns the entity unchanged when it has no faqs array', () => {
        const entity: { id: string; faqs?: undefined } = { id: 'a' };
        expect(withPublicVisibleFaqs(entity)).toBe(entity);
    });
});
