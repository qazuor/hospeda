/**
 * @file experience-secondary-data.test.ts
 * @description Unit tests of `fetchExperienceSecondaryData` (HOS-2579).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getReviews = vi.fn();
const getFaqs = vi.fn();
vi.mock('@/lib/api/endpoints', () => ({ experiencesApi: { getReviews, getFaqs } }));

const { fetchExperienceSecondaryData } = await import('@/lib/experience/experience-secondary-data');

const review = { id: 'r1' };

describe('fetchExperienceSecondaryData', () => {
    beforeEach(() => {
        getReviews.mockReset();
        getFaqs.mockReset();
    });

    it('returns the first review page, its total and the endpoint FAQs', async () => {
        // Arrange
        getReviews.mockResolvedValue({
            ok: true,
            data: { items: [review], pagination: { total: 12 } }
        });
        getFaqs.mockResolvedValue({ ok: true, data: [{ id: 'f', question: 'q', answer: 'a' }] });
        // Act
        const out = await fetchExperienceSecondaryData({
            experienceId: 'exp-1',
            inlineFaqs: [],
            fallbackTotalReviews: 3
        });
        // Assert
        expect(getReviews).toHaveBeenCalledWith({ id: 'exp-1', page: 1, pageSize: 5 });
        expect(getFaqs).toHaveBeenCalledWith({ id: 'exp-1' });
        expect(out).toEqual({
            reviews: [review],
            totalReviews: 12,
            faqs: [{ id: 'f', question: 'q', answer: 'a', category: null }]
        });
    });

    it('degrades to empty sections and the fallback total when the calls fail', async () => {
        getReviews.mockRejectedValue(new Error('down'));
        getFaqs.mockResolvedValue({ ok: false, error: { status: 500 } });
        const out = await fetchExperienceSecondaryData({
            experienceId: 'exp-1',
            inlineFaqs: [],
            fallbackTotalReviews: 3
        });
        expect(out).toEqual({ reviews: [], totalReviews: 3, faqs: [] });
    });
});
