/**
 * @file pricing.test.ts
 * @description Source-content tests for:
 * - precios/turistas.astro (tourist pricing page)
 * - precios/propietarios.astro (owner pricing page)
 * Validates structure, plan data fetching, PricingCard usage, FAQ,
 * CTA sections, JSON-LD, and semantic tokens.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const turistasSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/precios/turistas.astro'),
    'utf8'
);

const propietariosSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/precios/propietarios.astro'),
    'utf8'
);

// ---------------------------------------------------------------------------
// Shared helper for assertions common to both pricing pages
// ---------------------------------------------------------------------------

function describePricingPage(name: string, src: string): void {
    describe(`${name} — shared pricing page patterns`, () => {
        it('has prerender = true for SSG', () => {
            expect(src).toContain('export const prerender = true');
        });

        it('re-exports getStaticLocalePaths as getStaticPaths', () => {
            expect(src).toContain('getStaticLocalePaths as getStaticPaths');
        });

        it('uses BaseLayout', () => {
            expect(src).toContain('BaseLayout');
        });

        it('uses SEOHead', () => {
            expect(src).toContain('SEOHead');
        });

        it('imports PricingCard', () => {
            expect(src).toContain('PricingCard');
        });

        it('imports createT from i18n', () => {
            expect(src).toContain('createT');
        });

        it('imports Breadcrumb', () => {
            expect(src).toContain('Breadcrumb');
        });

        it('validates locale and redirects on failure', () => {
            expect(src).toContain('getLocaleFromParams(Astro.params)');
        });

        it('renders hero section with aria-labelledby', () => {
            expect(src).toContain('aria-labelledby="hero-title"');
        });

        it('renders hero h1 with id hero-title', () => {
            expect(src).toContain('id="hero-title"');
        });

        it('renders pricing plans grid with 3 columns', () => {
            expect(src).toContain('md:grid-cols-3');
        });

        it('renders PricingCard for each plan', () => {
            expect(src).toContain('<PricingCard');
        });

        it('renders FAQ heading with id faq-heading', () => {
            expect(src).toContain('id="faq-heading"');
        });

        it('renders CTA section with aria-labelledby', () => {
            expect(src).toContain('aria-labelledby="cta-title"');
        });

        it('does not use bg-white', () => {
            expect(src).not.toContain('bg-white');
        });

        it('does not use text-gray-', () => {
            expect(src).not.toContain('text-gray-');
        });

        it('uses semantic token text-foreground', () => {
            expect(src).toContain('text-foreground');
        });

        it('uses semantic token text-muted-foreground', () => {
            expect(src).toContain('text-muted-foreground');
        });
    });
}

// ---------------------------------------------------------------------------
// precios/turistas.astro
// ---------------------------------------------------------------------------

describePricingPage('precios/turistas.astro', turistasSrc);

describe('precios/turistas.astro — tourist pricing specifics', () => {
    it('imports fetchTouristPlans from pricing-plans lib', () => {
        expect(turistasSrc).toContain('fetchTouristPlans');
        expect(turistasSrc).toContain("from '../../../lib/pricing-plans'");
    });

    it('fetches tourist plans with locale', () => {
        expect(turistasSrc).toContain('await fetchTouristPlans(locale)');
    });

    it('renders inline FAQ items (not AccordionFAQ)', () => {
        expect(turistasSrc).toContain('faqItems.map');
        expect(turistasSrc).not.toContain('AccordionFAQ');
    });

    it('renders FAQ items from i18n', () => {
        expect(turistasSrc).toContain('billing.pricing.tourist.faq.items');
    });

    it('CTA links to signup page', () => {
        expect(turistasSrc).toContain('/auth/signup/');
    });

    it('uses billing.pricing.tourist i18n namespace', () => {
        expect(turistasSrc).toContain('billing.pricing.tourist');
    });

    it('includes precios breadcrumb segment', () => {
        expect(turistasSrc).toContain('precios');
    });
});

// ---------------------------------------------------------------------------
// precios/propietarios.astro
// ---------------------------------------------------------------------------

describePricingPage('precios/propietarios.astro', propietariosSrc);

describe('precios/propietarios.astro — owner pricing specifics', () => {
    it('imports fetchOwnerPlans from pricing-plans lib', () => {
        expect(propietariosSrc).toContain('fetchOwnerPlans');
        expect(propietariosSrc).toContain("from '../../../lib/pricing-plans'");
    });

    it('fetches owner plans with locale', () => {
        expect(propietariosSrc).toContain('await fetchOwnerPlans(locale)');
    });

    it('renders FAQ using AccordionFAQ component', () => {
        expect(propietariosSrc).toContain('AccordionFAQ');
    });

    it('filters out FAQ items with empty questions', () => {
        expect(propietariosSrc).toContain('.filter((item) => Boolean(item.question))');
    });

    it('renders FAQ section conditionally when items exist', () => {
        expect(propietariosSrc).toContain('faqItems.length > 0');
    });

    it('uses JsonLd component for BreadcrumbList structured data', () => {
        expect(propietariosSrc).toContain('JsonLd');
        expect(propietariosSrc).toContain("'BreadcrumbList'");
    });

    it('builds BreadcrumbList JSON-LD with correct schema context', () => {
        expect(propietariosSrc).toContain("'https://schema.org'");
        expect(propietariosSrc).toContain('ListItem');
    });

    it('renders GradientButton in CTA section', () => {
        expect(propietariosSrc).toContain('GradientButton');
    });

    it('CTA links to registro/propietario', () => {
        expect(propietariosSrc).toContain("path: 'registro/propietario'");
    });

    it('uses billing.pricing.owner i18n namespace', () => {
        expect(propietariosSrc).toContain('billing.pricing.owner');
    });

    it('imports HOME_BREADCRUMB for breadcrumb labels', () => {
        expect(propietariosSrc).toContain('HOME_BREADCRUMB');
    });

    it('builds breadcrumb with 3 levels including precios and propietarios', () => {
        expect(propietariosSrc).toContain("path: 'precios'");
        expect(propietariosSrc).toContain("path: 'precios/propietarios'");
    });
});
