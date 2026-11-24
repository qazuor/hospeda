/**
 * @file experience-faqs.ts
 * @description The FAQ list of the experience detail page (moved out of
 * `experiencias/[slug].astro`, HOS-2579): the entity's inline FAQs win, and the
 * standalone FAQ endpoint is the fallback.
 */

import type { DetailFaq } from '@/data/types';

/**
 * Resolves the FAQs an experience detail page renders.
 *
 * @param input.inlineFaqs - FAQs carried by the detail payload.
 * @param input.fetched - The standalone endpoint's data, or `null` when the call failed.
 * @returns The FAQs, `[]` when there is none.
 */
export function resolveExperienceFaqs(input: {
    readonly inlineFaqs: readonly DetailFaq[];
    readonly fetched: unknown;
}): { readonly faqs: readonly DetailFaq[] } {
    if (input.inlineFaqs.length > 0) return { faqs: input.inlineFaqs };
    if (!Array.isArray(input.fetched)) return { faqs: [] };
    return {
        faqs: (input.fetched as readonly Record<string, unknown>[]).map((faq) => ({
            id: String(faq.id || ''),
            question: String(faq.question || ''),
            answer: String(faq.answer || ''),
            category: faq.category ? String(faq.category) : null
        }))
    };
}
