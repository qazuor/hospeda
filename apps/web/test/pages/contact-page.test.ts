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
            expect(contactContent).toContain('const { lang } = Astro.params');
            expect(contactContent).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(contactContent).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(contactContent).toContain('isValidLocale');
            expect(contactContent).toContain('type SupportedLocale');
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(contactContent).toContain("es: 'Contacto'");
            expect(contactContent).toContain("en: 'Contact'");
            expect(contactContent).toContain("pt: 'Contato'");
        });

        it('should have localized meta descriptions', () => {
            expect(contactContent).toContain('const descriptions: Record<SupportedLocale, string>');
            expect(contactContent).toContain('Contacta con Hospeda');
        });

        it('should have localized home breadcrumb labels', () => {
            expect(contactContent).toContain('const homeLabels: Record<SupportedLocale, string>');
            expect(contactContent).toContain("es: 'Inicio'");
            expect(contactContent).toContain("en: 'Home'");
            expect(contactContent).toContain("pt: 'Início'");
        });

        it('should have localized contact info labels', () => {
            expect(contactContent).toContain('const formLabels = {');
            expect(contactContent).toContain("contactInfo: 'Información de contacto'");
            expect(contactContent).toContain("officeHours: 'Horario de atención'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(contactContent).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(contactContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(contactContent).toContain('title={titles[locale]}');
            expect(contactContent).toContain('description={descriptions[locale]}');
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
            expect(contactContent).toContain('{ label: homeLabels[locale], href: `/${locale}/`');
        });

        it('should have contact page breadcrumb', () => {
            expect(contactContent).toContain(
                '{ label: titles[locale], href: `/${locale}/contacto/`'
            );
        });
    });

    describe('Contact form (React island)', () => {
        it('should import ContactForm component', () => {
            expect(contactContent).toContain(
                "import { ContactForm } from '../../components/forms/ContactForm.client'"
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
            expect(contactContent).toContain('{labels.officeHours}');
            expect(contactContent).toContain('{labels.officeHoursValue}');
            expect(contactContent).toContain("officeHoursValue: 'Lunes a Viernes, 9:00 - 18:00'");
        });

        it('should have contact info heading', () => {
            expect(contactContent).toContain('{labels.contactInfo}');
            expect(contactContent).toContain("contactInfo: 'Información de contacto'");
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
