/**
 * Tests for About Us page (Quienes Somos).
 * Verifies page structure, SEO elements, localization, and content sections.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const quienesSomosPath = resolve(__dirname, '../../src/pages/[lang]/quienes-somos.astro');
const content = readFileSync(quienesSomosPath, 'utf8');

describe('quienes-somos.astro', () => {
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
            expect(content).toContain('const { lang } = Astro.params');
            expect(content).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(content).toContain('isValidLocale');
            expect(content).toContain('type SupportedLocale');
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(content).toContain("es: 'Quienes Somos'");
            expect(content).toContain("en: 'About Us'");
            expect(content).toContain("pt: 'Sobre Nós'");
        });

        it('should have localized meta descriptions', () => {
            expect(content).toContain('const descriptions: Record<SupportedLocale, string>');
            expect(content).toContain('la plataforma que conecta viajeros con alojamientos');
        });

        it('should have localized home breadcrumb labels', () => {
            expect(content).toContain('const homeLabels: Record<SupportedLocale, string>');
            expect(content).toContain("es: 'Inicio'");
            expect(content).toContain("en: 'Home'");
            expect(content).toContain("pt: 'Início'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(content).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(content).toContain('title={titles[locale]}');
            expect(content).toContain('description={descriptions[locale]}');
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
            expect(content).toContain('{ label: homeLabels[locale], href: `/${locale}/`');
        });

        it('should have about us page breadcrumb', () => {
            expect(content).toContain('{ label: titles[locale], href: `/${locale}/quienes-somos/`');
        });
    });

    describe('Content sections', () => {
        it('should have hero section', () => {
            expect(content).toContain('id="hero"');
            expect(content).toContain('Hospeda es la plataforma que conecta viajeros');
        });

        it('should have mission section', () => {
            expect(content).toContain('id="mission"');
            expect(content).toContain('Nuestra Misión');
            expect(content).toContain('Conectar viajeros con alojamientos auténticos');
        });

        it('should have values section', () => {
            expect(content).toContain('id="values"');
            expect(content).toContain('Nuestros Valores');
        });

        it('should have region section', () => {
            expect(content).toContain('id="region"');
            expect(content).toContain('Nuestra Región');
            expect(content).toContain('Concepción del Uruguay');
        });

        it('should have contact CTA section', () => {
            expect(content).toContain('id="contact-cta"');
            expect(content).toContain('Conectemos y Crezcamos Juntos');
        });
    });

    describe('Values content', () => {
        it('should have Authenticity value', () => {
            expect(content).toContain('Autenticidad');
            expect(content).toContain('experiencias genuinas');
        });

        it('should have Community value', () => {
            expect(content).toContain('Comunidad');
            expect(content).toContain('tejido social local');
        });

        it('should have Quality value', () => {
            expect(content).toContain('Calidad');
            expect(content).toContain('alojamientos verificados');
        });

        it('should have Sustainability value', () => {
            expect(content).toContain('Sustentabilidad');
            expect(content).toContain('turísticas responsables');
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

        it('should use card-like sections with background', () => {
            expect(content).toContain('rounded-lg bg-bg p-8 shadow-sm');
        });

        it('should have grid layout for values', () => {
            expect(content).toContain('grid gap-8 md:grid-cols-2');
        });
    });

    describe('Icons and SVG', () => {
        it('should have SVG icons for values', () => {
            expect(content).toContain('<svg');
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have icon containers with proper styling', () => {
            expect(content).toContain('rounded-full bg-primary/10');
        });
    });

    describe('Call to Action', () => {
        it('should have contact link', () => {
            expect(content).toContain('href={`/${locale}/contacto/`}');
        });

        it('should have properly styled CTA button', () => {
            expect(content).toContain('bg-primary');
            expect(content).toContain('hover:bg-primary-dark');
            expect(content).toContain('focus-visible:outline');
        });
    });
});
