/**
 * Tests for Destination List page (Destinos).
 * Verifies page structure, SEO elements, localization, and content sections.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const destinosIndexPath = resolve(__dirname, '../../src/pages/[lang]/destinos/index.astro');
const content = readFileSync(destinosIndexPath, 'utf8');

describe('destinos/index.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(content).toContain("import BaseLayout from '../../../layouts/BaseLayout.astro'");
            expect(content).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(content).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(content).toContain('<SEOHead');
        });

        it('should use Breadcrumb component', () => {
            expect(content).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
            expect(content).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('should use Container component', () => {
            expect(content).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(content).toContain('<Container>');
        });

        it('should use Section component', () => {
            expect(content).toContain("import Section from '../../../components/ui/Section.astro'");
            expect(content).toContain('<Section>');
        });

        it('should import DestinationCard', () => {
            expect(content).toContain(
                "import DestinationCard from '../../../components/destination/DestinationCard.astro'"
            );
        });

        it('should import EmptyState', () => {
            expect(content).toContain(
                "import EmptyState from '../../../components/ui/EmptyState.astro'"
            );
        });

        it('should import destinationsApi', () => {
            expect(content).toContain(
                "import { destinationsApi } from '../../../lib/api/endpoints'"
            );
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
            expect(content).toContain("es: 'Destinos'");
            expect(content).toContain("en: 'Destinations'");
            expect(content).toContain("pt: 'Destinos'");
        });

        it('should have localized meta descriptions', () => {
            expect(content).toContain('const descriptions: Record<SupportedLocale, string>');
            expect(content).toContain('Descubre los destinos turísticos más fascinantes');
            expect(content).toContain('Litoral argentino');
        });

        it('should have localized home breadcrumb labels', () => {
            expect(content).toContain('const homeLabels: Record<SupportedLocale, string>');
            expect(content).toContain("es: 'Inicio'");
            expect(content).toContain("en: 'Home'");
            expect(content).toContain("pt: 'Início'");
        });

        it('should have localized hero headings', () => {
            expect(content).toContain('const heroHeadings: Record<SupportedLocale, string>');
            expect(content).toContain('Explora los Destinos del Litoral');
        });

        it('should have localized hero descriptions', () => {
            expect(content).toContain('const heroDescriptions: Record<SupportedLocale, string>');
            expect(content).toContain('ciudades históricas, paisajes naturales');
        });

        it('should have localized search placeholders', () => {
            expect(content).toContain('const searchPlaceholders: Record<SupportedLocale, string>');
            expect(content).toContain("es: 'Buscar destinos...'");
            expect(content).toContain("en: 'Search destinations...'");
        });

        it('should have localized featured titles', () => {
            expect(content).toContain('const featuredTitles: Record<SupportedLocale, string>');
            expect(content).toContain("es: 'Destinos Destacados'");
            expect(content).toContain("en: 'Featured Destinations'");
        });

        it('should have localized empty state texts', () => {
            expect(content).toContain('const emptyStateTitles: Record<SupportedLocale, string>');
        });

        it('should have localized regional titles', () => {
            expect(content).toContain('const regionalTitles: Record<SupportedLocale, string>');
            expect(content).toContain("es: 'La Región del Litoral'");
        });

        it('should have localized regional texts', () => {
            expect(content).toContain('const regionalTexts: Record<SupportedLocale, string>');
            expect(content).toContain('provincias de Entre Ríos, Corrientes y Santa Fe');
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

        it('should have destinations page breadcrumb', () => {
            expect(content).toContain('{ label: titles[locale], href: `/${locale}/destinos/`');
        });
    });

    describe('Content sections', () => {
        it('should have hero section', () => {
            expect(content).toContain('id="hero"');
            expect(content).toContain('{heroHeadings[locale]}');
            expect(content).toContain('{heroDescriptions[locale]}');
        });

        it('should have search bar section', () => {
            expect(content).toContain('id="search-bar"');
            expect(content).toContain('type="search"');
            expect(content).toContain('placeholder={searchPlaceholders[locale]}');
        });

        it('should have featured destinations section', () => {
            expect(content).toContain('id="featured-destinations"');
            expect(content).toContain('{featuredTitles[locale]}');
        });

        it('should have destination grid area', () => {
            expect(content).toContain('id="destination-grid"');
        });

        it('should show EmptyState when no destinations', () => {
            expect(content).toContain('destinations.length > 0');
            expect(content).toContain('<EmptyState');
        });

        it('should render DestinationCard for each destination', () => {
            expect(content).toContain('<DestinationCard');
        });

        it('should have regional highlight section', () => {
            expect(content).toContain('id="regional-highlight"');
            expect(content).toContain('{regionalTitles[locale]}');
            expect(content).toContain('{regionalTexts[locale]}');
        });

        it('should have provinces section', () => {
            expect(content).toContain('id="provinces"');
        });
    });

    describe('Regional content', () => {
        it('should mention Entre Ríos province', () => {
            expect(content).toContain('Entre Ríos');
            expect(content).toContain('Termas naturales');
        });

        it('should mention Corrientes province', () => {
            expect(content).toContain('Corrientes');
            expect(content).toContain('Esteros del Iberá');
        });

        it('should mention Santa Fe province', () => {
            expect(content).toContain('Santa Fe');
            expect(content).toContain('Cuna de la Constitución');
        });

        it('should mention Concepción del Uruguay', () => {
            expect(content).toContain('Concepción del Uruguay');
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

        it('should have grid layout for destinations', () => {
            expect(content).toContain('grid gap-6 sm:grid-cols-2 lg:grid-cols-3');
        });

        it('should have grid layout for provinces', () => {
            expect(content).toContain('grid gap-8 md:grid-cols-3');
        });

        it('should use card-like section with background', () => {
            expect(content).toContain('rounded-lg bg-bg p-8 shadow-sm');
        });
    });

    describe('Icons and SVG', () => {
        it('should have search icon', () => {
            expect(content).toContain('<svg');
            expect(content).toContain('M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z');
        });

        it('should have SVG icons for provinces', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have icon containers with proper styling', () => {
            expect(content).toContain('rounded-full bg-primary/10');
        });
    });

    describe('API Integration', () => {
        it('should fetch destinations from API', () => {
            expect(content).toContain('const result = await destinationsApi.list');
        });

        it('should check result.ok before using data', () => {
            expect(content).toContain('result.ok');
        });

        it('should extract destinations from API response', () => {
            expect(content).toContain('const destinations = result.ok ? (result.data.items');
        });

        it('should enable prerender', () => {
            expect(content).toContain('export const prerender = true');
        });

        it('should define getStaticPaths for locales', () => {
            expect(content).toContain('export function getStaticPaths()');
        });
    });

    describe('Search functionality', () => {
        it('should have search input with proper attributes', () => {
            expect(content).toContain('type="search"');
            expect(content).toContain('aria-label={searchPlaceholders[locale]}');
        });

        it('should have search input with focus styles', () => {
            expect(content).toContain('focus:border-primary');
            expect(content).toContain('focus:outline-none');
            expect(content).toContain('focus:ring-2');
        });
    });

    describe('Accessibility', () => {
        it('should have proper heading hierarchy', () => {
            expect(content).toContain('<h1');
            expect(content).toContain('<h2');
            expect(content).toContain('<h3');
        });

        it('should have aria-labels for interactive elements', () => {
            expect(content).toContain('aria-label');
        });

        it('should have role attributes for regions', () => {
            expect(content).toContain('role="region"');
        });

        it('should hide decorative SVG from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });
});
