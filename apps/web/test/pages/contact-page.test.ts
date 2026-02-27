/**
 * Tests for contact page.
 * Verifies page structure, SEO elements, localization, form fields, and contact information.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const contactPath = resolve(__dirname, '../../src/pages/[lang]/contacto.astro');
const contactContent = readFileSync(contactPath, 'utf8');

describe('contacto.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(contactContent).toContain(
                "import BaseLayout from '../../layouts/BaseLayout.astro'"
            );
            expect(contactContent).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(contactContent).toContain(
                "import SEOHead from '../../components/seo/SEOHead.astro'"
            );
            expect(contactContent).toContain('<SEOHead');
        });

        it('should use Breadcrumb component', () => {
            expect(contactContent).toContain(
                "import Breadcrumb from '../../components/ui/Breadcrumb.astro'"
            );
            expect(contactContent).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('should use Container component', () => {
            expect(contactContent).toContain(
                "import Container from '../../components/ui/Container.astro'"
            );
            expect(contactContent).toContain('<Container>');
        });

        it('should use Section component', () => {
            expect(contactContent).toContain(
                "import Section from '../../components/ui/Section.astro'"
            );
            expect(contactContent).toContain('<Section>');
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(contactContent).toContain('getLocaleFromParams(Astro.params)');
            expect(contactContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(contactContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers and i18n', () => {
            expect(contactContent).toContain('getLocaleFromParams');
            expect(contactContent).toContain("import { t } from '../../lib/i18n'");
        });
    });

    describe('Localization', () => {
        it('should use t() for localized titles', () => {
            expect(contactContent).toContain(
                "const title = t({ locale, namespace: 'contact', key: 'page.title' })"
            );
        });

        it('should use t() for localized descriptions', () => {
            expect(contactContent).toContain(
                "const description = t({ locale, namespace: 'contact', key: 'page.description' })"
            );
        });

        it('should import HOME_BREADCRUMB from page-helpers', () => {
            expect(contactContent).toContain('HOME_BREADCRUMB');
            expect(contactContent).toContain("from '../../lib/page-helpers'");
        });

        it('should have localized contact info labels', () => {
            expect(contactContent).toContain(
                "const contactInfo = t({ locale, namespace: 'contact', key: 'page.contactInfo' })"
            );
            expect(contactContent).toContain(
                "const officeHours = t({ locale, namespace: 'contact', key: 'page.officeHours' })"
            );
            expect(contactContent).toContain(
                "const officeHoursValue = t({ locale, namespace: 'contact', key: 'page.officeHoursValue' })"
            );
            expect(contactContent).toContain(
                "const followUs = t({ locale, namespace: 'contact', key: 'page.followUs' })"
            );
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(contactContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(contactContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(contactContent).toContain('title={title}');
            expect(contactContent).toContain('description={description}');
        });

        it('should set page type to website', () => {
            expect(contactContent).toContain('type="website"');
        });
    });

    describe('Breadcrumb navigation', () => {
        it('should create breadcrumb items array', () => {
            expect(contactContent).toContain('const breadcrumbItems = [');
        });

        it('should have home breadcrumb link', () => {
            expect(contactContent).toContain(
                '{ label: HOME_BREADCRUMB[locale], href: `/${locale}/`'
            );
        });

        it('should have contact page breadcrumb', () => {
            expect(contactContent).toContain('{ label: title, href: `/${locale}/contacto/`');
        });
    });

    describe('Contact form (React island)', () => {
        it('should import ContactForm component', () => {
            expect(contactContent).toContain(
                "import { ContactForm } from '../../components/content/ContactForm.client'"
            );
        });

        it('should render ContactForm with client:visible directive', () => {
            expect(contactContent).toContain('<ContactForm client:visible');
        });

        it('should pass locale prop to ContactForm', () => {
            expect(contactContent).toContain('locale={locale');
        });

        it('should NOT have raw HTML form element', () => {
            expect(contactContent).not.toContain('id="contact-form"');
        });
    });

    describe('Contact information', () => {
        it('should display email address', () => {
            expect(contactContent).toContain('info@hospeda.com.ar');
            expect(contactContent).toContain('href="mailto:info@hospeda.com.ar"');
        });

        it('should display location', () => {
            expect(contactContent).toContain('Concepción del Uruguay');
            expect(contactContent).toContain('Entre Ríos');
            expect(contactContent).toContain('Argentina');
        });

        it('should display office hours', () => {
            expect(contactContent).toContain('{officeHours}');
            expect(contactContent).toContain('{officeHoursValue}');
        });

        it('should have contact info heading', () => {
            expect(contactContent).toContain('{contactInfo}');
        });
    });

    describe('Social media links', () => {
        it('should have Instagram link', () => {
            expect(contactContent).toContain('instagram.com/hospeda');
            expect(contactContent).toContain('aria-label="Instagram"');
        });

        it('should have Facebook link', () => {
            expect(contactContent).toContain('facebook.com/hospeda');
            expect(contactContent).toContain('aria-label="Facebook"');
        });

        it('should have Twitter link', () => {
            expect(contactContent).toContain('twitter.com/hospeda');
            expect(contactContent).toContain('aria-label="Twitter"');
        });

        it('should use target="_blank" for external links', () => {
            const socialLinks = contactContent.match(
                /href="https:\/\/(instagram|facebook|twitter)/g
            );
            expect(socialLinks).toBeDefined();
            expect(contactContent).toContain('target="_blank"');
            expect(contactContent).toContain('rel="noopener noreferrer"');
        });
    });

    describe('Layout structure', () => {
        it('should have two-column layout on desktop', () => {
            expect(contactContent).toContain('lg:grid-cols-2');
        });

        it('should have proper column ordering', () => {
            expect(contactContent).toContain('order-1 lg:order-2');
            expect(contactContent).toContain('order-2 lg:order-1');
        });
    });

    describe('Page styling', () => {
        it('should have main heading', () => {
            expect(contactContent).toContain('text-4xl font-bold');
        });

        it('should have icon containers', () => {
            expect(contactContent).toContain('bg-primary bg-opacity-10');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-hidden on decorative SVG icons', () => {
            expect(contactContent).toContain('aria-hidden="true"');
        });

        it('should have aria-label on social media links', () => {
            expect(contactContent).toContain('aria-label="Instagram"');
            expect(contactContent).toContain('aria-label="Facebook"');
            expect(contactContent).toContain('aria-label="Twitter"');
        });
    });
});
