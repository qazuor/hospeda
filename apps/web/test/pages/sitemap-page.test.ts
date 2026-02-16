/**
 * Tests for HTML Sitemap page (Mapa del Sitio).
 * Verifies page structure, SEO elements, localization, section organization, and links.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sitemapPath = resolve(__dirname, '../../src/pages/[lang]/mapa-del-sitio.astro');
const content = readFileSync(sitemapPath, 'utf8');

describe('mapa-del-sitio.astro', () => {
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
            expect(content).toContain("es: 'Mapa del Sitio'");
            expect(content).toContain("en: 'Sitemap'");
            expect(content).toContain("pt: 'Mapa do Site'");
        });

        it('should have localized meta descriptions', () => {
            expect(content).toContain('const descriptions: Record<SupportedLocale, string>');
            expect(content).toContain('Encuentra rápidamente todas las páginas');
        });

        it('should have localized home breadcrumb labels', () => {
            expect(content).toContain('const homeLabels: Record<SupportedLocale, string>');
            expect(content).toContain("es: 'Inicio'");
            expect(content).toContain("en: 'Home'");
            expect(content).toContain("pt: 'Início'");
        });

        it('should have localized section headings', () => {
            expect(content).toContain('const sectionHeadings');
            expect(content).toContain('principal:');
            expect(content).toContain('alojamientos:');
            expect(content).toContain('destinos:');
            expect(content).toContain('eventos:');
            expect(content).toContain('blog:');
            expect(content).toContain('cuenta:');
            expect(content).toContain('informacion:');
        });

        it('should have localized link labels', () => {
            expect(content).toContain('const linkLabels');
            expect(content).toContain('home:');
            expect(content).toContain('about:');
            expect(content).toContain('contact:');
            expect(content).toContain('signIn:');
            expect(content).toContain('terms:');
            expect(content).toContain('privacy:');
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

        it('should have sitemap page breadcrumb', () => {
            expect(content).toContain(
                '{ label: titles[locale], href: `/${locale}/mapa-del-sitio/`'
            );
        });
    });

    describe('Sitemap sections', () => {
        it('should define sitemap sections array', () => {
            expect(content).toContain('const sitemapSections = [');
        });

        it('should have Principal section', () => {
            expect(content).toContain("id: 'principal'");
            expect(content).toContain('heading: sectionHeadings.principal[locale]');
        });

        it('should have Alojamientos section', () => {
            expect(content).toContain("id: 'alojamientos'");
            expect(content).toContain('heading: sectionHeadings.alojamientos[locale]');
        });

        it('should have Destinos section', () => {
            expect(content).toContain("id: 'destinos'");
            expect(content).toContain('heading: sectionHeadings.destinos[locale]');
        });

        it('should have Eventos section', () => {
            expect(content).toContain("id: 'eventos'");
            expect(content).toContain('heading: sectionHeadings.eventos[locale]');
        });

        it('should have Blog section', () => {
            expect(content).toContain("id: 'blog'");
            expect(content).toContain('heading: sectionHeadings.blog[locale]');
        });

        it('should have Cuenta section', () => {
            expect(content).toContain("id: 'cuenta'");
            expect(content).toContain('heading: sectionHeadings.cuenta[locale]');
        });

        it('should have Informacion section', () => {
            expect(content).toContain("id: 'informacion'");
            expect(content).toContain('heading: sectionHeadings.informacion[locale]');
        });
    });

    describe('Principal section links', () => {
        it('should have Home link', () => {
            expect(content).toContain('label: linkLabels.home[locale]');
            expect(content).toContain('href: `/${locale}/`');
        });

        it('should have About link', () => {
            expect(content).toContain('label: linkLabels.about[locale]');
            expect(content).toContain('href: `/${locale}/quienes-somos/`');
        });

        it('should have Benefits link', () => {
            expect(content).toContain('label: linkLabels.benefits[locale]');
            expect(content).toContain('href: `/${locale}/beneficios/`');
        });

        it('should have Contact link', () => {
            expect(content).toContain('label: linkLabels.contact[locale]');
            expect(content).toContain('href: `/${locale}/contacto/`');
        });
    });

    describe('Alojamientos section links', () => {
        it('should have Browse Accommodations link', () => {
            expect(content).toContain('label: linkLabels.browseAccommodations[locale]');
            expect(content).toContain('href: `/${locale}/alojamientos/`');
        });

        it('should have Search Accommodations link', () => {
            expect(content).toContain('label: linkLabels.searchAccommodations[locale]');
            expect(content).toContain('href: `/${locale}/alojamientos/buscar/`');
        });

        it('should have By Type link', () => {
            expect(content).toContain('label: linkLabels.byType[locale]');
            expect(content).toContain('href: `/${locale}/alojamientos/tipo/`');
        });
    });

    describe('Destinos section links', () => {
        it('should have Browse Destinations link', () => {
            expect(content).toContain('label: linkLabels.browseDestinations[locale]');
            expect(content).toContain('href: `/${locale}/destinos/`');
        });
    });

    describe('Eventos section links', () => {
        it('should have Browse Events link', () => {
            expect(content).toContain('label: linkLabels.browseEvents[locale]');
            expect(content).toContain('href: `/${locale}/eventos/`');
        });
    });

    describe('Blog section links', () => {
        it('should have Blog Listing link', () => {
            expect(content).toContain('label: linkLabels.blogListing[locale]');
            expect(content).toContain('href: `/${locale}/blog/`');
        });
    });

    describe('Cuenta section links', () => {
        it('should have Sign In link', () => {
            expect(content).toContain('label: linkLabels.signIn[locale]');
            expect(content).toContain('href: `/${locale}/auth/signin/`');
        });

        it('should have Sign Up link', () => {
            expect(content).toContain('label: linkLabels.signUp[locale]');
            expect(content).toContain('href: `/${locale}/auth/signup/`');
        });

        it('should have Forgot Password link', () => {
            expect(content).toContain('label: linkLabels.forgotPassword[locale]');
            expect(content).toContain('href: `/${locale}/auth/forgot-password/`');
        });
    });

    describe('Informacion section links', () => {
        it('should have Terms and Conditions link', () => {
            expect(content).toContain('label: linkLabels.terms[locale]');
            expect(content).toContain('href: `/${locale}/terminos-y-condiciones/`');
        });

        it('should have Privacy Policy link', () => {
            expect(content).toContain('label: linkLabels.privacy[locale]');
            expect(content).toContain('href: `/${locale}/politica-de-privacidad/`');
        });

        it('should have Sitemap link', () => {
            expect(content).toContain('label: linkLabels.sitemap[locale]');
            expect(content).toContain('href: `/${locale}/mapa-del-sitio/`');
        });
    });

    describe('Page styling', () => {
        it('should have main heading with proper styling', () => {
            expect(content).toContain('text-4xl font-bold');
            expect(content).toContain('md:text-5xl');
        });

        it('should have grid layout for sitemap sections', () => {
            expect(content).toContain('grid gap-8 md:grid-cols-2 lg:grid-cols-3');
        });

        it('should have card-like section styling', () => {
            expect(content).toContain('rounded-lg bg-bg p-6 shadow-sm');
        });

        it('should have section headings with proper styling', () => {
            expect(content).toContain('text-xl font-semibold');
        });

        it('should have list spacing', () => {
            expect(content).toContain('space-y-2');
        });
    });

    describe('Accessibility', () => {
        it('should use semantic article elements for sections', () => {
            expect(content).toContain('<article');
        });

        it('should have navigation landmarks', () => {
            expect(content).toContain('<nav');
            expect(content).toContain('aria-label');
        });

        it('should have focus-visible styles for links', () => {
            expect(content).toContain('focus-visible:outline');
        });

        it('should use semantic lists', () => {
            expect(content).toContain('<ul');
            expect(content).toContain('<li>');
        });

        it('should have proper heading hierarchy', () => {
            expect(content).toContain('<h1');
            expect(content).toContain('<h2');
        });
    });

    describe('Locale prefix usage', () => {
        it('should use locale prefix for all internal links', () => {
            expect(content).toContain('href: `/${locale}/');
        });

        it('should not have hardcoded locale in links', () => {
            const hardcodedEs = content.match(/href=["']\/es\//g);
            const hardcodedEn = content.match(/href=["']\/en\//g);
            const hardcodedPt = content.match(/href=["']\/pt\//g);

            expect(hardcodedEs).toBeNull();
            expect(hardcodedEn).toBeNull();
            expect(hardcodedPt).toBeNull();
        });
    });

    describe('Page header', () => {
        it('should have header element', () => {
            expect(content).toContain('<header');
        });

        it('should display page title in header', () => {
            expect(content).toContain('{titles[locale]}');
        });

        it('should display page description in header', () => {
            expect(content).toContain('{descriptions[locale]}');
        });
    });

    describe('Section rendering', () => {
        it('should map over sitemap sections', () => {
            expect(content).toContain('sitemapSections.map((section)');
        });

        it('should render section heading', () => {
            expect(content).toContain('{section.heading}');
        });

        it('should map over section links', () => {
            expect(content).toContain('section.links.map((link)');
        });

        it('should render link label and href', () => {
            expect(content).toContain('{link.label}');
            expect(content).toContain('href={link.href}');
        });
    });
});
