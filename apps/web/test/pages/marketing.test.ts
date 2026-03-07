/**
 * @file marketing.test.ts
 * @description Source-content tests for marketing and informational pages:
 * - beneficios.astro (platform benefits page)
 * - quienes-somos.astro (about us page)
 * - propietarios/index.astro (property owners landing page)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const beneficiosSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/beneficios.astro'),
    'utf8'
);

const quienesSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/quienes-somos.astro'),
    'utf8'
);

const propietariosSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/propietarios/index.astro'),
    'utf8'
);

// ---------------------------------------------------------------------------
// Shared assertions for SSG marketing pages
// ---------------------------------------------------------------------------

function describeMarketingPage(name: string, src: string): void {
    describe(`${name} — shared marketing page patterns`, () => {
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

        it('uses createT for i18n', () => {
            expect(src).toContain('createT');
        });

        it('calls getLocaleFromParams for locale validation', () => {
            expect(src).toContain('getLocaleFromParams(Astro.params)');
        });

        it('renders Breadcrumb component', () => {
            expect(src).toContain('Breadcrumb');
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
// beneficios.astro — Platform benefits page
// ---------------------------------------------------------------------------

describeMarketingPage('beneficios.astro', beneficiosSrc);

describe('beneficios.astro — platform benefits page', () => {
    it('redirects to /es/beneficios/ on invalid locale', () => {
        expect(beneficiosSrc).toContain("Astro.redirect('/es/beneficios/')");
    });

    it('imports icons from @repo/icons', () => {
        expect(beneficiosSrc).toContain("from '@repo/icons'");
        expect(beneficiosSrc).toContain('HomeIcon');
        expect(beneficiosSrc).toContain('ShieldIcon');
        expect(beneficiosSrc).toContain('StarIcon');
    });

    it('imports GradientButton', () => {
        expect(beneficiosSrc).toContain('GradientButton');
    });

    it('defines touristBenefits array with 5 entries', () => {
        expect(beneficiosSrc).toContain('touristBenefits');
        const benefitMatches = (beneficiosSrc.match(/benefits\.tourists\./g) ?? []).length;
        expect(benefitMatches).toBeGreaterThanOrEqual(5);
    });

    it('defines ownerBenefits array with 5 entries', () => {
        expect(beneficiosSrc).toContain('ownerBenefits');
        const benefitMatches = (beneficiosSrc.match(/benefits\.owners\./g) ?? []).length;
        expect(benefitMatches).toBeGreaterThanOrEqual(5);
    });

    it('renders tourist benefits section with aria-labelledby', () => {
        expect(beneficiosSrc).toContain('aria-labelledby="tourist-benefits-heading"');
    });

    it('renders owner benefits section with aria-labelledby', () => {
        expect(beneficiosSrc).toContain('aria-labelledby="owner-benefits-heading"');
    });

    it('renders CTA section linking to pricing pages', () => {
        expect(beneficiosSrc).toContain("path: 'precios/turistas'");
        expect(beneficiosSrc).toContain("path: 'precios/propietarios'");
    });

    it('renders GradientButton in CTA section', () => {
        expect(beneficiosSrc).toContain('<GradientButton');
    });

    it('uses benefits i18n namespace', () => {
        expect(beneficiosSrc).toContain('benefits.page.title');
    });

    it('uses bg-primary/10 for icon backgrounds', () => {
        expect(beneficiosSrc).toContain('bg-primary/10');
    });
});

// ---------------------------------------------------------------------------
// quienes-somos.astro — About us page
// ---------------------------------------------------------------------------

describeMarketingPage('quienes-somos.astro', quienesSrc);

describe('quienes-somos.astro — about us page', () => {
    it('redirects to /es/quienes-somos/ on invalid locale', () => {
        expect(quienesSrc).toContain("Astro.redirect('/es/quienes-somos/')");
    });

    it('imports icons from @repo/icons', () => {
        expect(quienesSrc).toContain("from '@repo/icons'");
        expect(quienesSrc).toContain('CheckIcon');
        expect(quienesSrc).toContain('UsersIcon');
        expect(quienesSrc).toContain('GlobeIcon');
    });

    it('imports GradientButton', () => {
        expect(quienesSrc).toContain('GradientButton');
    });

    it('defines 4 company values', () => {
        const valueMatches = (quienesSrc.match(/about\.page\.values\./g) ?? []).length;
        expect(valueMatches).toBeGreaterThanOrEqual(4);
    });

    it('renders mission section with aria-labelledby', () => {
        expect(quienesSrc).toContain('aria-labelledby="mission-heading"');
    });

    it('renders values section with aria-labelledby', () => {
        expect(quienesSrc).toContain('aria-labelledby="values-heading"');
    });

    it('renders region section with aria-labelledby', () => {
        expect(quienesSrc).toContain('aria-labelledby="region-heading"');
    });

    it('renders contact CTA section linking to contacto', () => {
        expect(quienesSrc).toContain("path: 'contacto'");
        expect(quienesSrc).toContain('ctaButton');
    });

    it('uses about i18n namespace', () => {
        expect(quienesSrc).toContain('about.page.title');
    });

    it('renders section within rounded card using bg-card', () => {
        expect(quienesSrc).toContain('bg-card');
    });
});

// ---------------------------------------------------------------------------
// propietarios/index.astro — Property owners landing page
// ---------------------------------------------------------------------------

describeMarketingPage('propietarios/index.astro', propietariosSrc);

describe('propietarios/index.astro — owners landing page', () => {
    it('redirects to /es/propietarios/ on invalid locale', () => {
        expect(propietariosSrc).toContain("Astro.redirect('/es/propietarios/')");
    });

    it('imports icons from @repo/icons', () => {
        expect(propietariosSrc).toContain("from '@repo/icons'");
        expect(propietariosSrc).toContain('SearchIcon');
        expect(propietariosSrc).toContain('DashboardIcon');
        expect(propietariosSrc).toContain('StarIcon');
    });

    it('imports static owners page data', () => {
        expect(propietariosSrc).toContain('OWNER_HERO');
        expect(propietariosSrc).toContain('OWNER_BENEFITS');
        expect(propietariosSrc).toContain('OWNER_HOW_IT_WORKS');
        expect(propietariosSrc).toContain('OWNER_FAQ');
        expect(propietariosSrc).toContain('OWNER_FINAL_CTA');
        expect(propietariosSrc).toContain("from '../../../lib/owners-page-data'");
    });

    it('imports GradientButton', () => {
        expect(propietariosSrc).toContain('GradientButton');
    });

    it('imports AccordionFAQ', () => {
        expect(propietariosSrc).toContain('AccordionFAQ');
    });

    it('reads locale-specific data from owners page data modules', () => {
        expect(propietariosSrc).toContain('OWNER_HERO[locale]');
        expect(propietariosSrc).toContain('OWNER_BENEFITS[locale]');
        expect(propietariosSrc).toContain('OWNER_HOW_IT_WORKS[locale]');
        expect(propietariosSrc).toContain('OWNER_FAQ[locale]');
        expect(propietariosSrc).toContain('OWNER_FINAL_CTA[locale]');
    });

    it('generates FAQPage JSON-LD structured data', () => {
        expect(propietariosSrc).toContain("'FAQPage'");
        expect(propietariosSrc).toContain("'Question'");
        expect(propietariosSrc).toContain("'Answer'");
    });

    it('injects JSON-LD via script tag in head slot', () => {
        expect(propietariosSrc).toContain('type="application/ld+json"');
        expect(propietariosSrc).toContain('set:html={JSON.stringify(faqJsonLd)}');
        expect(propietariosSrc).toContain('slot="head"');
    });

    it('renders hero section with aria-labelledby', () => {
        expect(propietariosSrc).toContain('aria-labelledby="hero-heading"');
    });

    it('renders benefits section with aria-labelledby', () => {
        expect(propietariosSrc).toContain('aria-labelledby="benefits-heading"');
    });

    it('renders how-it-works section as ordered list', () => {
        expect(propietariosSrc).toContain('<ol');
        expect(propietariosSrc).toContain('aria-labelledby="how-it-works-heading"');
    });

    it('renders FAQ section using AccordionFAQ', () => {
        expect(propietariosSrc).toContain('<AccordionFAQ');
        expect(propietariosSrc).toContain('items={faq.faqs}');
    });

    it('renders final CTA with gradient background', () => {
        expect(propietariosSrc).toContain('bg-gradient-to-r');
    });

    it('renders two CTA buttons in hero and final CTA', () => {
        expect(propietariosSrc).toContain('hero.ctaPrimary');
        expect(propietariosSrc).toContain('hero.ctaSecondary');
    });

    it('primary CTA links to auth/signup', () => {
        expect(propietariosSrc).toContain("path: 'auth/signup'");
    });

    it('secondary CTA links to precios/propietarios', () => {
        expect(propietariosSrc).toContain("path: 'precios/propietarios'");
    });
});
