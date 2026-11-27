import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupDetailFaqs } from '@/lib/faq/groups';

describe('destination FAQ', () => {
    it('forwards the grouped answers to the shared disclosure with the destination title', () => {
        const path = '../../../src/components/destination/DestinationFaqAccordion.astro';

        const source = readFileSync(new URL(path, import.meta.url), 'utf8');

        expect(source).toContain('@/components/shared/ui/FaqAccordion.astro');
        expect(source).toContain("title={t('destinations.detail.faq.title')}");
        expect(source).toContain('groups={groupDetailFaqs({ faqs, locale }).groups}');
    });

    it('preserves answer text and does not count blank categories as named', () => {
        const faqs = [
            { question: 'How?', answer: 'By bus', category: ' Transport ' },
            { question: 'When?', answer: 'In spring', category: ' ' },
            { question: 'Where?', answer: 'Downtown', category: null }
        ];

        const { groups } = groupDetailFaqs({ faqs, locale: 'en' });

        expect(groups).toEqual([
            { title: 'Transport', items: [faqs[0]] },
            { title: '', items: faqs.slice(1) }
        ]);
    });
});
