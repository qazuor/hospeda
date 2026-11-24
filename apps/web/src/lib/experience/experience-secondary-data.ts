/**
 * @file experience-secondary-data.ts
 * @description The reviews and FAQs the experience detail page fetches next to
 * the main record (moved out of `experiencias/[slug].astro`, HOS-2579).
 *
 * Both calls run in parallel with `Promise.allSettled`, so a failure of either
 * one degrades to an empty section instead of failing the page.
 */

import type { DetailFaq } from '@/data/types';
import type { ExperienceReviewPublicItem } from '@/lib/api/endpoints';
import { experiencesApi } from '@/lib/api/endpoints';
import { resolveExperienceFaqs } from '@/lib/experience/experience-faqs';

/**
 * Fetches the first review page and the FAQs of an experience.
 *
 * @param input.experienceId - The experience id.
 * @param input.inlineFaqs - FAQs the detail payload already carries; they win over the endpoint.
 * @param input.fallbackTotalReviews - Review count to show when the reviews call fails.
 * @returns The initial reviews, their total and the FAQs.
 */
export async function fetchExperienceSecondaryData(input: {
    readonly experienceId: string;
    readonly inlineFaqs: readonly DetailFaq[];
    readonly fallbackTotalReviews: number;
}): Promise<{
    readonly reviews: readonly ExperienceReviewPublicItem[];
    readonly totalReviews: number;
    readonly faqs: readonly DetailFaq[];
}> {
    const [reviewsSettled, faqsSettled] = await Promise.allSettled([
        experiencesApi.getReviews({ id: input.experienceId, page: 1, pageSize: 5 }),
        experiencesApi.getFaqs({ id: input.experienceId })
    ]);
    const reviewsResult = reviewsSettled.status === 'fulfilled' ? reviewsSettled.value : null;
    const faqsResult = faqsSettled.status === 'fulfilled' ? faqsSettled.value : null;
    const { faqs } = resolveExperienceFaqs({
        inlineFaqs: input.inlineFaqs,
        fetched: faqsResult?.ok ? faqsResult.data : null
    });
    return {
        reviews: reviewsResult?.ok ? reviewsResult.data.items : [],
        totalReviews: reviewsResult?.ok
            ? reviewsResult.data.pagination.total
            : input.fallbackTotalReviews,
        faqs
    };
}
