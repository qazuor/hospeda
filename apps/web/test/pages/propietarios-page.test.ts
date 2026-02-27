/**
 * Tests for the Property Owners (Propietarios) landing page.
 * Verifies structure, imports, locale validation, content sections, and i18n.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/propietarios/index.astro');
const content = readFileSync(pagePath, 'utf8');

const dataPath = resolve(__dirname, '../../src/lib/owners-page-data.ts');
const dataContent = readFileSync(dataPath, 'utf8');

describe('Propietarios Landing Page', () => {
    describe('Imports', () => {
        it('should import BaseLayout', () => {
            expect(content).toContain("import BaseLayout from '../../../layouts/BaseLayout.astro'");
        });

        it('should import SEOHead', () => {
            expect(content).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
        });

        it('should import Breadcrumb', () => {
            expect(content).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
        });

        it('should import Container', () => {
            expect(content).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
        });

        it('should import Section', () => {
            expect(content).toContain("import Section from '../../../components/ui/Section.astro'");
        });

        it('should import i18n utilities from page-helpers', () => {
            expect(content).toContain("from '../../../lib/page-helpers'");
            expect(content).toContain('getLocaleFromParams');
        });

        it('should import icon components from @repo/icons', () => {
            expect(content).toContain("from '@repo/icons'");
            expect(content).toContain('SearchIcon');
            expect(content).toContain('DashboardIcon');
            expect(content).toContain('StarIcon');
            expect(content).toContain('StatisticsIcon');
            expect(content).toContain('ChatIcon');
            expect(content).toContain('SettingsIcon');
            expect(content).toContain('CheckIcon');
        });
    });

    describe('Rendering Strategy (SSG)', () => {
        it('should enable prerendering', () => {
            expect(content).toContain('export const prerender = true;');
        });

        it('should export getStaticPaths via page-helpers', () => {
            expect(content).toContain('getStaticLocalePaths as getStaticPaths');
        });

        it('should import from page-helpers', () => {
            expect(content).toContain("from '../../../lib/page-helpers'");
        });
    });

    describe('Locale Validation', () => {
        it('should validate locale parameter', () => {
            expect(content).toContain('getLocaleFromParams(Astro.params)');
            expect(content).toContain('if (!locale)');
        });

        it('should redirect to /es/ if locale is invalid', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(content).toContain('getLocaleFromParams');
            expect(content).toContain('HOME_BREADCRUMB');
        });
    });

    describe('Localized Titles', () => {
        it('should use owners namespace for title', () => {
            expect(content).toContain("namespace: 'owners'");
        });

        it('should use page.title key for title', () => {
            expect(content).toContain("key: 'page.title'");
        });

        it('should assign pageTitle via t()', () => {
            expect(content).toContain('const pageTitle = t({');
        });
    });

    describe('Localized Descriptions', () => {
        it('should use page.description key for description', () => {
            expect(content).toContain("key: 'page.description'");
        });

        it('should assign pageDescription via t()', () => {
            expect(content).toContain('const pageDescription = t({');
        });
    });

    describe('Breadcrumb Navigation', () => {
        it('should use HOME_BREADCRUMB for home breadcrumb label', () => {
            expect(content).toContain('HOME_BREADCRUMB[locale]');
        });

        it('should use breadcrumbLabel variable for owners breadcrumb', () => {
            expect(content).toContain('breadcrumbLabel');
        });

        it('should use page.breadcrumb key for owners label', () => {
            expect(content).toContain("key: 'page.breadcrumb'");
        });

        it('should define breadcrumb items array', () => {
            expect(content).toContain('const breadcrumbItems = [');
        });

        it('should include home breadcrumb link', () => {
            expect(content).toContain('{ label: HOME_BREADCRUMB[locale], href: `/${locale}/` }');
        });

        it('should include propietarios breadcrumb link', () => {
            expect(content).toContain(
                '{ label: breadcrumbLabel, href: `/${locale}/propietarios/` }'
            );
        });

        it('should render Breadcrumb component with items', () => {
            expect(content).toContain('<Breadcrumb items={breadcrumbItems}');
        });
    });

    describe('SEOHead', () => {
        it('should render SEOHead in head slot', () => {
            expect(content).toContain('<SEOHead');
            expect(content).toContain('slot="head"');
        });

        it('should pass pageTitle to title prop', () => {
            expect(content).toContain('title={pageTitle}');
        });

        it('should pass pageDescription to description prop', () => {
            expect(content).toContain('description={pageDescription}');
        });

        it('should pass canonical URL', () => {
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should compute canonical URL from Astro.url.pathname', () => {
            expect(content).toContain(
                'const canonicalUrl = new URL(Astro.url.pathname, Astro.site).href'
            );
        });

        it('should pass locale to SEOHead', () => {
            expect(content).toContain('locale={locale}');
        });

        it('should set type to website', () => {
            expect(content).toContain('type="website"');
        });
    });

    describe('Hero Section', () => {
        it('should have hero section with id', () => {
            expect(content).toContain('id="hero"');
        });

        it('should have h1 heading with hero headline', () => {
            expect(content).toContain('{hero.headline}');
        });

        it('should have subheadline paragraph', () => {
            expect(content).toContain('{hero.subheadline}');
        });

        it('should have primary CTA button linking to signup', () => {
            expect(content).toContain('href={`/${locale}/auth/signup/`}');
            expect(content).toContain('{hero.ctaPrimary}');
        });

        it('should have secondary CTA linking to pricing page', () => {
            expect(content).toContain('href={`/${locale}/precios/propietarios/`}');
            expect(content).toContain('{hero.ctaSecondary}');
        });

        it('should have Spanish hero content', () => {
            expect(dataContent).toContain('Publica tu alojamiento y llega a miles de viajeros');
            expect(dataContent).toContain("ctaPrimary: 'Comenzar Ahora'");
            expect(dataContent).toContain("ctaSecondary: 'Ver Planes'");
        });

        it('should have English hero content', () => {
            expect(dataContent).toContain('List your property and reach thousands of travelers');
            expect(dataContent).toContain("ctaPrimary: 'Start Now'");
            expect(dataContent).toContain("ctaSecondary: 'See Plans'");
        });

        it('should have Portuguese hero content', () => {
            expect(dataContent).toContain(
                'Publique seu alojamento e alcance milhares de viajantes'
            );
            expect(dataContent).toContain("ctaPrimary: 'Comecar Agora'");
        });
    });

    describe('Benefits Section', () => {
        it('should have benefits section with id', () => {
            expect(content).toContain('id="benefits"');
        });

        it('should render benefits grid', () => {
            expect(content).toContain('benefits.benefits.map');
        });

        it('should have 6 benefit icons rendered', () => {
            expect(content).toContain("benefit.icon === 'search'");
            expect(content).toContain("benefit.icon === 'dashboard'");
            expect(content).toContain("benefit.icon === 'star'");
            expect(content).toContain("benefit.icon === 'statistics'");
            expect(content).toContain("benefit.icon === 'chat'");
            expect(content).toContain("benefit.icon === 'settings'");
        });

        it('should use icon components for benefits', () => {
            expect(content).toContain('<SearchIcon');
            expect(content).toContain('<DashboardIcon');
            expect(content).toContain('<StarIcon');
            expect(content).toContain('<StatisticsIcon');
            expect(content).toContain('<ChatIcon');
            expect(content).toContain('<SettingsIcon');
        });

        it('should have Spanish benefits content', () => {
            expect(dataContent).toContain("title: 'Visibilidad Online'");
            expect(dataContent).toContain("title: 'Panel de Gestion'");
            expect(dataContent).toContain("title: 'Reseñas de Huespedes'");
            expect(dataContent).toContain("title: 'Estadisticas y Analiticas'");
            expect(dataContent).toContain("title: 'Soporte Dedicado'");
            expect(dataContent).toContain("title: 'Herramientas Profesionales'");
        });

        it('should have English benefits content', () => {
            expect(dataContent).toContain("title: 'Online Visibility'");
            expect(dataContent).toContain("title: 'Management Dashboard'");
            expect(dataContent).toContain("title: 'Guest Reviews'");
            expect(dataContent).toContain("title: 'Statistics and Analytics'");
            expect(dataContent).toContain("title: 'Dedicated Support'");
            expect(dataContent).toContain("title: 'Professional Tools'");
        });

        it('should have section title and subtitle props', () => {
            expect(content).toContain('title={benefits.sectionTitle}');
            expect(content).toContain('subtitle={benefits.sectionSubtitle}');
        });

        it('should have responsive grid for benefits', () => {
            expect(content).toContain('grid gap-6 sm:grid-cols-2 lg:grid-cols-3');
        });

        it('should use article elements for benefit cards', () => {
            expect(content).toContain('<article class="flex flex-col gap-4 rounded-xl');
        });

        it('should render benefit title as h3', () => {
            expect(content).toContain('{benefit.title}');
            expect(content).toContain('{benefit.description}');
        });
    });

    describe('How It Works Section', () => {
        it('should have how-it-works section with id', () => {
            expect(content).toContain('id="how-it-works"');
        });

        it('should render steps as ordered list', () => {
            expect(content).toContain('<ol');
            expect(content).toContain('howItWorks.steps.map');
        });

        it('should render step numbers', () => {
            expect(content).toContain('{step.number}');
            expect(content).toContain('{step.title}');
            expect(content).toContain('{step.description}');
        });

        it('should have 3 steps in Spanish', () => {
            expect(dataContent).toContain("title: 'Registra tu cuenta'");
            expect(dataContent).toContain("title: 'Publica tu propiedad'");
            expect(dataContent).toContain("title: 'Recibe huespedes y genera ingresos'");
        });

        it('should have 3 steps in English', () => {
            expect(dataContent).toContain("title: 'Register your account'");
            expect(dataContent).toContain("title: 'List your property'");
            expect(dataContent).toContain("title: 'Receive guests and earn income'");
        });

        it('should have 3 steps in Portuguese', () => {
            expect(dataContent).toContain("title: 'Registre sua conta'");
            expect(dataContent).toContain("title: 'Publique sua propriedade'");
            expect(dataContent).toContain("title: 'Receba hospedes e gere renda'");
        });

        it('should have step numbers 1, 2, 3', () => {
            expect(dataContent).toContain('number: 1,');
            expect(dataContent).toContain('number: 2,');
            expect(dataContent).toContain('number: 3,');
        });

        it('should have Spanish section title', () => {
            expect(dataContent).toContain("sectionTitle: 'Como funciona'");
        });

        it('should have English section title', () => {
            expect(dataContent).toContain("sectionTitle: 'How it works'");
        });

        it('should have section title and subtitle props', () => {
            expect(content).toContain('title={howItWorks.sectionTitle}');
            expect(content).toContain('subtitle={howItWorks.sectionSubtitle}');
        });
    });

    describe('FAQ Section', () => {
        it('should have faq section with id', () => {
            expect(content).toContain('id="faq"');
        });

        it('should render FAQ as details/summary elements', () => {
            expect(content).toContain('<details');
            expect(content).toContain('<summary');
        });

        it('should render FAQ items from faq data', () => {
            expect(content).toContain('faq.faqs.map');
            expect(content).toContain('{item.question}');
            expect(content).toContain('{item.answer}');
        });

        it('should have Spanish FAQ questions', () => {
            expect(dataContent).toContain('Cuanto cuesta publicar mi alojamiento en Hospeda');
            expect(dataContent).toContain('Que requisitos necesito para publicar mi propiedad');
            expect(dataContent).toContain('Como recibo los pagos de las reservas');
        });

        it('should have English FAQ questions', () => {
            expect(dataContent).toContain('How much does it cost to list my property on Hospeda');
            expect(dataContent).toContain('What requirements do I need to list my property');
            expect(dataContent).toContain('How do I receive payments for bookings');
        });

        it('should have FAQ section title in Spanish', () => {
            expect(dataContent).toContain("sectionTitle: 'Preguntas Frecuentes'");
        });

        it('should have FAQ section title in English', () => {
            expect(dataContent).toContain("sectionTitle: 'Frequently Asked Questions'");
        });

        it('should have FAQ section title in Portuguese', () => {
            expect(dataContent).toContain("sectionTitle: 'Perguntas Frequentes'");
        });

        it('should use CheckIcon in FAQ toggle', () => {
            expect(content).toContain('<CheckIcon');
        });

        it('should use indexed ids for FAQ questions', () => {
            expect(content).toContain('id={`faq-question-${index}`}');
        });
    });

    describe('Final CTA Section', () => {
        it('should have final-cta section with id', () => {
            expect(content).toContain('id="final-cta"');
        });

        it('should have gradient background styling', () => {
            expect(content).toContain('bg-gradient-to-r from-primary to-primary-dark');
        });

        it('should have Spanish final CTA content', () => {
            expect(dataContent).toContain("title: '¿Listo para publicar tu alojamiento?'");
            expect(dataContent).toContain("ctaPrimary: 'Registrate Ahora'");
            expect(dataContent).toContain("ctaSecondary: 'Ver Planes'");
        });

        it('should have English final CTA content', () => {
            expect(dataContent).toContain("title: 'Ready to list your property?'");
            expect(dataContent).toContain("ctaPrimary: 'Register Now'");
            expect(dataContent).toContain("ctaSecondary: 'View Plans'");
        });

        it('should have Portuguese final CTA content', () => {
            expect(dataContent).toContain("title: 'Pronto para publicar seu alojamento?'");
            expect(dataContent).toContain("ctaPrimary: 'Cadastre-se Agora'");
            expect(dataContent).toContain("ctaSecondary: 'Ver Planos'");
        });

        it('should have primary CTA linking to signup', () => {
            expect(content).toContain('{finalCta.ctaPrimary}');
        });

        it('should have secondary CTA linking to owner pricing', () => {
            expect(content).toContain('{finalCta.ctaSecondary}');
        });

        it('should have aria-labelledby for accessibility', () => {
            expect(content).toContain('aria-labelledby="final-cta-title"');
        });

        it('should have h2 with matching id for labeling', () => {
            expect(content).toContain('id="final-cta-title"');
        });
    });

    describe('Localized Text Variables', () => {
        it('should assign hero variable from OWNER_HERO', () => {
            expect(content).toContain('const hero = OWNER_HERO[locale];');
        });

        it('should assign benefits variable from OWNER_BENEFITS', () => {
            expect(content).toContain('const benefits = OWNER_BENEFITS[locale];');
        });

        it('should assign howItWorks variable from OWNER_HOW_IT_WORKS', () => {
            expect(content).toContain('const howItWorks = OWNER_HOW_IT_WORKS[locale];');
        });

        it('should assign faq variable from OWNER_FAQ', () => {
            expect(content).toContain('const faq = OWNER_FAQ[locale];');
        });

        it('should assign finalCta variable from OWNER_FINAL_CTA', () => {
            expect(content).toContain('const finalCta = OWNER_FINAL_CTA[locale];');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-hidden on decorative icon containers', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have accessible ordered list for steps', () => {
            expect(content).toContain('aria-label={howItWorks.sectionTitle}');
        });

        it('should have focus-visible styles on CTA links', () => {
            expect(content).toContain('focus-visible:outline');
            expect(content).toContain('focus-visible:outline-2');
            expect(content).toContain('focus-visible:outline-offset-2');
        });
    });

    describe('Responsive Design', () => {
        it('should have responsive hero heading', () => {
            expect(content).toContain('text-4xl font-bold');
            expect(content).toContain('md:text-5xl');
            expect(content).toContain('lg:text-6xl');
        });

        it('should have responsive CTA button layout', () => {
            expect(content).toContain(
                'flex flex-col items-center justify-center gap-4 sm:flex-row'
            );
        });

        it('should have responsive benefits grid', () => {
            expect(content).toContain('grid gap-6 sm:grid-cols-2 lg:grid-cols-3');
        });

        it('should have responsive steps layout', () => {
            expect(content).toContain('flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6');
        });
    });

    describe('JSDoc Documentation', () => {
        it('should have page documentation', () => {
            expect(content).toContain('/**');
            expect(content).toContain('* Property Owners (Propietarios) landing page');
            expect(content).toContain('* @route /[lang]/propietarios/');
            expect(content).toContain('* @rendering SSG (Static Site Generation)');
        });

        it('should re-export getStaticLocalePaths as getStaticPaths', () => {
            expect(content).toContain('getStaticLocalePaths as getStaticPaths');
        });

        it('should document faq json-ld structured data', () => {
            expect(content).toContain('* FAQPage JSON-LD structured data');
        });
    });

    describe('File Size', () => {
        it('should be within a reasonable limit', () => {
            // NOTE: The project standard is 500 lines max.
            // This file currently exceeds that limit (574 lines) due to inline
            // Content data extracted to owners-page-data.ts
            const lines = content.split('\n').length;
            expect(lines).toBeLessThan(500);
        });
    });
});
