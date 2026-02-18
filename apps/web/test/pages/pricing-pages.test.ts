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

        it('should export getStaticPaths function', () => {
            expect(turistasContent).toContain('export function getStaticPaths()');
        });

        it('should generate paths for all 3 locales', () => {
            expect(turistasContent).toContain("{ params: { lang: 'es' } }");
            expect(turistasContent).toContain("{ params: { lang: 'en' } }");
            expect(turistasContent).toContain("{ params: { lang: 'pt' } }");
        });
    });

    describe('Locale validation', () => {
        it('should extract lang from params', () => {
            expect(turistasContent).toContain('const { lang } = Astro.params');
        });

        it('should validate locale parameter', () => {
            expect(turistasContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(turistasContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(turistasContent).toContain('isValidLocale');
            expect(turistasContent).toContain('type SupportedLocale');
        });

        it('should cast locale to SupportedLocale', () => {
            expect(turistasContent).toContain('const locale = lang as SupportedLocale;');
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
            expect(turistasContent).toContain("es: 'Precios para Turistas'");
            expect(turistasContent).toContain("en: 'Tourist Pricing'");
            expect(turistasContent).toContain("pt: 'Precos para Turistas'");
        });

        it('should have localized meta descriptions', () => {
            expect(turistasContent).toContain(
                'const descriptions: Record<SupportedLocale, string>'
            );
            expect(turistasContent).toContain('planes de suscripción para turistas');
        });

        it('should have localized home breadcrumb labels', () => {
            expect(turistasContent).toContain('const homeLabels: Record<SupportedLocale, string>');
            expect(turistasContent).toContain("es: 'Inicio'");
            expect(turistasContent).toContain("en: 'Home'");
            expect(turistasContent).toContain("pt: 'Início'");
        });

        it('should have localized pricing breadcrumb labels', () => {
            expect(turistasContent).toContain(
                'const pricingLabels: Record<SupportedLocale, string>'
            );
            expect(turistasContent).toContain("es: 'Precios'");
            expect(turistasContent).toContain("en: 'Pricing'");
            expect(turistasContent).toContain("pt: 'Precos'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(turistasContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(turistasContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(turistasContent).toContain('title={titles[locale]}');
            expect(turistasContent).toContain('description={descriptions[locale]}');
        });

        it('should set page type to website', () => {
            expect(turistasContent).toContain('type="website"');
        });

        it('should pass locale with pt fallback', () => {
            expect(turistasContent).toContain("locale={locale === 'pt' ? 'es' : locale}");
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
            expect(turistasContent).toContain('{ label: homeLabels[locale], href: `/${locale}/`');
        });

        it('should have pricing breadcrumb link', () => {
            expect(turistasContent).toContain(
                '{ label: pricingLabels[locale], href: `/${locale}/precios/`'
            );
        });

        it('should have tourist pricing breadcrumb', () => {
            expect(turistasContent).toContain(
                '{ label: titles[locale], href: `/${locale}/precios/turistas/`'
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
            expect(turistasContent).toContain('Preguntas Frecuentes');
        });

        it('should have CTA section', () => {
            expect(turistasContent).toContain('id="cta-section"');
        });
    });

    describe('Hero section content', () => {
        it('should have localized hero content structure', () => {
            expect(turistasContent).toContain(
                'const heroContent: Record<SupportedLocale, { title: string; description: string }>'
            );
        });

        it('should have Spanish hero title', () => {
            expect(turistasContent).toContain("title: 'Planes para Turistas'");
        });

        it('should have English hero title', () => {
            expect(turistasContent).toContain("title: 'Tourist Plans'");
        });

        it('should have Portuguese hero title', () => {
            expect(turistasContent).toContain("title: 'Planos para Turistas'");
        });

        it('should render h1 with hero title', () => {
            expect(turistasContent).toContain('{heroContent[locale].title}');
        });

        it('should render hero description', () => {
            expect(turistasContent).toContain('{heroContent[locale].description}');
        });
    });

    describe('FAQ content', () => {
        it('should have FAQ questions and answers typed', () => {
            expect(turistasContent).toContain('const faqContent: Record<SupportedLocale');
            expect(turistasContent).toContain('question:');
            expect(turistasContent).toContain('answer:');
        });

        it('should have plan change question', () => {
            expect(turistasContent).toContain('cambiar de plan');
        });

        it('should have payment methods question', () => {
            expect(turistasContent).toContain('métodos de pago');
        });

        it('should have trial period question', () => {
            expect(turistasContent).toContain('período de prueba');
        });

        it('should render FAQ items from faqContent', () => {
            expect(turistasContent).toContain('faqContent[locale].map((faq) =>');
            expect(turistasContent).toContain('{faq.question}');
            expect(turistasContent).toContain('{faq.answer}');
        });
    });

    describe('CTA section', () => {
        it('should have CTA content typed', () => {
            expect(turistasContent).toContain('const ctaContent: Record<SupportedLocale');
        });

        it('should have Spanish CTA button text', () => {
            expect(turistasContent).toContain('Registrate Gratis');
        });

        it('should have English CTA button text', () => {
            expect(turistasContent).toContain('Sign Up Free');
        });

        it('should have Portuguese CTA button text', () => {
            expect(turistasContent).toContain('Cadastre-se Grátis');
        });

        it('should link to registration page', () => {
            expect(turistasContent).toContain('href={`/${locale}/registro/`}');
        });

        it('should render CTA button text', () => {
            expect(turistasContent).toContain('{ctaContent[locale].buttonText}');
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

        it('should export getStaticPaths function', () => {
            expect(propietariosContent).toContain('export function getStaticPaths()');
        });

        it('should generate paths for all 3 locales', () => {
            expect(propietariosContent).toContain("{ params: { lang: 'es' } }");
            expect(propietariosContent).toContain("{ params: { lang: 'en' } }");
            expect(propietariosContent).toContain("{ params: { lang: 'pt' } }");
        });
    });

    describe('Locale validation', () => {
        it('should extract lang from params', () => {
            expect(propietariosContent).toContain('const { lang } = Astro.params');
        });

        it('should validate locale parameter', () => {
            expect(propietariosContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(propietariosContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(propietariosContent).toContain('isValidLocale');
            expect(propietariosContent).toContain('type SupportedLocale');
        });

        it('should cast locale to SupportedLocale', () => {
            expect(propietariosContent).toContain('const locale = lang as SupportedLocale;');
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
            expect(propietariosContent).toContain("es: 'Precios para Propietarios'");
            expect(propietariosContent).toContain("en: 'Owner Pricing'");
            expect(propietariosContent).toContain("pt: 'Precos para Proprietarios'");
        });

        it('should have localized meta descriptions', () => {
            expect(propietariosContent).toContain(
                'const descriptions: Record<SupportedLocale, string>'
            );
            expect(propietariosContent).toContain('planes de suscripción para propietarios');
        });

        it('should have localized home breadcrumb labels', () => {
            expect(propietariosContent).toContain(
                'const homeLabels: Record<SupportedLocale, string>'
            );
            expect(propietariosContent).toContain("es: 'Inicio'");
            expect(propietariosContent).toContain("en: 'Home'");
            expect(propietariosContent).toContain("pt: 'Início'");
        });

        it('should have localized pricing breadcrumb labels', () => {
            expect(propietariosContent).toContain(
                'const pricingLabels: Record<SupportedLocale, string>'
            );
            expect(propietariosContent).toContain("es: 'Precios'");
            expect(propietariosContent).toContain("en: 'Pricing'");
            expect(propietariosContent).toContain("pt: 'Precos'");
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
            expect(propietariosContent).toContain('title={titles[locale]}');
            expect(propietariosContent).toContain('description={descriptions[locale]}');
        });

        it('should set page type to website', () => {
            expect(propietariosContent).toContain('type="website"');
        });

        it('should pass locale with pt fallback', () => {
            expect(propietariosContent).toContain("locale={locale === 'pt' ? 'es' : locale}");
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
                '{ label: homeLabels[locale], href: `/${locale}/`'
            );
        });

        it('should have pricing breadcrumb link', () => {
            expect(propietariosContent).toContain(
                '{ label: pricingLabels[locale], href: `/${locale}/precios/`'
            );
        });

        it('should have owner pricing breadcrumb', () => {
            expect(propietariosContent).toContain(
                '{ label: titles[locale], href: `/${locale}/precios/propietarios/`'
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
            expect(propietariosContent).toContain('Preguntas Frecuentes');
        });

        it('should have CTA section', () => {
            expect(propietariosContent).toContain('id="cta-section"');
        });
    });

    describe('Hero section content', () => {
        it('should have localized hero content structure', () => {
            expect(propietariosContent).toContain(
                'const heroContent: Record<SupportedLocale, { title: string; description: string }>'
            );
        });

        it('should have Spanish hero title', () => {
            expect(propietariosContent).toContain("title: 'Planes para Propietarios'");
        });

        it('should have English hero title', () => {
            expect(propietariosContent).toContain("title: 'Owner Plans'");
        });

        it('should have Portuguese hero title', () => {
            expect(propietariosContent).toContain("title: 'Planos para Proprietários'");
        });

        it('should render h1 with hero title', () => {
            expect(propietariosContent).toContain('{heroContent[locale].title}');
        });

        it('should render hero description', () => {
            expect(propietariosContent).toContain('{heroContent[locale].description}');
        });
    });

    describe('FAQ content', () => {
        it('should have FAQ questions and answers typed', () => {
            expect(propietariosContent).toContain('const faqContent: Record<SupportedLocale');
            expect(propietariosContent).toContain('question:');
            expect(propietariosContent).toContain('answer:');
        });

        it('should have free trial question', () => {
            expect(propietariosContent).toContain('prueba gratuita');
        });

        it('should have plan change question', () => {
            expect(propietariosContent).toContain('cambiar de plan');
        });

        it('should have additional costs question', () => {
            expect(propietariosContent).toContain('costos adicionales');
        });

        it('should render FAQ items from faqContent', () => {
            expect(propietariosContent).toContain('faqContent[locale].map((faq) =>');
            expect(propietariosContent).toContain('{faq.question}');
            expect(propietariosContent).toContain('{faq.answer}');
        });
    });

    describe('CTA section', () => {
        it('should have CTA content typed', () => {
            expect(propietariosContent).toContain('const ctaContent: Record<SupportedLocale');
        });

        it('should have Spanish CTA button text', () => {
            expect(propietariosContent).toContain('Comenzar Prueba Gratuita');
        });

        it('should have English CTA button text', () => {
            expect(propietariosContent).toContain('Start Free Trial');
        });

        it('should have Portuguese CTA button text', () => {
            expect(propietariosContent).toContain('Começar Teste Gratuito');
        });

        it('should link to owner registration page', () => {
            expect(propietariosContent).toContain('href={`/${locale}/registro/propietario/`}');
        });

        it('should render CTA button text', () => {
            expect(propietariosContent).toContain('{ctaContent[locale].buttonText}');
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

        it('should export TOURIST_FALLBACK_PLANS constant', () => {
            expect(pricingPlansContent).toContain('export const TOURIST_FALLBACK_PLANS');
        });

        it('should export OWNER_FALLBACK_PLANS constant', () => {
            expect(pricingPlansContent).toContain('export const OWNER_FALLBACK_PLANS');
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
            expect(pricingPlansContent).toContain("import { plansApi } from './api/endpoints'");
        });
    });

    describe('Tourist Fallback Plans', () => {
        it('should have fallback plans for all 3 locales', () => {
            expect(pricingPlansContent).toContain('Record<SupportedLocale, PricingPlan[]>');
        });

        it('should have Free/Gratis plan', () => {
            expect(pricingPlansContent).toContain("name: 'Gratis'");
            expect(pricingPlansContent).toContain("name: 'Free'");
            expect(pricingPlansContent).toContain("name: 'Grátis'");
            expect(pricingPlansContent).toContain('price: 0');
        });

        it('should have Plus plan', () => {
            expect(pricingPlansContent).toContain("name: 'Plus'");
            expect(pricingPlansContent).toContain('price: 5000');
            expect(pricingPlansContent).toContain('price: 5,');
        });

        it('should have VIP plan', () => {
            expect(pricingPlansContent).toContain("name: 'VIP'");
            expect(pricingPlansContent).toContain('price: 15000');
            expect(pricingPlansContent).toContain('price: 15,');
        });

        it('should have VIP plan highlighted', () => {
            expect(pricingPlansContent).toContain('highlighted: true');
        });

        it('should have tourist features in Spanish', () => {
            expect(pricingPlansContent).toContain('Navegar alojamientos');
            expect(pricingPlansContent).toContain('Leer reseñas');
            expect(pricingPlansContent).toContain('Servicio de conserjería');
        });

        it('should have tourist features in English', () => {
            expect(pricingPlansContent).toContain('Browse accommodations');
            expect(pricingPlansContent).toContain('Read reviews');
            expect(pricingPlansContent).toContain('Concierge service');
        });

        it('should have ARS currency for es locale', () => {
            expect(pricingPlansContent).toContain("currency: 'ARS'");
        });

        it('should have USD currency for en locale', () => {
            expect(pricingPlansContent).toContain("currency: 'USD'");
        });

        it('should have CTA links for tourist plans', () => {
            expect(pricingPlansContent).toContain("label: 'Comenzar Gratis'");
            expect(pricingPlansContent).toContain("label: 'Start Free'");
        });
    });

    describe('Owner Fallback Plans', () => {
        it('should have Basico/Basic plan', () => {
            expect(pricingPlansContent).toContain("name: 'Basico'");
            expect(pricingPlansContent).toContain("name: 'Basic'");
            expect(pricingPlansContent).toContain("name: 'Básico'");
            expect(pricingPlansContent).toContain('price: 15000');
            expect(pricingPlansContent).toContain('price: 15,');
        });

        it('should have Profesional/Professional plan', () => {
            expect(pricingPlansContent).toContain("name: 'Profesional'");
            expect(pricingPlansContent).toContain("name: 'Professional'");
            expect(pricingPlansContent).toContain("name: 'Profissional'");
            expect(pricingPlansContent).toContain('price: 35000');
            expect(pricingPlansContent).toContain('price: 35,');
        });

        it('should have Premium plan', () => {
            expect(pricingPlansContent).toContain("name: 'Premium'");
            expect(pricingPlansContent).toContain('price: 75000');
            expect(pricingPlansContent).toContain('price: 75,');
        });

        it('should have Professional plan highlighted', () => {
            expect(pricingPlansContent).toContain('highlighted: true');
        });

        it('should have owner features in Spanish', () => {
            expect(pricingPlansContent).toContain('1 propiedad en listado');
            expect(pricingPlansContent).toContain('Análisis básicos');
            expect(pricingPlansContent).toContain('Gestor de cuenta');
        });

        it('should have owner features in English', () => {
            expect(pricingPlansContent).toContain('1 property listing');
            expect(pricingPlansContent).toContain('Basic analytics');
            expect(pricingPlansContent).toContain('Account manager');
        });

        it('should have CTA links for owner plans', () => {
            expect(pricingPlansContent).toContain("label: 'Comenzar Basico'");
            expect(pricingPlansContent).toContain("label: 'Start Basic'");
        });
    });

    describe('Locale Config', () => {
        it('should define LOCALE_CONFIG with currency and period per locale', () => {
            expect(pricingPlansContent).toContain('LOCALE_CONFIG: Record<SupportedLocale,');
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

        it('should document TOURIST_FALLBACK_PLANS', () => {
            expect(pricingPlansContent).toContain(
                '* Hardcoded fallback pricing plans for tourists'
            );
        });

        it('should document OWNER_FALLBACK_PLANS', () => {
            expect(pricingPlansContent).toContain(
                '* Hardcoded fallback pricing plans for accommodation owners'
            );
        });
    });

    describe('File size', () => {
        it('should be under 500 lines', () => {
            const lines = pricingPlansContent.split('\n').length;
            expect(lines).toBeLessThan(500);
        });
    });
});
