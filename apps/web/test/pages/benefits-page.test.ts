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
            expect(content).toContain("namespace: 'benefits'");
            expect(content).toContain("'page.title'");
        });

        it('should use t() for localized descriptions', () => {
            expect(content).toContain("namespace: 'benefits'");
            expect(content).toContain("'page.description'");
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
            expect(content).toContain("'hero.description'");
        });

        it('should have tourist benefits section', () => {
            expect(content).toContain('id="tourist-benefits"');
            expect(content).toContain("'tourists.heading'");
        });

        it('should have owner benefits section', () => {
            expect(content).toContain('id="owner-benefits"');
            expect(content).toContain("'owners.heading'");
        });

        it('should have CTA section', () => {
            expect(content).toContain('id="cta-section"');
            expect(content).toContain("'plans.heading'");
        });
    });

    describe('Tourist benefits', () => {
        it('should have wide selection benefit', () => {
            expect(content).toContain("'tourists.wideSelection.title'");
            expect(content).toContain("'tourists.wideSelection.description'");
        });

        it('should have secure booking benefit', () => {
            expect(content).toContain("'tourists.secureBooking.title'");
            expect(content).toContain("'tourists.secureBooking.description'");
        });

        it('should have authentic experiences benefit', () => {
            expect(content).toContain("'tourists.authenticExperiences.title'");
            expect(content).toContain("'tourists.authenticExperiences.description'");
        });

        it('should have real reviews benefit', () => {
            expect(content).toContain("'tourists.realReviews.title'");
            expect(content).toContain("'tourists.realReviews.description'");
        });

        it('should have customer support benefit', () => {
            expect(content).toContain("'tourists.customerSupport.title'");
            expect(content).toContain("'tourists.customerSupport.description'");
        });
    });

    describe('Owner benefits', () => {
        it('should have increased visibility benefit', () => {
            expect(content).toContain("'owners.increasedVisibility.title'");
            expect(content).toContain("'owners.increasedVisibility.description'");
        });

        it('should have easy management benefit', () => {
            expect(content).toContain("'owners.easyManagement.title'");
            expect(content).toContain("'owners.easyManagement.description'");
        });

        it('should have secure payments benefit', () => {
            expect(content).toContain("'owners.securePayments.title'");
            expect(content).toContain("'owners.securePayments.description'");
        });

        it('should have analytics benefit', () => {
            expect(content).toContain("'owners.analytics.title'");
            expect(content).toContain("'owners.analytics.description'");
        });

        it('should have growing community benefit', () => {
            expect(content).toContain("'owners.growingCommunity.title'");
            expect(content).toContain("'owners.growingCommunity.description'");
        });
    });

    describe('Call to Action links', () => {
        it('should have tourist pricing link', () => {
            expect(content).toContain('href={`/${locale}/precios-turistas/`}');
            expect(content).toContain("'plans.touristPricing'");
        });

        it('should have owner pricing link', () => {
            expect(content).toContain('href={`/${locale}/precios-propietarios/`}');
            expect(content).toContain("'plans.ownerPricing'");
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
