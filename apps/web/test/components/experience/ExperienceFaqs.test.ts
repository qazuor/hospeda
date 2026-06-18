/**
 * @file ExperienceFaqs.test.ts
 * @description Source-read tests for ExperienceFaqs.astro (SPEC-240 T-030).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/experience/ExperienceFaqs.astro'),
    'utf8'
);

describe('ExperienceFaqs.astro', () => {
    describe('early return', () => {
        it('returns early (renders nothing) when faqs is empty', () => {
            expect(src).toContain('faqs.length === 0');
            expect(src).toContain('return;');
        });
    });

    describe('native HTML accordion', () => {
        it('uses <details> and <summary> elements for zero-JS accordion', () => {
            expect(src).toContain('<details');
            expect(src).toContain('<summary');
        });
    });

    describe('FAQ grouping', () => {
        it('groups FAQs by category', () => {
            expect(src).toContain('faq.category');
            expect(src).toContain('groups');
        });

        it('places "General" category at the end', () => {
            expect(src).toContain('generalLabel');
        });
    });

    describe('i18n', () => {
        it('uses experience.faq.heading i18n key for the section title', () => {
            expect(src).toContain('experience.faq.heading');
        });
    });

    describe('props', () => {
        it('accepts faqs as readonly DetailFaq array', () => {
            expect(src).toContain('readonly faqs: readonly DetailFaq[]');
        });

        it('accepts locale for i18n', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });
    });

    describe('CSS tokens', () => {
        it('uses scoped CSS with CSS custom properties', () => {
            expect(src).toContain('<style>');
            expect(src).toContain('var(--');
        });

        it('does not use Tailwind utility classes', () => {
            expect(src).not.toMatch(/class="[^"]*\b(text-|bg-|p-|m-|flex-|gap-)\w/);
        });
    });
});
