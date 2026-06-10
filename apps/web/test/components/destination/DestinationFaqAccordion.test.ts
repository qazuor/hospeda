/**
 * @file DestinationFaqAccordion.test.ts
 * @description Source-level assertions for the SPEC-158 destination FAQ
 * accordion. Astro components cannot be DOM-rendered in Vitest, so we assert
 * on the component source (per apps/web testing convention).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/destination/DestinationFaqAccordion.astro'),
    'utf8'
);

describe('DestinationFaqAccordion.astro', () => {
    it('consumes the shared DetailFaq type', () => {
        expect(src).toContain("import type { DetailFaq } from '@/data/types'");
        expect(src).toContain('readonly faqs: readonly DetailFaq[]');
    });

    it('renders nothing when there are no FAQs (no empty shell)', () => {
        expect(src).toContain('if (faqs.length === 0) return;');
    });

    it('is zero-JS: uses native details/summary', () => {
        expect(src).toContain('<details');
        expect(src).toContain('<summary');
        expect(src).not.toContain('client:');
    });

    it('groups FAQs by category with a localized General fallback placed last', () => {
        expect(src).toContain("t('destination.detail.faq.generalCategory', 'General')");
        expect(src).toContain('faq.category ?? generalLabel');
    });

    it('localizes the section title', () => {
        expect(src).toContain("t('destination.detail.faq.title'");
    });

    it('uses design tokens for typography and color', () => {
        expect(src).toContain('var(--font-heading)');
        expect(src).toContain('var(--core-foreground)');
    });
});
