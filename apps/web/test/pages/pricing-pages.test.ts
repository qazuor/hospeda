/**
 * Tests for pricing pages (turistas and propietarios) and the pricing-plans module.
 * Verifies page structure, SEO elements, localization, pricing plans, and CTA sections.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const turistasPath = resolve(__dirname, '../../src/pages/[lang]/precios/turistas.astro');
const turistasContent = readFileSync(turistasPath, 'utf8');

const propietariosPath = resolve(__dirname, '../../src/pages/[lang]/precios/propietarios.astro');
const propietariosContent = readFileSync(propietariosPath, 'utf8');

const pricingPlansPath = resolve(__dirname, '../../src/lib/pricing-plans.ts');
const pricingPlansContent = readFileSync(pricingPlansPath, 'utf8');

const pricingFallbacksPath = resolve(__dirname, '../../src/lib/pricing-fallbacks.ts');
const pricingFallbacksContent = readFileSync(pricingFallbacksPath, 'utf8');

describe('turistas.astro (Tourist Pricing Page)', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(turistasContent).toContain(
                "import BaseLayout from '../../../layouts/BaseLayout.astro'"
            );
            expect(turistasContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(turistasContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(turistasContent).toContain('<SEOHead');
        });

        it('should use Breadcrumb component', () => {
            expect(turistasContent).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
            expect(turistasContent).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('should use Container component', () => {
            expect(turistasContent).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(turistasContent).toContain('<Container>');
        });

        it('should use Section component', () => {
            expect(turistasContent).toContain(
                "import Section from '../../../components/ui/Section.astro'"
            );
            expect(turistasContent).toContain('<Section>');
        });

        it('should use PricingCard component', () => {
            expect(turistasContent).toContain(
                "import PricingCard from '../../../components/content/PricingCard.astro'"
            );
            expect(turistasContent).toContain('<PricingCard');
        });
    });

    describe('Rendering Strategy (SSG)', () => {
        it('should enable prerendering', () => {
            expect(turistasContent).toContain('export const prerender = true;');
        });

        it('should export getStaticPaths via page-helpers', () => {
            expect(turistasContent).toContain('getStaticLocalePaths as getStaticPaths');
        });

        it('should import from page-helpers', () => {
            expect(turistasContent).toContain("from '../../../lib/page-helpers'");
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(turistasContent).toContain('getLocaleFromParams(Astro.params)');
            expect(turistasContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(turistasContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(turistasContent).toContain('getLocaleFromParams');
            expect(turistasContent).toContain('import { t } from');
        });
    });

    describe('Pricing plans import', () => {
        it('should import fetchTouristPlans from pricing-plans module', () => {
            expect(turistasContent).toContain(
                "import { fetchTouristPlans } from '../../../lib/pricing-plans'"
            );
        });

        it('should call fetchTouristPlans with locale', () => {
            expect(turistasContent).toContain('await fetchTouristPlans(locale)');
        });

        it('should store result in currentPlans variable', () => {
            expect(turistasContent).toContain(
                'const currentPlans = await fetchTouristPlans(locale)'
            );
        });

        it('should map currentPlans to PricingCard components', () => {
            expect(turistasContent).toContain('currentPlans.map((plan) =>');
            expect(turistasContent).toContain('<PricingCard');
        });

        it('should pass plan props to PricingCard', () => {
            expect(turistasContent).toContain('plan={{');
            expect(turistasContent).toContain('name: plan.name,');
            expect(turistasContent).toContain('price: plan.price,');
            expect(turistasContent).toContain('currency: plan.currency,');
            expect(turistasContent).toContain('period: plan.period,');
            expect(turistasContent).toContain('features: plan.features,');
            expect(turistasContent).toContain('cta: plan.cta,');
        });

        it('should pass highlighted prop to PricingCard', () => {
            expect(turistasContent).toContain('highlighted={plan.highlighted}');
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(turistasContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.tourist.title' })"
            );
        });

        it('should have localized meta descriptions', () => {
            expect(turistasContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.tourist.description' })"
            );
        });

        it('should import HOME_BREADCRUMB from page-helpers', () => {
            expect(turistasContent).toContain('HOME_BREADCRUMB');
            expect(turistasContent).toContain("from '../../../lib/page-helpers'");
        });

        it('should have localized pricing breadcrumb labels', () => {
            expect(turistasContent).toContain('pricingBreadcrumb');
            expect(turistasContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.breadcrumb' })"
            );
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(turistasContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(turistasContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(turistasContent).toContain('title={pageTitle}');
            expect(turistasContent).toContain('description={pageDescription}');
        });

        it('should set page type to website', () => {
            expect(turistasContent).toContain('type="website"');
        });

        it('should pass locale to SEOHead', () => {
            expect(turistasContent).toContain('locale={locale}');
        });

        it('should use slot="head" for SEOHead', () => {
            expect(turistasContent).toContain('slot="head"');
        });
    });

    describe('Breadcrumb navigation', () => {
        it('should create breadcrumb items array', () => {
            expect(turistasContent).toContain('const breadcrumbItems = [');
        });

        it('should have home breadcrumb link', () => {
            expect(turistasContent).toContain(
                '{ label: HOME_BREADCRUMB[locale], href: `/${locale}/`'
            );
        });

        it('should have pricing breadcrumb link', () => {
            expect(turistasContent).toContain(
                '{ label: pricingBreadcrumb, href: `/${locale}/precios/`'
            );
        });

        it('should have tourist pricing breadcrumb', () => {
            expect(turistasContent).toContain(
                '{ label: pageTitle, href: `/${locale}/precios/turistas/`'
            );
        });
    });

    describe('Content sections', () => {
        it('should have hero section', () => {
            expect(turistasContent).toContain('id="hero"');
        });

        it('should have pricing plans section', () => {
            expect(turistasContent).toContain('id="pricing-plans"');
        });

        it('should have FAQ section', () => {
            expect(turistasContent).toContain('id="faq"');
            expect(turistasContent).toContain('{faqHeading}');
        });

        it('should have CTA section', () => {
            expect(turistasContent).toContain('id="cta-section"');
        });
    });

    describe('Hero section content', () => {
        it('should have localized hero content structure', () => {
            expect(turistasContent).toContain('heroTitle');
            expect(turistasContent).toContain('heroDescription');
        });

        it('should have hero title from i18n', () => {
            expect(turistasContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.tourist.hero.title' })"
            );
        });

        it('should have hero description from i18n', () => {
            expect(turistasContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.tourist.hero.description' })"
            );
        });

        it('should render h1 with hero title', () => {
            expect(turistasContent).toContain('{heroTitle}');
        });

        it('should render hero description', () => {
            expect(turistasContent).toContain('{heroDescription}');
        });
    });

    describe('FAQ content', () => {
        it('should have FAQ questions and answers typed', () => {
            expect(turistasContent).toContain('faqItems');
            expect(turistasContent).toContain('question:');
            expect(turistasContent).toContain('answer:');
        });

        it('should have FAQ items from i18n', () => {
            expect(turistasContent).toContain(
                "t({ locale, namespace: 'billing', key: `pricing.tourist.faq.items.${i}.question` })"
            );
        });

        it('should build faqItems array from i18n keys', () => {
            expect(turistasContent).toContain('[0, 1, 2].map((i) =>');
        });

        it('should render FAQ items from faqItems', () => {
            expect(turistasContent).toContain('faqItems.map((faq) =>');
            expect(turistasContent).toContain('{faq.question}');
            expect(turistasContent).toContain('{faq.answer}');
        });
    });

    describe('CTA section', () => {
        it('should have CTA content from i18n', () => {
            expect(turistasContent).toContain('ctaButton');
            expect(turistasContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.tourist.cta.button' })"
            );
        });

        it('should have CTA title from i18n', () => {
            expect(turistasContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.tourist.cta.title' })"
            );
        });

        it('should have CTA description from i18n', () => {
            expect(turistasContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.tourist.cta.description' })"
            );
        });

        it('should link to registration page', () => {
            expect(turistasContent).toContain('href={`/${locale}/registro/`}');
        });

        it('should render CTA button text', () => {
            expect(turistasContent).toContain('{ctaButton}');
        });
    });

    describe('Styling', () => {
        it('should have main heading with proper styling', () => {
            expect(turistasContent).toContain('text-4xl font-bold');
            expect(turistasContent).toContain('md:text-5xl');
        });

        it('should have grid layout for pricing cards', () => {
            expect(turistasContent).toContain('grid gap-8 md:grid-cols-3');
        });

        it('should have section headings with semibold styling', () => {
            expect(turistasContent).toContain('text-3xl font-semibold');
        });
    });

    describe('File size', () => {
        it('should be under 500 lines', () => {
            const lines = turistasContent.split('\n').length;
            expect(lines).toBeLessThan(500);
        });
    });
});

describe('propietarios.astro (Owner Pricing Page)', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(propietariosContent).toContain(
                "import BaseLayout from '../../../layouts/BaseLayout.astro'"
            );
            expect(propietariosContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(propietariosContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(propietariosContent).toContain('<SEOHead');
        });

        it('should use Breadcrumb component', () => {
            expect(propietariosContent).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
            expect(propietariosContent).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('should use Container component', () => {
            expect(propietariosContent).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(propietariosContent).toContain('<Container>');
        });

        it('should use Section component', () => {
            expect(propietariosContent).toContain(
                "import Section from '../../../components/ui/Section.astro'"
            );
            expect(propietariosContent).toContain('<Section>');
        });

        it('should use PricingCard component', () => {
            expect(propietariosContent).toContain(
                "import PricingCard from '../../../components/content/PricingCard.astro'"
            );
            expect(propietariosContent).toContain('<PricingCard');
        });
    });

    describe('Rendering Strategy (SSG)', () => {
        it('should enable prerendering', () => {
            expect(propietariosContent).toContain('export const prerender = true;');
        });

        it('should export getStaticPaths via page-helpers', () => {
            expect(propietariosContent).toContain('getStaticLocalePaths as getStaticPaths');
        });

        it('should import from page-helpers', () => {
            expect(propietariosContent).toContain("from '../../../lib/page-helpers'");
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(propietariosContent).toContain('getLocaleFromParams(Astro.params)');
            expect(propietariosContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(propietariosContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(propietariosContent).toContain('getLocaleFromParams');
            expect(propietariosContent).toContain('import { t } from');
        });
    });

    describe('Pricing plans import', () => {
        it('should import fetchOwnerPlans from pricing-plans module', () => {
            expect(propietariosContent).toContain(
                "import { fetchOwnerPlans } from '../../../lib/pricing-plans'"
            );
        });

        it('should call fetchOwnerPlans with locale', () => {
            expect(propietariosContent).toContain('await fetchOwnerPlans(locale)');
        });

        it('should store result in currentPlans variable', () => {
            expect(propietariosContent).toContain(
                'const currentPlans = await fetchOwnerPlans(locale)'
            );
        });

        it('should map currentPlans to PricingCard components', () => {
            expect(propietariosContent).toContain('currentPlans.map((plan) =>');
            expect(propietariosContent).toContain('<PricingCard');
        });

        it('should pass plan props to PricingCard', () => {
            expect(propietariosContent).toContain('plan={{');
            expect(propietariosContent).toContain('name: plan.name,');
            expect(propietariosContent).toContain('price: plan.price,');
            expect(propietariosContent).toContain('currency: plan.currency,');
            expect(propietariosContent).toContain('period: plan.period,');
            expect(propietariosContent).toContain('features: plan.features,');
            expect(propietariosContent).toContain('cta: plan.cta,');
        });

        it('should pass highlighted prop to PricingCard', () => {
            expect(propietariosContent).toContain('highlighted={plan.highlighted}');
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(propietariosContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.owner.title' })"
            );
        });

        it('should have localized meta descriptions', () => {
            expect(propietariosContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.owner.description' })"
            );
        });

        it('should import HOME_BREADCRUMB from page-helpers', () => {
            expect(propietariosContent).toContain('HOME_BREADCRUMB');
            expect(propietariosContent).toContain("from '../../../lib/page-helpers'");
        });

        it('should have localized pricing breadcrumb labels', () => {
            expect(propietariosContent).toContain('pricingBreadcrumb');
            expect(propietariosContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.breadcrumb' })"
            );
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(propietariosContent).toContain(
                'const canonicalUrl = new URL(Astro.url.pathname'
            );
            expect(propietariosContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(propietariosContent).toContain('title={pageTitle}');
            expect(propietariosContent).toContain('description={pageDescription}');
        });

        it('should set page type to website', () => {
            expect(propietariosContent).toContain('type="website"');
        });

        it('should pass locale to SEOHead', () => {
            expect(propietariosContent).toContain('locale={locale}');
        });

        it('should use slot="head" for SEOHead', () => {
            expect(propietariosContent).toContain('slot="head"');
        });
    });

    describe('Breadcrumb navigation', () => {
        it('should create breadcrumb items array', () => {
            expect(propietariosContent).toContain('const breadcrumbItems = [');
        });

        it('should have home breadcrumb link', () => {
            expect(propietariosContent).toContain(
                '{ label: HOME_BREADCRUMB[locale], href: `/${locale}/`'
            );
        });

        it('should have pricing breadcrumb link', () => {
            expect(propietariosContent).toContain(
                '{ label: pricingBreadcrumb, href: `/${locale}/precios/`'
            );
        });

        it('should have owner pricing breadcrumb', () => {
            expect(propietariosContent).toContain(
                '{ label: pageTitle, href: `/${locale}/precios/propietarios/`'
            );
        });
    });

    describe('Content sections', () => {
        it('should have hero section', () => {
            expect(propietariosContent).toContain('id="hero"');
        });

        it('should have pricing plans section', () => {
            expect(propietariosContent).toContain('id="pricing-plans"');
        });

        it('should have FAQ section', () => {
            expect(propietariosContent).toContain('id="faq"');
            expect(propietariosContent).toContain('{faqHeading}');
        });

        it('should have CTA section', () => {
            expect(propietariosContent).toContain('id="cta-section"');
        });
    });

    describe('Hero section content', () => {
        it('should have localized hero content structure', () => {
            expect(propietariosContent).toContain('heroTitle');
            expect(propietariosContent).toContain('heroDescription');
        });

        it('should have hero title from i18n', () => {
            expect(propietariosContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.owner.hero.title' })"
            );
        });

        it('should have hero description from i18n', () => {
            expect(propietariosContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.owner.hero.description' })"
            );
        });

        it('should render h1 with hero title', () => {
            expect(propietariosContent).toContain('{heroTitle}');
        });

        it('should render hero description', () => {
            expect(propietariosContent).toContain('{heroDescription}');
        });
    });

    describe('FAQ content', () => {
        it('should have FAQ questions and answers typed', () => {
            expect(propietariosContent).toContain('faqItems');
            expect(propietariosContent).toContain('question:');
            expect(propietariosContent).toContain('answer:');
        });

        it('should have FAQ items from i18n', () => {
            expect(propietariosContent).toContain(
                "t({ locale, namespace: 'billing', key: `pricing.owner.faq.items.${i}.question` })"
            );
        });

        it('should build faqItems array from i18n keys', () => {
            expect(propietariosContent).toContain('[0, 1, 2].map((i) =>');
        });

        it('should render FAQ items from faqItems', () => {
            expect(propietariosContent).toContain('faqItems.map((faq) =>');
            expect(propietariosContent).toContain('{faq.question}');
            expect(propietariosContent).toContain('{faq.answer}');
        });
    });

    describe('CTA section', () => {
        it('should have CTA content from i18n', () => {
            expect(propietariosContent).toContain('ctaButton');
            expect(propietariosContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.owner.cta.button' })"
            );
        });

        it('should have CTA title from i18n', () => {
            expect(propietariosContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.owner.cta.title' })"
            );
        });

        it('should have CTA description from i18n', () => {
            expect(propietariosContent).toContain(
                "t({ locale, namespace: 'billing', key: 'pricing.owner.cta.description' })"
            );
        });

        it('should link to owner registration page', () => {
            expect(propietariosContent).toContain('href={`/${locale}/registro/propietario/`}');
        });

        it('should render CTA button text', () => {
            expect(propietariosContent).toContain('{ctaButton}');
        });
    });

    describe('Styling', () => {
        it('should have main heading with proper styling', () => {
            expect(propietariosContent).toContain('text-4xl font-bold');
            expect(propietariosContent).toContain('md:text-5xl');
        });

        it('should have grid layout for pricing cards', () => {
            expect(propietariosContent).toContain('grid gap-8 md:grid-cols-3');
        });

        it('should have section headings with semibold styling', () => {
            expect(propietariosContent).toContain('text-3xl font-semibold');
        });
    });

    describe('File size', () => {
        it('should be under 500 lines', () => {
            const lines = propietariosContent.split('\n').length;
            expect(lines).toBeLessThan(500);
        });
    });
});

describe('pricing-plans.ts (Pricing Plans Module)', () => {
    describe('Exports', () => {
        it('should export PricingPlan interface', () => {
            expect(pricingPlansContent).toContain('export interface PricingPlan');
        });

        it('should re-export TOURIST_FALLBACK_PLANS', () => {
            expect(pricingPlansContent).toContain('TOURIST_FALLBACK_PLANS');
        });

        it('should re-export OWNER_FALLBACK_PLANS', () => {
            expect(pricingPlansContent).toContain('OWNER_FALLBACK_PLANS');
        });

        it('should export fetchTouristPlans function', () => {
            expect(pricingPlansContent).toContain('export async function fetchTouristPlans');
        });

        it('should export fetchOwnerPlans function', () => {
            expect(pricingPlansContent).toContain('export async function fetchOwnerPlans');
        });
    });

    describe('PricingPlan interface', () => {
        it('should have readonly name field', () => {
            expect(pricingPlansContent).toContain('readonly name: string');
        });

        it('should have readonly price field', () => {
            expect(pricingPlansContent).toContain('readonly price: number');
        });

        it('should have readonly currency field', () => {
            expect(pricingPlansContent).toContain('readonly currency: string');
        });

        it('should have readonly period field', () => {
            expect(pricingPlansContent).toContain('readonly period: string');
        });

        it('should have readonly features array', () => {
            expect(pricingPlansContent).toContain('readonly features: readonly string[]');
        });

        it('should have readonly cta object with label and href', () => {
            expect(pricingPlansContent).toContain(
                'readonly cta: { readonly label: string; readonly href: string }'
            );
        });

        it('should have optional highlighted field', () => {
            expect(pricingPlansContent).toContain('readonly highlighted?: boolean');
        });
    });

    describe('Imports', () => {
        it('should import SupportedLocale type', () => {
            expect(pricingPlansContent).toContain("import type { SupportedLocale } from './i18n'");
        });

        it('should import plansApi from endpoints', () => {
            expect(pricingPlansContent).toContain(
                "import { plansApi } from './api/endpoints-protected'"
            );
        });

        it('should import fallback data from pricing-fallbacks', () => {
            expect(pricingPlansContent).toContain("from './pricing-fallbacks'");
        });
    });

    describe('Tourist Fallback Plans (pricing-fallbacks.ts)', () => {
        it('should have fallback plans for all 3 locales', () => {
            expect(pricingFallbacksContent).toContain('Record<SupportedLocale, PricingPlan[]>');
        });

        it('should have Free/Gratis plan', () => {
            expect(pricingFallbacksContent).toContain("name: 'Gratis'");
            expect(pricingFallbacksContent).toContain("name: 'Free'");
            expect(pricingFallbacksContent).toContain("name: 'Grátis'");
            expect(pricingFallbacksContent).toContain('price: 0');
        });

        it('should have Plus plan', () => {
            expect(pricingFallbacksContent).toContain("name: 'Plus'");
            expect(pricingFallbacksContent).toContain('price: 5000');
            expect(pricingFallbacksContent).toContain('price: 5,');
        });

        it('should have VIP plan', () => {
            expect(pricingFallbacksContent).toContain("name: 'VIP'");
            expect(pricingFallbacksContent).toContain('price: 15000');
            expect(pricingFallbacksContent).toContain('price: 15,');
        });

        it('should have VIP plan highlighted', () => {
            expect(pricingFallbacksContent).toContain('highlighted: true');
        });

        it('should have tourist features in Spanish', () => {
            expect(pricingFallbacksContent).toContain('Navegar alojamientos');
            expect(pricingFallbacksContent).toContain('Leer reseñas');
            expect(pricingFallbacksContent).toContain('Servicio de conserjería');
        });

        it('should have tourist features in English', () => {
            expect(pricingFallbacksContent).toContain('Browse accommodations');
            expect(pricingFallbacksContent).toContain('Read reviews');
            expect(pricingFallbacksContent).toContain('Concierge service');
        });

        it('should have ARS currency for es locale', () => {
            expect(pricingFallbacksContent).toContain("currency: 'ARS'");
        });

        it('should have USD currency for en locale', () => {
            expect(pricingFallbacksContent).toContain("currency: 'USD'");
        });

        it('should have CTA links for tourist plans', () => {
            expect(pricingFallbacksContent).toContain("label: 'Comenzar Gratis'");
            expect(pricingFallbacksContent).toContain("label: 'Start Free'");
        });
    });

    describe('Owner Fallback Plans (pricing-fallbacks.ts)', () => {
        it('should have Basico/Basic plan', () => {
            expect(pricingFallbacksContent).toContain("name: 'Basico'");
            expect(pricingFallbacksContent).toContain("name: 'Basic'");
            expect(pricingFallbacksContent).toContain("name: 'Básico'");
            expect(pricingFallbacksContent).toContain('price: 15000');
            expect(pricingFallbacksContent).toContain('price: 15,');
        });

        it('should have Profesional/Professional plan', () => {
            expect(pricingFallbacksContent).toContain("name: 'Profesional'");
            expect(pricingFallbacksContent).toContain("name: 'Professional'");
            expect(pricingFallbacksContent).toContain("name: 'Profissional'");
            expect(pricingFallbacksContent).toContain('price: 35000');
            expect(pricingFallbacksContent).toContain('price: 35,');
        });

        it('should have Premium plan', () => {
            expect(pricingFallbacksContent).toContain("name: 'Premium'");
            expect(pricingFallbacksContent).toContain('price: 75000');
            expect(pricingFallbacksContent).toContain('price: 75,');
        });

        it('should have Professional plan highlighted', () => {
            expect(pricingFallbacksContent).toContain('highlighted: true');
        });

        it('should have owner features in Spanish', () => {
            expect(pricingFallbacksContent).toContain('1 propiedad en listado');
            expect(pricingFallbacksContent).toContain('Análisis básicos');
            expect(pricingFallbacksContent).toContain('Gestor de cuenta');
        });

        it('should have owner features in English', () => {
            expect(pricingFallbacksContent).toContain('1 property listing');
            expect(pricingFallbacksContent).toContain('Basic analytics');
            expect(pricingFallbacksContent).toContain('Account manager');
        });

        it('should have CTA links for owner plans', () => {
            expect(pricingFallbacksContent).toContain("label: 'Comenzar Basico'");
            expect(pricingFallbacksContent).toContain("label: 'Start Basic'");
        });
    });

    describe('Locale Config', () => {
        it('should define LOCALE_CONFIG with currency and period per locale', () => {
            expect(pricingPlansContent).toContain('LOCALE_CONFIG');
            expect(pricingPlansContent).toContain('Record<');
            expect(pricingPlansContent).toContain('SupportedLocale,');
        });

        it('should have ARS currency for es locale in config', () => {
            expect(pricingPlansContent).toContain("es: { currency: 'ARS', period: '/mes' }");
        });

        it('should have USD currency for en locale in config', () => {
            expect(pricingPlansContent).toContain("en: { currency: 'USD', period: '/month' }");
        });

        it('should have ARS currency for pt locale in config', () => {
            expect(pricingPlansContent).toContain("pt: { currency: 'ARS', period: '/mês' }");
        });
    });

    describe('fetchTouristPlans function', () => {
        it('should call plansApi.list()', () => {
            expect(pricingPlansContent).toContain('await plansApi.list()');
        });

        it('should return fallback on API failure', () => {
            expect(pricingPlansContent).toContain('return TOURIST_FALLBACK_PLANS[locale]');
        });

        it('should filter plans by tourist category', () => {
            expect(pricingPlansContent).toContain(
                "filterByCategory(extractItems(result.data), 'tourist')"
            );
        });

        it('should return fallback when no plans found', () => {
            expect(pricingPlansContent).toContain(
                'if (plans.length === 0) return TOURIST_FALLBACK_PLANS[locale]'
            );
        });

        it('should sort plans by order', () => {
            expect(pricingPlansContent).toContain('const sorted = sortByOrder(plans)');
        });

        it('should map API plans to card format', () => {
            expect(pricingPlansContent).toContain('sorted.map((plan, idx) =>');
            expect(pricingPlansContent).toContain('mapApiPlanToCard(');
        });

        it('should have try-catch for error handling', () => {
            expect(pricingPlansContent).toContain('try {');
            expect(pricingPlansContent).toContain('} catch {');
        });

        it('should accept locale parameter', () => {
            expect(pricingPlansContent).toContain(
                'export async function fetchTouristPlans(locale: SupportedLocale)'
            );
        });

        it('should return Promise<PricingPlan[]>', () => {
            expect(pricingPlansContent).toContain(
                'export async function fetchTouristPlans(locale: SupportedLocale): Promise<PricingPlan[]>'
            );
        });
    });

    describe('fetchOwnerPlans function', () => {
        it('should call plansApi.list()', () => {
            expect(pricingPlansContent).toContain('await plansApi.list()');
        });

        it('should return fallback on API failure', () => {
            expect(pricingPlansContent).toContain('return OWNER_FALLBACK_PLANS[locale]');
        });

        it('should filter plans by owner category', () => {
            expect(pricingPlansContent).toContain(
                "filterByCategory(extractItems(result.data), 'owner')"
            );
        });

        it('should return fallback when no plans found', () => {
            expect(pricingPlansContent).toContain(
                'if (plans.length === 0) return OWNER_FALLBACK_PLANS[locale]'
            );
        });

        it('should accept locale parameter', () => {
            expect(pricingPlansContent).toContain(
                'export async function fetchOwnerPlans(locale: SupportedLocale)'
            );
        });

        it('should return Promise<PricingPlan[]>', () => {
            expect(pricingPlansContent).toContain(
                'export async function fetchOwnerPlans(locale: SupportedLocale): Promise<PricingPlan[]>'
            );
        });

        it('should have try-catch for error handling', () => {
            expect(pricingPlansContent).toContain('try {');
            expect(pricingPlansContent).toContain('} catch {');
        });
    });

    describe('Helper functions', () => {
        it('should define extractItems helper', () => {
            expect(pricingPlansContent).toContain('function extractItems(rawData: unknown)');
        });

        it('should handle array and paginated response shapes', () => {
            expect(pricingPlansContent).toContain('if (Array.isArray(rawData)) return rawData');
            expect(pricingPlansContent).toContain('Array.isArray(asRecord?.items)');
        });

        it('should define filterByCategory helper', () => {
            expect(pricingPlansContent).toContain(
                'function filterByCategory(items: unknown[], category: string)'
            );
        });

        it('should define sortByOrder helper', () => {
            expect(pricingPlansContent).toContain(
                'function sortByOrder(plans: Record<string, unknown>[])'
            );
        });

        it('should sort by sortOrder field ascending', () => {
            expect(pricingPlansContent).toContain('aOrder - bOrder');
        });

        it('should define mapApiPlanToCard helper', () => {
            expect(pricingPlansContent).toContain('function mapApiPlanToCard(');
        });

        it('should highlight the middle plan', () => {
            expect(pricingPlansContent).toContain(
                'const highlighted = total > 1 && index === Math.floor(total / 2)'
            );
        });

        it('should use USD price for en locale', () => {
            expect(pricingPlansContent).toContain(
                "const price = locale === 'en' ? monthlyPriceUsdRef : Math.round(monthlyPriceArs / 100)"
            );
        });
    });

    describe('JSDoc documentation', () => {
        it('should have module-level JSDoc', () => {
            expect(pricingPlansContent).toContain('/**');
            expect(pricingPlansContent).toContain(
                '* Pricing plan utilities for the pricing pages.'
            );
        });

        it('should have JSDoc for fetchTouristPlans', () => {
            expect(pricingPlansContent).toContain('* Fetches tourist plans from the billing API');
            expect(pricingPlansContent).toContain('* @param locale');
            expect(pricingPlansContent).toContain('* @returns Sorted tourist PricingPlan array');
        });

        it('should have JSDoc for fetchOwnerPlans', () => {
            expect(pricingPlansContent).toContain('* Fetches owner plans from the billing API');
            expect(pricingPlansContent).toContain('* @returns Sorted owner PricingPlan array');
        });

        it('should document TOURIST_FALLBACK_PLANS in fallbacks file', () => {
            expect(pricingFallbacksContent).toContain(
                '* Hardcoded fallback pricing plans for tourists'
            );
        });

        it('should document OWNER_FALLBACK_PLANS in fallbacks file', () => {
            expect(pricingFallbacksContent).toContain(
                '* Hardcoded fallback pricing plans for accommodation owners'
            );
        });
    });

    describe('File size', () => {
        it('should be under 600 lines', () => {
            const lines = pricingPlansContent.split('\n').length;
            expect(lines).toBeLessThan(600);
        });
    });
});
