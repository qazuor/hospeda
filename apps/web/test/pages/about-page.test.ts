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
            expect(content).toContain('getLocaleFromParams(Astro.params)');
            expect(content).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(content).toContain('getLocaleFromParams');
            expect(content).toContain('HOME_BREADCRUMB');
            expect(content).toContain("from '../../lib/page-helpers'");
        });

        it('should not use SupportedLocale type import', () => {
            expect(content).not.toContain('type SupportedLocale');
        });
    });

    describe('i18n usage', () => {
        it('should import t function from lib/i18n', () => {
            expect(content).toContain("import { t } from '../../lib/i18n'");
        });

        it('should use t() with about namespace for title', () => {
            expect(content).toContain("t({ locale, namespace: 'about', key: 'page.title' })");
        });

        it('should use t() with about namespace for description', () => {
            expect(content).toContain("t({ locale, namespace: 'about', key: 'page.description' })");
        });

        it('should use t() calls for all section content', () => {
            expect(content).toContain("namespace: 'about'");
            expect(content).toContain("key: 'page.heroText'");
            expect(content).toContain("key: 'page.missionTitle'");
            expect(content).toContain("key: 'page.missionText'");
            expect(content).toContain("key: 'page.valuesTitle'");
            expect(content).toContain("key: 'page.regionTitle'");
            expect(content).toContain("key: 'page.ctaTitle'");
            expect(content).toContain("key: 'page.ctaButton'");
        });

        it('should use t() calls for values content', () => {
            expect(content).toContain("key: 'page.values.authenticity.title'");
            expect(content).toContain("key: 'page.values.authenticity.text'");
            expect(content).toContain("key: 'page.values.community.title'");
            expect(content).toContain("key: 'page.values.community.text'");
            expect(content).toContain("key: 'page.values.quality.title'");
            expect(content).toContain("key: 'page.values.quality.text'");
            expect(content).toContain("key: 'page.values.sustainability.title'");
            expect(content).toContain("key: 'page.values.sustainability.text'");
        });

        it('should not use inline Record-based translation objects', () => {
            expect(content).not.toContain('Record<SupportedLocale');
            expect(content).not.toContain("es: 'Quienes Somos'");
            expect(content).not.toContain("en: 'About Us'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(content).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should pass pageTitle and pageDescription to BaseLayout', () => {
            expect(content).toContain('title={pageTitle}');
            expect(content).toContain('description={pageDescription}');
        });

        it('should pass pageTitle and pageDescription to SEOHead', () => {
            expect(content).toContain('title={pageTitle}');
            expect(content).toContain('description={pageDescription}');
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

        it('should have about us page breadcrumb using pageTitle', () => {
            expect(content).toContain('{ label: pageTitle, href: `/${locale}/quienes-somos/`');
        });
    });

    describe('Content sections', () => {
        it('should have hero section', () => {
            expect(content).toContain('id="hero"');
            expect(content).toContain('{heroText}');
        });

        it('should have mission section', () => {
            expect(content).toContain('id="mission"');
            expect(content).toContain('{missionTitle}');
            expect(content).toContain('{missionText}');
        });

        it('should have values section', () => {
            expect(content).toContain('id="values"');
            expect(content).toContain('{valuesTitle}');
        });

        it('should have region section', () => {
            expect(content).toContain('id="region"');
            expect(content).toContain('{regionTitle}');
            expect(content).toContain('{regionText1}');
            expect(content).toContain('{regionText2}');
        });

        it('should have contact CTA section', () => {
            expect(content).toContain('id="contact-cta"');
            expect(content).toContain('{ctaTitle}');
            expect(content).toContain('{ctaText}');
        });
    });

    describe('Values content', () => {
        it('should build values array from t() calls', () => {
            expect(content).toContain('const values = [');
            expect(content).toContain("key: 'page.values.authenticity.title'");
            expect(content).toContain("key: 'page.values.community.title'");
            expect(content).toContain("key: 'page.values.quality.title'");
            expect(content).toContain("key: 'page.values.sustainability.title'");
        });

        it('should iterate values array in template', () => {
            expect(content).toContain('values.map((value, index)');
            expect(content).toContain('{value.title}');
            expect(content).toContain('{value.text}');
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
        it('should have icon component imports from @repo/icons', () => {
            expect(content).toContain("from '@repo/icons'");
        });

        it('should import CheckIcon for values', () => {
            expect(content).toContain('CheckIcon');
        });

        it('should import UsersIcon for community', () => {
            expect(content).toContain('UsersIcon');
        });

        it('should import CheckCircleIcon for quality', () => {
            expect(content).toContain('CheckCircleIcon');
        });

        it('should import GlobeIcon for sustainability', () => {
            expect(content).toContain('GlobeIcon');
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
