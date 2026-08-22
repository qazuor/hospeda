/**
 * @file faqs-in-page-language.test.ts
 * @description HOS-616: a destination FAQ with no translation for the active
 * locale falls back to its Spanish source, so `/en` and `/pt` rendered a
 * Spanish block inside an otherwise translated page. `faqsInPageLanguage`
 * drops those; this asserts it drops exactly those and nothing else.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { faqsInPageLanguage } from '../../../src/lib/api/transforms';

const faq = (id: string, resolvedLocale: 'es' | 'en' | 'pt') => ({
    id,
    question: `q-${id}`,
    answer: `a-${id}`,
    category: null,
    resolvedLocale
});

describe('faqsInPageLanguage (HOS-616)', () => {
    it('hides nothing under /es — the legacy columns ARE the Spanish source', () => {
        const faqs = [faq('1', 'es'), faq('2', 'es'), faq('3', 'es')];
        expect(faqsInPageLanguage(faqs, 'es')).toHaveLength(3);
    });

    it('hides the untranslated ones under /en, keeping the translated ones', () => {
        const faqs = [faq('translated', 'en'), faq('untranslated', 'es')];
        const kept = faqsInPageLanguage(faqs, 'en');
        expect(kept.map((f) => f.id)).toEqual(['translated']);
    });

    it('hides a Portuguese FAQ under /en — the rule is equality, not "not Spanish"', () => {
        const faqs = [faq('portuguese', 'pt')];
        expect(faqsInPageLanguage(faqs, 'en')).toHaveLength(0);
    });

    it('hides a half-translated pair, which mapDetailFaqs reports as es', () => {
        // mapDetailFaqs sets resolvedLocale to 'es' when question and answer
        // disagree, so a pair with only its question translated arrives here
        // marked Spanish and must not survive into /pt.
        expect(faqsInPageLanguage([faq('mixed', 'es')], 'pt')).toHaveLength(0);
    });

    it('returns an empty array rather than throwing when there are no FAQs', () => {
        expect(faqsInPageLanguage([], 'en')).toEqual([]);
    });

    it('is actually WIRED into the destination page, not merely exported', () => {
        // Without this the helper can be silently dropped from the page and
        // every assertion above stays green while /en serves Spanish again.
        const source = readFileSync(
            resolve(__dirname, '../../../src/pages/[lang]/destinos/[...path].astro'),
            'utf8'
        );
        expect(source).toContain(
            'const faqs = faqsInPageLanguage(toDestinationFaqs(dest.faqs, locale), locale);'
        );
    });
});
