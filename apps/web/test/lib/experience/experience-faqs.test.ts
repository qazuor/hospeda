/**
 * @file experience-faqs.test.ts
 * @description Unit tests of `resolveExperienceFaqs` (HOS-2579).
 */

import { describe, expect, it } from 'vitest';
import { resolveExperienceFaqs } from '@/lib/experience/experience-faqs';

const inline = [{ id: 'f1', question: '¿Hora?', answer: '9 h', category: null }];

describe('resolveExperienceFaqs', () => {
    it('prefers the inline FAQs over the standalone endpoint', () => {
        expect(
            resolveExperienceFaqs({
                inlineFaqs: inline,
                fetched: [{ id: 'x', question: 'q', answer: 'a' }]
            }).faqs
        ).toBe(inline);
    });

    it('normalizes the endpoint FAQs when there is no inline one', () => {
        expect(
            resolveExperienceFaqs({
                inlineFaqs: [],
                fetched: [{ id: 7, question: 'q', answer: 'a', category: 'GENERAL' }, {}]
            }).faqs
        ).toEqual([
            { id: '7', question: 'q', answer: 'a', category: 'GENERAL' },
            { id: '', question: '', answer: '', category: null }
        ]);
    });

    it('returns no FAQ when the endpoint failed or answered a non-array', () => {
        expect(resolveExperienceFaqs({ inlineFaqs: [], fetched: null }).faqs).toEqual([]);
        expect(resolveExperienceFaqs({ inlineFaqs: [], fetched: { items: [] } }).faqs).toEqual([]);
    });
});
