import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ownerSrc = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/suscriptores/planes/comparar/index.astro'),
    'utf8'
);

const touristSrc = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/suscriptores/turistas/comparar/index.astro'),
    'utf8'
);

describe('Owner comparison page (suscriptores/planes/comparar/index.astro)', () => {
    it('should have prerender = false (SSR)', () => {
        expect(ownerSrc).toContain('prerender = false');
    });

    it('should set Cache-Control header', () => {
        expect(ownerSrc).toContain('Cache-Control');
        expect(ownerSrc).toContain('s-maxage');
    });

    it('should render PlanComparisonTable with audience="owner"', () => {
        expect(ownerSrc).toContain('PlanComparisonTable');
        expect(ownerSrc).toContain('audience="owner"');
    });

    it('should use MarketingHero', () => {
        expect(ownerSrc).toContain('MarketingHero');
    });

    it('should use MarketingLayout', () => {
        expect(ownerSrc).toContain('MarketingLayout');
    });

    it('should fetch owner + complex plans', () => {
        expect(ownerSrc).toContain('filterPlansByCategory');
        expect(ownerSrc).toContain("'owner'");
        expect(ownerSrc).toContain("'complex'");
    });

    it('should have CTA linking back to pricing cards page', () => {
        expect(ownerSrc).toContain('GradientButton');
        expect(ownerSrc).toContain('suscriptores/planes');
    });

    it('should use EmptyState for graceful degradation', () => {
        expect(ownerSrc).toContain('EmptyState');
    });

    it('should use CSS custom properties', () => {
        expect(ownerSrc).toContain('var(--');
    });
});

describe('Tourist comparison page (suscriptores/turistas/comparar/index.astro)', () => {
    it('should have prerender = false (SSR)', () => {
        expect(touristSrc).toContain('prerender = false');
    });

    it('should set Cache-Control header', () => {
        expect(touristSrc).toContain('Cache-Control');
        expect(touristSrc).toContain('s-maxage');
    });

    it('should render PlanComparisonTable with audience="tourist"', () => {
        expect(touristSrc).toContain('PlanComparisonTable');
        expect(touristSrc).toContain('audience="tourist"');
    });

    it('should use MarketingHero', () => {
        expect(touristSrc).toContain('MarketingHero');
    });

    it('should use MarketingLayout', () => {
        expect(touristSrc).toContain('MarketingLayout');
    });

    it('should fetch tourist plans only', () => {
        expect(touristSrc).toContain('filterPlansByCategory');
        expect(touristSrc).toContain("'tourist'");
        expect(touristSrc).not.toContain("'complex'");
    });

    it('should have CTA linking back to tourist pricing cards page', () => {
        expect(touristSrc).toContain('GradientButton');
        expect(touristSrc).toContain('suscriptores/turistas');
    });

    it('should use EmptyState for graceful degradation', () => {
        expect(touristSrc).toContain('EmptyState');
    });

    it('should use CSS custom properties', () => {
        expect(touristSrc).toContain('var(--');
    });
});

describe('Pricing pages comparison links', () => {
    const ownerPricingSrc = readFileSync(
        resolve(__dirname, '../../../src/pages/[lang]/suscriptores/planes/index.astro'),
        'utf8'
    );

    const touristPricingSrc = readFileSync(
        resolve(__dirname, '../../../src/pages/[lang]/suscriptores/turistas/index.astro'),
        'utf8'
    );

    it('owner pricing page should link to owner comparison page', () => {
        expect(ownerPricingSrc).toContain('suscriptores/planes/comparar');
        expect(ownerPricingSrc).toContain('pricing.comparison.link');
    });

    it('tourist pricing page should link to tourist comparison page', () => {
        expect(touristPricingSrc).toContain('suscriptores/turistas/comparar');
        expect(touristPricingSrc).toContain('pricing.comparison.link');
    });

    it('both pages should use GradientButton for the link', () => {
        expect(ownerPricingSrc).toContain('GradientButton');
        expect(touristPricingSrc).toContain('GradientButton');
    });
});
