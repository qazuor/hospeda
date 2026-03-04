/**
 * Tests for legal pages (Terms & Conditions and Privacy Policy).
 * Verifies page structure, SEO elements, localization, and content sections.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const terminosPath = resolve(__dirname, '../../src/pages/[lang]/terminos-condiciones.astro');
const privacidadPath = resolve(__dirname, '../../src/pages/[lang]/privacidad.astro');
const terminosContent = readFileSync(terminosPath, 'utf8');
const privacidadContent = readFileSync(privacidadPath, 'utf8');

describe('terminos-condiciones.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(terminosContent).toContain(
                "import BaseLayout from '../../layouts/BaseLayout.astro'"
            );
            expect(terminosContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(terminosContent).toContain(
                "import SEOHead from '../../components/seo/SEOHead.astro'"
            );
            expect(terminosContent).toContain('<SEOHead');
        });

        it('should use Breadcrumb component', () => {
            expect(terminosContent).toContain(
                "import Breadcrumb from '../../components/ui/Breadcrumb.astro'"
            );
            expect(terminosContent).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('should use Container component', () => {
            expect(terminosContent).toContain(
                "import Container from '../../components/ui/Container.astro'"
            );
            expect(terminosContent).toContain('<Container>');
        });

        it('should use Section component', () => {
            expect(terminosContent).toContain(
                "import Section from '../../components/ui/Section.astro'"
            );
            expect(terminosContent).toContain('<Section>');
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(terminosContent).toContain('getLocaleFromParams(Astro.params)');
            expect(terminosContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(terminosContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers and i18n', () => {
            expect(terminosContent).toContain('getLocaleFromParams');
            expect(terminosContent).toContain("import { t } from '../../lib/i18n'");
        });
    });

    describe('Localization', () => {
        it('should use t() for localized titles', () => {
            expect(terminosContent).toContain(
                "const title = t({ locale, namespace: 'terms', key: 'page.title' })"
            );
        });

        it('should use t() for localized descriptions', () => {
            expect(terminosContent).toContain(
                "const description = t({ locale, namespace: 'terms', key: 'page.description' })"
            );
        });

        it('should import HOME_BREADCRUMB from page-helpers', () => {
            expect(terminosContent).toContain('HOME_BREADCRUMB');
            expect(terminosContent).toContain("from '../../lib/page-helpers'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(terminosContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(terminosContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(terminosContent).toContain('title={title}');
            expect(terminosContent).toContain('description={description}');
        });

        it('should set page type to website', () => {
            expect(terminosContent).toContain('type="website"');
        });
    });

    describe('Breadcrumb navigation', () => {
        it('should create breadcrumb items array', () => {
            expect(terminosContent).toContain('const breadcrumbItems = [');
        });

        it('should have home breadcrumb link', () => {
            expect(terminosContent).toContain(
                '{ label: HOME_BREADCRUMB[locale], href: `/${locale}/`'
            );
        });

        it('should have terms page breadcrumb', () => {
            expect(terminosContent).toContain(
                '{ label: title, href: `/${locale}/terminos-condiciones/`'
            );
        });
    });

    describe('Content sections', () => {
        it('should have 7 legal sections', () => {
            const sectionMatches = terminosContent.match(/<article id="section-\d+">/g);
            expect(sectionMatches).toHaveLength(7);
        });

        it('should have section 1: Aceptación de los términos', () => {
            expect(terminosContent).toContain('id="section-1"');
            expect(terminosContent).toContain('1. Aceptación de los términos');
        });

        it('should have section 2: Uso del servicio', () => {
            expect(terminosContent).toContain('id="section-2"');
            expect(terminosContent).toContain('2. Uso del servicio');
        });

        it('should have section 3: Cuentas de usuario', () => {
            expect(terminosContent).toContain('id="section-3"');
            expect(terminosContent).toContain('3. Cuentas de usuario');
        });

        it('should have section 4: Contenido', () => {
            expect(terminosContent).toContain('id="section-4"');
            expect(terminosContent).toContain('4. Contenido');
        });

        it('should have section 5: Responsabilidad', () => {
            expect(terminosContent).toContain('id="section-5"');
            expect(terminosContent).toContain('5. Responsabilidad');
        });

        it('should have section 6: Modificaciones', () => {
            expect(terminosContent).toContain('id="section-6"');
            expect(terminosContent).toContain('6. Modificaciones');
        });

        it('should have section 7: Contacto', () => {
            expect(terminosContent).toContain('id="section-7"');
            expect(terminosContent).toContain('7. Contacto');
        });
    });

    describe('Page styling', () => {
        it('should use prose classes for content', () => {
            expect(terminosContent).toContain('prose prose-lg');
        });

        it('should have main heading', () => {
            expect(terminosContent).toContain('text-4xl font-bold');
        });

        it('should have section headings', () => {
            expect(terminosContent).toContain('text-2xl font-semibold');
        });

        it('should display last update date', () => {
            expect(terminosContent).toContain('Última actualización');
            expect(terminosContent).toContain('formatDate');
            expect(terminosContent).toContain("from '@repo/i18n'");
            expect(terminosContent).toContain('formatDate({');
        });
    });
});

describe('privacidad.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(privacidadContent).toContain(
                "import BaseLayout from '../../layouts/BaseLayout.astro'"
            );
            expect(privacidadContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(privacidadContent).toContain(
                "import SEOHead from '../../components/seo/SEOHead.astro'"
            );
            expect(privacidadContent).toContain('<SEOHead');
        });

        it('should use Breadcrumb component', () => {
            expect(privacidadContent).toContain(
                "import Breadcrumb from '../../components/ui/Breadcrumb.astro'"
            );
            expect(privacidadContent).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('should use Container component', () => {
            expect(privacidadContent).toContain(
                "import Container from '../../components/ui/Container.astro'"
            );
            expect(privacidadContent).toContain('<Container>');
        });

        it('should use Section component', () => {
            expect(privacidadContent).toContain(
                "import Section from '../../components/ui/Section.astro'"
            );
            expect(privacidadContent).toContain('<Section>');
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(privacidadContent).toContain('getLocaleFromParams(Astro.params)');
            expect(privacidadContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(privacidadContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers and i18n', () => {
            expect(privacidadContent).toContain('getLocaleFromParams');
            expect(privacidadContent).toContain("import { t } from '../../lib/i18n'");
        });
    });

    describe('Localization', () => {
        it('should use t() for localized titles', () => {
            expect(privacidadContent).toContain(
                "const title = t({ locale, namespace: 'privacy', key: 'page.title' })"
            );
        });

        it('should use t() for localized descriptions', () => {
            expect(privacidadContent).toContain(
                "const description = t({ locale, namespace: 'privacy', key: 'page.description' })"
            );
        });

        it('should import HOME_BREADCRUMB from page-helpers', () => {
            expect(privacidadContent).toContain('HOME_BREADCRUMB');
            expect(privacidadContent).toContain("from '../../lib/page-helpers'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(privacidadContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(privacidadContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(privacidadContent).toContain('title={title}');
            expect(privacidadContent).toContain('description={description}');
        });

        it('should set page type to website', () => {
            expect(privacidadContent).toContain('type="website"');
        });
    });

    describe('Breadcrumb navigation', () => {
        it('should create breadcrumb items array', () => {
            expect(privacidadContent).toContain('const breadcrumbItems = [');
        });

        it('should have home breadcrumb link', () => {
            expect(privacidadContent).toContain(
                '{ label: HOME_BREADCRUMB[locale], href: `/${locale}/`'
            );
        });

        it('should have privacy page breadcrumb', () => {
            expect(privacidadContent).toContain('{ label: title, href: `/${locale}/privacidad/`');
        });
    });

    describe('Content sections', () => {
        it('should have 7 legal sections', () => {
            const sectionMatches = privacidadContent.match(/<article id="section-\d+">/g);
            expect(sectionMatches).toHaveLength(7);
        });

        it('should have section 1: Información que recopilamos', () => {
            expect(privacidadContent).toContain('id="section-1"');
            expect(privacidadContent).toContain('1. Información que recopilamos');
        });

        it('should have section 2: Uso de la información', () => {
            expect(privacidadContent).toContain('id="section-2"');
            expect(privacidadContent).toContain('2. Uso de la información');
        });

        it('should have section 3: Cookies', () => {
            expect(privacidadContent).toContain('id="section-3"');
            expect(privacidadContent).toContain('3. Cookies');
        });

        it('should have section 4: Compartir datos', () => {
            expect(privacidadContent).toContain('id="section-4"');
            expect(privacidadContent).toContain('4. Compartir datos');
        });

        it('should have section 5: Seguridad', () => {
            expect(privacidadContent).toContain('id="section-5"');
            expect(privacidadContent).toContain('5. Seguridad');
        });

        it('should have section 6: Derechos del usuario', () => {
            expect(privacidadContent).toContain('id="section-6"');
            expect(privacidadContent).toContain('6. Derechos del usuario');
        });

        it('should have section 7: Contacto', () => {
            expect(privacidadContent).toContain('id="section-7"');
            expect(privacidadContent).toContain('7. Contacto');
        });
    });

    describe('Page styling', () => {
        it('should use prose classes for content', () => {
            expect(privacidadContent).toContain('prose prose-lg');
        });

        it('should have main heading', () => {
            expect(privacidadContent).toContain('text-4xl font-bold');
        });

        it('should have section headings', () => {
            expect(privacidadContent).toContain('text-2xl font-semibold');
        });

        it('should display last update date', () => {
            expect(privacidadContent).toContain('Última actualización');
            expect(privacidadContent).toContain('formatDate');
            expect(privacidadContent).toContain("from '@repo/i18n'");
            expect(privacidadContent).toContain('formatDate({');
        });
    });
});
