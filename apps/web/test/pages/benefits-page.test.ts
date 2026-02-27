/**
 * Tests for Benefits page (Beneficios).
 * Verifies page structure, SEO elements, localization, and benefit sections.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const beneficiosPath = resolve(__dirname, '../../src/pages/[lang]/beneficios.astro');
const content = readFileSync(beneficiosPath, 'utf8');

describe('beneficios.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(content).toContain("import BaseLayout from '../../layouts/BaseLayout.astro'");
            expect(content).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(content).toContain("import SEOHead from '../../components/seo/SEOHead.astro'");
            expect(content).toContain('<SEOHead');
        });

        it('should use Breadcrumb component', () => {
            expect(content).toContain(
                "import Breadcrumb from '../../components/ui/Breadcrumb.astro'"
            );
            expect(content).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('should use Container component', () => {
            expect(content).toContain(
                "import Container from '../../components/ui/Container.astro'"
            );
            expect(content).toContain('<Container>');
        });

        it('should use Section component', () => {
            expect(content).toContain("import Section from '../../components/ui/Section.astro'");
            expect(content).toContain('<Section>');
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(content).toContain('getLocaleFromParams(Astro.params)');
            expect(content).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers and i18n', () => {
            expect(content).toContain('getLocaleFromParams');
            expect(content).toContain("import { t } from '../../lib/i18n'");
        });
    });

    describe('Localization', () => {
        it('should use t() for localized titles', () => {
            expect(content).toContain(
                "const title = t({ locale, namespace: 'benefits', key: 'page.title' })"
            );
        });

        it('should use t() for localized descriptions', () => {
            expect(content).toContain(
                "const description = t({ locale, namespace: 'benefits', key: 'page.description' })"
            );
        });

        it('should import HOME_BREADCRUMB from page-helpers', () => {
            expect(content).toContain('HOME_BREADCRUMB');
            expect(content).toContain("from '../../lib/page-helpers'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(content).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(content).toContain('title={title}');
            expect(content).toContain('description={description}');
        });

        it('should set page type to website', () => {
            expect(content).toContain('type="website"');
        });

        it('should not have noindex directive', () => {
            expect(content).not.toContain('noindex');
        });
    });

    describe('Breadcrumb navigation', () => {
        it('should create breadcrumb items array', () => {
            expect(content).toContain('const breadcrumbItems = [');
        });

        it('should have home breadcrumb link', () => {
            expect(content).toContain('{ label: HOME_BREADCRUMB[locale], href: `/${locale}/`');
        });

        it('should have benefits page breadcrumb', () => {
            expect(content).toContain('{ label: title, href: `/${locale}/beneficios/`');
        });
    });

    describe('Content sections', () => {
        it('should have hero section', () => {
            expect(content).toContain('id="hero"');
            expect(content).toContain(
                'Hospeda conecta viajeros con alojamientos auténticos y apoya a propietarios'
            );
        });

        it('should have tourist benefits section', () => {
            expect(content).toContain('id="tourist-benefits"');
            expect(content).toContain('Beneficios para Turistas');
        });

        it('should have owner benefits section', () => {
            expect(content).toContain('id="owner-benefits"');
            expect(content).toContain('Beneficios para Propietarios');
        });

        it('should have CTA section', () => {
            expect(content).toContain('id="cta-section"');
            expect(content).toContain('Descubre Nuestros Planes');
        });
    });

    describe('Tourist benefits', () => {
        it('should have wide selection benefit', () => {
            expect(content).toContain('Amplia Selección Verificada');
            expect(content).toContain('alojamientos verificados y de calidad');
        });

        it('should have secure booking benefit', () => {
            expect(content).toContain('Reservas y Pagos Seguros');
            expect(content).toContain('MercadoPago');
        });

        it('should have authentic experiences benefit', () => {
            expect(content).toContain('Experiencias Locales Auténticas');
            expect(content).toContain('cultura y hospitalidad local');
        });

        it('should have real reviews benefit', () => {
            expect(content).toContain('Reseñas Reales de Viajeros');
            expect(content).toContain('opiniones auténticas');
        });

        it('should have customer support benefit', () => {
            expect(content).toContain('Soporte al Cliente');
            expect(content).toContain('Equipo de soporte dedicado');
        });
    });

    describe('Owner benefits', () => {
        it('should have increased visibility benefit', () => {
            expect(content).toContain('Mayor Visibilidad');
            expect(content).toContain('miles de viajeros');
        });

        it('should have easy management benefit', () => {
            expect(content).toContain('Gestión Fácil de Propiedades');
            expect(content).toContain('Panel de administración intuitivo');
        });

        it('should have secure payments benefit', () => {
            expect(content).toContain('Pagos Seguros vía MercadoPago');
            expect(content).toContain('Integración directa con MercadoPago');
        });

        it('should have analytics benefit', () => {
            expect(content).toContain('Análisis e Informes');
            expect(content).toContain('métricas detalladas');
        });

        it('should have growing community benefit', () => {
            expect(content).toContain('Comunidad en Crecimiento');
            expect(content).toContain('red en expansión');
        });
    });

    describe('Call to Action links', () => {
        it('should have tourist pricing link', () => {
            expect(content).toContain('href={`/${locale}/precios-turistas/`}');
            expect(content).toContain('Ver precios para turistas');
        });

        it('should have owner pricing link', () => {
            expect(content).toContain('href={`/${locale}/precios-propietarios/`}');
            expect(content).toContain('Ver precios para propietarios');
        });
    });

    describe('Page styling', () => {
        it('should have main heading with proper styling', () => {
            expect(content).toContain('text-4xl font-bold');
            expect(content).toContain('md:text-5xl');
        });

        it('should have section headings', () => {
            expect(content).toContain('text-3xl font-semibold');
        });

        it('should have grid layout for benefits', () => {
            expect(content).toContain('grid gap-8 md:grid-cols-2 lg:grid-cols-3');
        });

        it('should use card-like CTA section', () => {
            expect(content).toContain('rounded-lg bg-primary/10 p-8');
            expect(content).toContain('shadow-sm transition-shadow hover:shadow-md');
        });
    });

    describe('Icons and SVG', () => {
        it('should import icon components from @repo/icons', () => {
            expect(content).toContain("from '@repo/icons'");
        });

        it('should import HomeIcon for accommodations', () => {
            expect(content).toContain('HomeIcon');
        });

        it('should import ShieldIcon for security', () => {
            expect(content).toContain('ShieldIcon');
        });

        it('should import LocationIcon for locations', () => {
            expect(content).toContain('LocationIcon');
        });

        it('should import StarIcon for reviews', () => {
            expect(content).toContain('StarIcon');
        });

        it('should import InfoIcon for support', () => {
            expect(content).toContain('InfoIcon');
        });

        it('should import UserIcon for user features', () => {
            expect(content).toContain('UserIcon');
        });

        it('should import CheckIcon for features', () => {
            expect(content).toContain('CheckIcon');
        });

        it('should import UsersIcon for community', () => {
            expect(content).toContain('UsersIcon');
        });

        it('should have icon containers with proper styling', () => {
            expect(content).toContain('rounded-full bg-primary/10');
        });
    });

    describe('Accessibility', () => {
        it('should have proper heading hierarchy', () => {
            expect(content).toContain('<h1');
            expect(content).toContain('<h2');
            expect(content).toContain('<h3');
        });

        it('should have aria-hidden on decorative SVGs', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have focus-visible styles on links', () => {
            expect(content).toContain('focus-visible:outline');
        });
    });

    describe('Layout and responsiveness', () => {
        it('should have responsive grid for benefits', () => {
            expect(content).toContain('md:grid-cols-2');
            expect(content).toContain('lg:grid-cols-3');
        });

        it('should have responsive CTA buttons', () => {
            expect(content).toContain('flex-col gap-4 sm:flex-row');
        });

        it('should have max-width container', () => {
            expect(content).toContain('mx-auto max-w-6xl');
        });
    });
});
