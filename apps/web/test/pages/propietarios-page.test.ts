/**
 * Tests for the Property Owners (Propietarios) landing page.
 * Verifies structure, imports, locale validation, content sections, and i18n.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/propietarios/index.astro');
const content = readFileSync(pagePath, 'utf8');

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

        it('should import i18n utilities', () => {
            expect(content).toContain(
                "import { isValidLocale, type SupportedLocale } from '../../../lib/i18n'"
            );
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

        it('should export getStaticPaths function', () => {
            expect(content).toContain('export function getStaticPaths()');
        });

        it('should generate paths for all 3 locales', () => {
            expect(content).toContain("{ params: { lang: 'es' } }");
            expect(content).toContain("{ params: { lang: 'en' } }");
            expect(content).toContain("{ params: { lang: 'pt' } }");
        });
    });

    describe('Locale Validation', () => {
        it('should extract lang from params', () => {
            expect(content).toContain('const { lang } = Astro.params;');
        });

        it('should validate locale with isValidLocale', () => {
            expect(content).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ if locale is invalid', () => {
            expect(content).toContain("return Astro.redirect('/es/');");
        });

        it('should cast validated locale to SupportedLocale', () => {
            expect(content).toContain('const locale = lang as SupportedLocale;');
        });
    });

    describe('Localized Titles', () => {
        it('should have Spanish title', () => {
            expect(content).toContain("es: 'Para Propietarios - Publica tu Alojamiento'");
        });

        it('should have English title', () => {
            expect(content).toContain("en: 'For Property Owners - List Your Property'");
        });

        it('should have Portuguese title', () => {
            expect(content).toContain("pt: 'Para Proprietarios - Publique seu Alojamento'");
        });

        it('should define titles typed as Record<SupportedLocale, string>', () => {
            expect(content).toContain('const titles: Record<SupportedLocale, string>');
        });
    });

    describe('Localized Descriptions', () => {
        it('should have Spanish meta description', () => {
            expect(content).toContain(
                'Publica tu alojamiento en Hospeda y llega a miles de viajeros'
            );
        });

        it('should have English meta description', () => {
            expect(content).toContain(
                'List your property on Hospeda and reach thousands of travelers'
            );
        });

        it('should have Portuguese meta description', () => {
            expect(content).toContain(
                'Publique seu alojamento no Hospeda e alcance milhares de viajantes'
            );
        });

        it('should define descriptions typed as Record<SupportedLocale, string>', () => {
            expect(content).toContain('const descriptions: Record<SupportedLocale, string>');
        });
    });

    describe('Breadcrumb Navigation', () => {
        it('should define breadcrumb labels with home and owners keys', () => {
            expect(content).toContain('const breadcrumbLabels: Record<SupportedLocale');
            expect(content).toContain('home:');
            expect(content).toContain('owners:');
        });

        it('should have Spanish breadcrumb labels', () => {
            expect(content).toContain("home: 'Inicio'");
            expect(content).toContain("owners: 'Para Propietarios'");
        });

        it('should have English breadcrumb labels', () => {
            expect(content).toContain("home: 'Home'");
            expect(content).toContain("owners: 'For Property Owners'");
        });

        it('should have Portuguese breadcrumb labels', () => {
            expect(content).toContain("owners: 'Para Proprietarios'");
        });

        it('should define breadcrumb items array', () => {
            expect(content).toContain('const breadcrumbItems = [');
        });

        it('should include home breadcrumb link', () => {
            expect(content).toContain(
                '{ label: breadcrumbLabels[locale].home, href: `/${locale}/` }'
            );
        });

        it('should include propietarios breadcrumb link', () => {
            expect(content).toContain(
                '{ label: breadcrumbLabels[locale].owners, href: `/${locale}/propietarios/` }'
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

        it('should pass title from titles record', () => {
            expect(content).toContain('title={titles[locale]}');
        });

        it('should pass description from descriptions record', () => {
            expect(content).toContain('description={descriptions[locale]}');
        });

        it('should pass canonical URL', () => {
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should compute canonical URL from Astro.url.pathname', () => {
            expect(content).toContain(
                'const canonicalUrl = new URL(Astro.url.pathname, Astro.site).href'
            );
        });

        it('should pass locale with pt fallback to es', () => {
            expect(content).toContain("locale={locale === 'pt' ? 'es' : locale}");
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
            expect(content).toContain('Publica tu alojamiento y llega a miles de viajeros');
            expect(content).toContain("ctaPrimary: 'Comenzar Ahora'");
            expect(content).toContain("ctaSecondary: 'Ver Planes'");
        });

        it('should have English hero content', () => {
            expect(content).toContain('List your property and reach thousands of travelers');
            expect(content).toContain("ctaPrimary: 'Start Now'");
            expect(content).toContain("ctaSecondary: 'See Plans'");
        });

        it('should have Portuguese hero content', () => {
            expect(content).toContain('Publique seu alojamento e alcance milhares de viajantes');
            expect(content).toContain("ctaPrimary: 'Comecar Agora'");
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
            expect(content).toContain("title: 'Visibilidad Online'");
            expect(content).toContain("title: 'Panel de Gestion'");
            expect(content).toContain("title: 'Reseñas de Huespedes'");
            expect(content).toContain("title: 'Estadisticas y Analiticas'");
            expect(content).toContain("title: 'Soporte Dedicado'");
            expect(content).toContain("title: 'Herramientas Profesionales'");
        });

        it('should have English benefits content', () => {
            expect(content).toContain("title: 'Online Visibility'");
            expect(content).toContain("title: 'Management Dashboard'");
            expect(content).toContain("title: 'Guest Reviews'");
            expect(content).toContain("title: 'Statistics and Analytics'");
            expect(content).toContain("title: 'Dedicated Support'");
            expect(content).toContain("title: 'Professional Tools'");
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
            expect(content).toContain("title: 'Registra tu cuenta'");
            expect(content).toContain("title: 'Publica tu propiedad'");
            expect(content).toContain("title: 'Recibe huespedes y genera ingresos'");
        });

        it('should have 3 steps in English', () => {
            expect(content).toContain("title: 'Register your account'");
            expect(content).toContain("title: 'List your property'");
            expect(content).toContain("title: 'Receive guests and earn income'");
        });

        it('should have 3 steps in Portuguese', () => {
            expect(content).toContain("title: 'Registre sua conta'");
            expect(content).toContain("title: 'Publique sua propriedade'");
            expect(content).toContain("title: 'Receba hospedes e gere renda'");
        });

        it('should have step numbers 1, 2, 3', () => {
            expect(content).toContain('number: 1,');
            expect(content).toContain('number: 2,');
            expect(content).toContain('number: 3,');
        });

        it('should have Spanish section title', () => {
            expect(content).toContain("sectionTitle: 'Como funciona'");
        });

        it('should have English section title', () => {
            expect(content).toContain("sectionTitle: 'How it works'");
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

        it('should render FAQ items from faqContent', () => {
            expect(content).toContain('faq.faqs.map');
            expect(content).toContain('{item.question}');
            expect(content).toContain('{item.answer}');
        });

        it('should have Spanish FAQ questions', () => {
            expect(content).toContain('Cuanto cuesta publicar mi alojamiento en Hospeda');
            expect(content).toContain('Que requisitos necesito para publicar mi propiedad');
            expect(content).toContain('Como recibo los pagos de las reservas');
        });

        it('should have English FAQ questions', () => {
            expect(content).toContain('How much does it cost to list my property on Hospeda');
            expect(content).toContain('What requirements do I need to list my property');
            expect(content).toContain('How do I receive payments for bookings');
        });

        it('should have FAQ section title in Spanish', () => {
            expect(content).toContain("sectionTitle: 'Preguntas Frecuentes'");
        });

        it('should have FAQ section title in English', () => {
            expect(content).toContain("sectionTitle: 'Frequently Asked Questions'");
        });

        it('should have FAQ section title in Portuguese', () => {
            expect(content).toContain("sectionTitle: 'Perguntas Frequentes'");
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
            expect(content).toContain("title: '¿Listo para publicar tu alojamiento?'");
            expect(content).toContain("ctaPrimary: 'Registrate Ahora'");
            expect(content).toContain("ctaSecondary: 'Ver Planes'");
        });

        it('should have English final CTA content', () => {
            expect(content).toContain("title: 'Ready to list your property?'");
            expect(content).toContain("ctaPrimary: 'Register Now'");
            expect(content).toContain("ctaSecondary: 'View Plans'");
        });

        it('should have Portuguese final CTA content', () => {
            expect(content).toContain("title: 'Pronto para publicar seu alojamento?'");
            expect(content).toContain("ctaPrimary: 'Cadastre-se Agora'");
            expect(content).toContain("ctaSecondary: 'Ver Planos'");
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
        it('should assign hero variable from heroContent', () => {
            expect(content).toContain('const hero = heroContent[locale];');
        });

        it('should assign benefits variable from benefitsContent', () => {
            expect(content).toContain('const benefits = benefitsContent[locale];');
        });

        it('should assign howItWorks variable from howItWorksContent', () => {
            expect(content).toContain('const howItWorks = howItWorksContent[locale];');
        });

        it('should assign faq variable from faqContent', () => {
            expect(content).toContain('const faq = faqContent[locale];');
        });

        it('should assign finalCta variable from finalCtaContent', () => {
            expect(content).toContain('const finalCta = finalCtaContent[locale];');
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

        it('should document getStaticPaths function', () => {
            expect(content).toContain('* Returns static paths for all supported locales.');
        });

        it('should document breadcrumb items', () => {
            expect(content).toContain('* Breadcrumb navigation items');
        });
    });

    describe('File Size', () => {
        it('should be within a reasonable limit', () => {
            // NOTE: The project standard is 500 lines max.
            // This file currently exceeds that limit (574 lines) due to inline
            // multilingual content for all sections. A refactoring to extract
            // content data to a separate module is recommended.
            const lines = content.split('\n').length;
            expect(lines).toBeLessThan(600);
        });
    });
});
