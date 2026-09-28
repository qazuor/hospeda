import { describe, expect, it } from 'vitest';
import { withPublicVisibleFaqs } from '../../src/utils/commerce-faq-visibility';

describe('withPublicVisibleFaqs', () => {
    it('drops FAQs with isVisibleOnListing=false, keeps true and missing', () => {
        // Arrange
        const entity = {
            id: 'a',
            faqs: [
                { q: 1, isVisibleOnListing: true },
                { q: 2 },
                { q: 3, isVisibleOnListing: null },
                { q: 4, isVisibleOnListing: false }
            ]
        };

        // Act
        const result = withPublicVisibleFaqs(entity);

        // Assert
        expect(result.faqs.map((f) => f.q)).toEqual([1, 2, 3]);
        expect(result.id).toBe('a');
    });

    it('returns the entity unchanged when it has no faqs array', () => {
        const entity: { id: string; faqs?: undefined } = { id: 'a' };
        expect(withPublicVisibleFaqs(entity)).toBe(entity);
    });
});
