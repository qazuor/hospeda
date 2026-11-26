import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('experience FAQ', () => {
    it('uses the shared disclosure, localized separately', () => {
        const path = '../../../src/components/experience/ExperienceFaqs.astro';

        const source = readFileSync(new URL(path, import.meta.url), 'utf8');

        expect(source).toContain('@/components/shared/ui/FaqAccordion.astro');
        expect(source).toContain("title={t('experience.faq.heading')}");
        expect(source).toContain('groups={groupDetailFaqs({ faqs, locale }).groups}');
    });
});
