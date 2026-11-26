import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (file: string) => readFileSync(resolve(__dirname, '../../../src', file), 'utf8');

describe('tourist landing presentation', () => {
    it('fills all hero icon slots while keeping the flat accent CTA', () => {
        const page = source('pages/[lang]/planes/turistas/index.astro');
        for (const slot of ['icon-1', 'icon-2', 'icon-3']) expect(page).toContain(`slot="${slot}"`);
        expect(page).toContain('variant="accent"');
        expect(page).toContain('flat');
    });

    it('decorates inline accent text, including wrapped lines', () => {
        const hero = source('components/marketing/MarketingHero.astro');
        expect(hero).toContain('box-decoration-break: clone');
        expect(hero).toContain('text-decoration-color: var(--brand-accent)');
        expect(hero).not.toContain('<svg');
    });

    it('limits auto-fit to three columns so five benefits balance as three plus two', () => {
        expect(source('components/marketing/BenefitsSection.astro')).toContain(
            'max-width: calc((100% - 2 * var(--space-card-gap)) / 3)'
        );
    });

    it('uses the shared native disclosure with decorative open and closed icons', () => {
        const faq = source('components/marketing/FaqSection.astro');
        const shared = source('components/shared/ui/FaqAccordion.astro');
        expect(faq).toContain('<FaqAccordion');
        expect(shared).toContain('<summary>');
        expect(shared).toContain('<AddIcon');
        expect(shared).toContain('<MinusIcon');
    });
});
