/**
 * @file faq-jsonld-sections.test.ts
 * @description `buildFaqJsonLdSections` and its wiring on the three listing
 * detail pages (HOS-2579 §6.6, AC-22).
 *
 * `.astro` pages cannot be rendered under Vitest in this repo (see
 * apps/web/CLAUDE.md), so the mapping is tested for real on the pure helper,
 * and the pages are checked at source level: they build the sections with this
 * helper and mount ONE `FAQPageJsonLd` in `head-extra`, guarded by
 * `faqSections.length > 0`. What the source check cannot see: that the page's
 * `faqs` value is the same list the FAQ block renders at runtime.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFaqJsonLdSections } from '../../../src/lib/seo/faq-jsonld-sections';

const PAGES = resolve(__dirname, '../../../src/pages/[lang]');

function faq(question: string, answer: string, resolvedLocale?: 'es' | 'en' | 'pt') {
    return { question, answer, ...(resolvedLocale ? { resolvedLocale } : {}) };
}

describe('buildFaqJsonLdSections (HOS-2579 AC-22)', () => {
    it('maps 2 FAQs to 2 Q/A sections in the page locale', () => {
        // Arrange
        const faqs = [
            faq('¿Hay estacionamiento?', 'Sí.', 'en'),
            faq('¿Aceptan mascotas?', 'No.', 'en')
        ];

        // Act
        const result = buildFaqJsonLdSections({ faqs, locale: 'en' });

        // Assert
        expect(result).toStrictEqual({
            sections: [
                { heading: '¿Hay estacionamiento?', body: 'Sí.' },
                { heading: '¿Aceptan mascotas?', body: 'No.' }
            ],
            inLanguage: 'en'
        });
    });

    it('returns no sections for 0 FAQs, so the page renders no FAQPage', () => {
        // Act
        const result = buildFaqJsonLdSections({ faqs: [], locale: 'es' });

        // Assert
        expect(result.sections).toStrictEqual([]);
    });

    it('declares es when any FAQ text is not in the page locale (HOS-117)', () => {
        // Arrange
        const faqs = [faq('Q1', 'A1', 'pt'), faq('Q2', 'A2', 'es')];

        // Act
        const result = buildFaqJsonLdSections({ faqs, locale: 'pt' });

        // Assert
        expect(result.inLanguage).toBe('es');
    });

    it('declares es for fallback FAQs without a resolved locale', () => {
        // Act
        const result = buildFaqJsonLdSections({ faqs: [faq('Q', 'A')], locale: 'en' });

        // Assert
        expect(result.inLanguage).toBe('es');
    });

    it('drops FAQs whose question or answer is blank', () => {
        // Arrange
        const faqs = [faq('Q1', 'A1', 'es'), faq('  ', 'A2', 'es'), faq('Q3', '', 'es')];

        // Act
        const result = buildFaqJsonLdSections({ faqs, locale: 'es' });

        // Assert
        expect(result.sections).toStrictEqual([{ heading: 'Q1', body: 'A1' }]);
        expect(result.inLanguage).toBe('es');
    });
});

describe.each([
    ['accommodation', 'alojamientos/[slug].astro'],
    ['venue', 'comer-y-salir/[slug].astro'],
    ['experience', 'experiencias/[slug].astro']
])('%s detail page FAQPage JSON-LD wiring (HOS-2579 AC-22)', (_vertical, file) => {
    const src = readFileSync(resolve(PAGES, file), 'utf8');

    it('builds the sections with the shared helper', () => {
        expect(src).toContain(
            "import { buildFaqJsonLdSections } from '@/lib/seo/faq-jsonld-sections';"
        );
        expect(src).toMatch(
            /const \{ sections: faqSections, inLanguage: faqInLanguage \} = buildFaqJsonLdSections\(\{/
        );
    });

    it('mounts exactly one FAQPageJsonLd in head-extra, only when there are sections', () => {
        expect(src.match(/<FAQPageJsonLd\b/g)).toHaveLength(1);
        expect(src).toMatch(
            /\{faqSections\.length > 0 && \(?\s*<FAQPageJsonLd slot="head-extra" sections=\{faqSections\} inLanguage=\{faqInLanguage\} \/>/
        );
    });
});
