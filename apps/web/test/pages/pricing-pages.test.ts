/**
 * Tests for pricing pages (turistas and propietarios).
 * Verifies page structure, SEO elements, localization, pricing plans, and CTA sections.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const turistasPath = resolve(__dirname, '../../src/pages/[lang]/precios/turistas.astro');
const turistasContent = readFileSync(turistasPath, 'utf8');

const propietariosPath = resolve(__dirname, '../../src/pages/[lang]/precios/propietarios.astro');
const propietariosContent = readFileSync(propietariosPath, 'utf8');

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

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(turistasContent).toContain('const { lang } = Astro.params');
            expect(turistasContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(turistasContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(turistasContent).toContain('isValidLocale');
            expect(turistasContent).toContain('type SupportedLocale');
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

    describe('Pricing plans', () => {
        it('should have Free/Gratis plan', () => {
            expect(turistasContent).toContain("name: 'Gratis'");
            expect(turistasContent).toContain("name: 'Free'");
            expect(turistasContent).toContain('price: 0');
        });

        it('should have Plus plan', () => {
            expect(turistasContent).toContain("name: 'Plus'");
            expect(turistasContent).toContain('price: 5000');
            expect(turistasContent).toContain('price: 5');
        });

        it('should have VIP plan', () => {
            expect(turistasContent).toContain("name: 'VIP'");
            expect(turistasContent).toContain('price: 15000');
            expect(turistasContent).toContain('price: 15');
        });

        it('should have VIP plan highlighted', () => {
            expect(turistasContent).toContain('highlighted: true');
        });

        it('should display features for plans', () => {
            expect(turistasContent).toContain('Navegar alojamientos');
            expect(turistasContent).toContain('Browse accommodations');
            expect(turistasContent).toContain('Leer reseñas');
            expect(turistasContent).toContain('Read reviews');
            expect(turistasContent).toContain('Servicio de conserjería');
            expect(turistasContent).toContain('Concierge service');
        });

        it('should have currency specified', () => {
            expect(turistasContent).toContain("currency: 'ARS'");
            expect(turistasContent).toContain("currency: 'USD'");
        });

        it('should have CTA links for each plan', () => {
            expect(turistasContent).toContain('cta:');
            expect(turistasContent).toContain('label:');
            expect(turistasContent).toContain('href:');
        });
    });

    describe('FAQ content', () => {
        it('should have FAQ questions and answers', () => {
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
    });

    describe('CTA section', () => {
        it('should have CTA content', () => {
            expect(turistasContent).toContain('const ctaContent: Record<SupportedLocale');
        });

        it('should have CTA button', () => {
            expect(turistasContent).toContain('Registrate Gratis');
            expect(turistasContent).toContain('Sign Up Free');
            expect(turistasContent).toContain('Cadastre-se Grátis');
        });

        it('should link to registration page', () => {
            expect(turistasContent).toContain('href={`/${locale}/registro/`}');
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

        it('should have section headings', () => {
            expect(turistasContent).toContain('text-3xl font-semibold');
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

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(propietariosContent).toContain('const { lang } = Astro.params');
            expect(propietariosContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(propietariosContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(propietariosContent).toContain('isValidLocale');
            expect(propietariosContent).toContain('type SupportedLocale');
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

    describe('Pricing plans', () => {
        it('should have Basico/Basic plan', () => {
            expect(propietariosContent).toContain("name: 'Basico'");
            expect(propietariosContent).toContain("name: 'Basic'");
            expect(propietariosContent).toContain("name: 'Básico'");
            expect(propietariosContent).toContain('price: 15000');
            expect(propietariosContent).toContain('price: 15');
        });

        it('should have Profesional/Professional plan', () => {
            expect(propietariosContent).toContain("name: 'Profesional'");
            expect(propietariosContent).toContain("name: 'Professional'");
            expect(propietariosContent).toContain("name: 'Profissional'");
            expect(propietariosContent).toContain('price: 35000');
            expect(propietariosContent).toContain('price: 35');
        });

        it('should have Premium plan', () => {
            expect(propietariosContent).toContain("name: 'Premium'");
            expect(propietariosContent).toContain('price: 75000');
            expect(propietariosContent).toContain('price: 75');
        });

        it('should have Professional plan highlighted', () => {
            expect(propietariosContent).toContain('highlighted: true');
        });

        it('should display features for plans', () => {
            expect(propietariosContent).toContain('propiedad en listado');
            expect(propietariosContent).toContain('property listing');
            expect(propietariosContent).toContain('Análisis básicos');
            expect(propietariosContent).toContain('Basic analytics');
            expect(propietariosContent).toContain('Gestor de cuenta');
            expect(propietariosContent).toContain('Account manager');
        });

        it('should have currency specified', () => {
            expect(propietariosContent).toContain("currency: 'ARS'");
            expect(propietariosContent).toContain("currency: 'USD'");
        });

        it('should have CTA links for each plan', () => {
            expect(propietariosContent).toContain('cta:');
            expect(propietariosContent).toContain('label:');
            expect(propietariosContent).toContain('href:');
        });
    });

    describe('FAQ content', () => {
        it('should have FAQ questions and answers', () => {
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
    });

    describe('CTA section', () => {
        it('should have CTA content', () => {
            expect(propietariosContent).toContain('const ctaContent: Record<SupportedLocale');
        });

        it('should have CTA button', () => {
            expect(propietariosContent).toContain('Comenzar Prueba Gratuita');
            expect(propietariosContent).toContain('Start Free Trial');
            expect(propietariosContent).toContain('Começar Teste Gratuito');
        });

        it('should link to owner registration page', () => {
            expect(propietariosContent).toContain('href={`/${locale}/registro/propietario/`}');
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

        it('should have section headings', () => {
            expect(propietariosContent).toContain('text-3xl font-semibold');
        });
    });
});
