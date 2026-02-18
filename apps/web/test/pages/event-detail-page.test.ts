/**
 * Tests for Event Detail page.
 * Verifies page structure, SEO elements, localization, and content sections.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const eventDetailPath = resolve(__dirname, '../../src/pages/[lang]/eventos/[slug].astro');
const content = readFileSync(eventDetailPath, 'utf8');

describe('[slug].astro (Event Detail)', () => {
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

        it('should use EventJsonLd component', () => {
            expect(content).toContain(
                "import EventJsonLd from '../../../components/seo/EventJsonLd.astro'"
            );
            expect(content).toContain('<EventJsonLd');
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
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(content).toContain('const { lang, slug } = Astro.params');
            expect(content).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(content).toContain('isValidLocale');
            expect(content).toContain('type SupportedLocale');
        });

        it('should import eventsApi', () => {
            expect(content).toContain("import { eventsApi } from '../../../lib/api/endpoints'");
        });
    });

    describe('API Integration', () => {
        it('should define getStaticPaths function', () => {
            expect(content).toContain('export async function getStaticPaths()');
        });

        it('should call eventsApi.list in getStaticPaths', () => {
            expect(content).toContain('await eventsApi.list({ pageSize: 500 })');
        });

        it('should check result.ok before using data', () => {
            expect(content).toContain('result.ok');
        });

        it('should fetch event from props or API', () => {
            expect(content).toContain('let event = Astro.props.event');
        });

        it('should redirect to list page if event not found', () => {
            expect(content).toContain('return Astro.redirect(`/${locale}/eventos/`)');
        });

        it('should enable prerender', () => {
            expect(content).toContain('export const prerender = true');
        });
    });

    describe('Rendering Strategy', () => {
        it('should use SSG with prerender', () => {
            expect(content).toContain('export const prerender = true');
        });

        it('should generate static paths for all locales', () => {
            expect(content).toContain("const locales = ['es', 'en', 'pt']");
        });
    });

    describe('Localization', () => {
        it('should have localized home breadcrumb labels', () => {
            expect(content).toContain('const homeLabels: Record<SupportedLocale, string>');
            expect(content).toContain("es: 'Inicio'");
            expect(content).toContain("en: 'Home'");
            expect(content).toContain("pt: 'Início'");
        });

        it('should have localized events breadcrumb labels', () => {
            expect(content).toContain('const eventsLabels: Record<SupportedLocale, string>');
            expect(content).toContain("es: 'Eventos'");
            expect(content).toContain("en: 'Events'");
            expect(content).toContain("pt: 'Eventos'");
        });

        it('should have localized section labels', () => {
            expect(content).toContain('const labels = {');
            expect(content).toContain('category:');
            expect(content).toContain('description:');
            expect(content).toContain('agenda:');
            expect(content).toContain('pricing:');
            expect(content).toContain('organizer:');
        });

        it('should have localized past event label', () => {
            expect(content).toContain('pastEvent:');
            expect(content).toContain("es: 'Evento Finalizado'");
            expect(content).toContain("en: 'Past Event'");
            expect(content).toContain("pt: 'Evento Encerrado'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(content).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(content).toContain('title={pageTitle}');
            expect(content).toContain('description={descriptions[locale]}');
        });

        it('should set page type to article', () => {
            expect(content).toContain('type="article"');
        });

        it('should include image in SEO meta', () => {
            expect(content).toContain('image={event.featuredImage || event.image}');
        });

        it('should include EventJsonLd structured data', () => {
            expect(content).toContain('name={event.name}');
            expect(content).toContain('startDate={event.startDate}');
            expect(content).toContain('location={event.location}');
            expect(content).toContain('organizer={event.organizer}');
        });
    });

    describe('Breadcrumb navigation', () => {
        it('should create breadcrumb items array', () => {
            expect(content).toContain('const breadcrumbItems = [');
        });

        it('should have home breadcrumb link', () => {
            expect(content).toContain('{ label: homeLabels[locale], href: `/${locale}/`');
        });

        it('should have events page breadcrumb', () => {
            expect(content).toContain('{ label: eventsLabels[locale], href: `/${locale}/eventos/`');
        });

        it('should have current event breadcrumb', () => {
            expect(content).toContain('{ label: pageTitle, href: `/${locale}/eventos/${slug}/`');
        });
    });

    describe('Content sections', () => {
        it('should have event header section', () => {
            expect(content).toContain('id="event-header"');
            expect(content).toContain('{event.name}');
            expect(content).toContain('{event.category}');
        });

        it('should have event image section', () => {
            expect(content).toContain('id="event-image"');
            expect(content).toContain('aspect-video');
        });

        it('should have event description section', () => {
            expect(content).toContain('id="event-description"');
            expect(content).toContain('{labels.description[locale]}');
            expect(content).toContain('{event.description');
        });

        it('should have event schedule/agenda section', () => {
            expect(content).toContain('id="event-schedule"');
            expect(content).toContain('{labels.agenda[locale]}');
            expect(content).toContain('{event.agenda.map');
        });

        it('should have event pricing section', () => {
            expect(content).toContain('id="event-pricing"');
            expect(content).toContain('{labels.pricing[locale]}');
            expect(content).toContain('{event.price}');
        });

        it('should have organizer info section', () => {
            expect(content).toContain('id="event-organizer"');
            expect(content).toContain('{labels.organizer[locale]}');
            expect(content).toContain('{event.organizer}');
        });

        it('should have related events section', () => {
            expect(content).toContain('id="related-events"');
            expect(content).toContain('{labels.relatedEvents[locale]}');
        });

        it('should have share buttons section', () => {
            expect(content).toContain('id="share-buttons"');
            expect(content).toContain('{labels.shareEvent[locale]}');
        });
    });

    describe('Event meta information', () => {
        it('should display event date', () => {
            expect(content).toContain('id="event-meta"');
            expect(content).toContain('{labels.date[locale]}');
            expect(content).toContain('{formatDate(event.startDate)}');
        });

        it('should display event time', () => {
            expect(content).toContain('{labels.time[locale]}');
            expect(content).toContain('{formatTime(event.startDate)}');
        });

        it('should display event location', () => {
            expect(content).toContain('{labels.location[locale]}');
            expect(content).toContain('{event.location.name}');
        });

        it('should have date formatting function', () => {
            expect(content).toContain('const formatDate = (dateString: string)');
            expect(content).toContain('toLocaleDateString');
        });

        it('should have time formatting function', () => {
            expect(content).toContain('const formatTime = (dateString: string)');
            expect(content).toContain('toLocaleTimeString');
        });
    });

    describe('Past event handling', () => {
        it('should have isPastEvent flag', () => {
            expect(content).toContain('const isPastEvent =');
        });

        it('should display past event badge when event is past', () => {
            expect(content).toContain('id="past-event-badge"');
            expect(content).toContain('{isPastEvent &&');
            expect(content).toContain('{labels.pastEvent[locale]}');
        });

        it('should conditionally show ticket button based on past event status', () => {
            expect(content).toContain('{!isPastEvent &&');
            expect(content).toContain('{labels.getTickets[locale]}');
        });
    });

    describe('Agenda/Schedule content', () => {
        it('should render agenda items as ordered list', () => {
            expect(content).toContain('<ol');
            expect(content).toContain(
                '{event.agenda.map((item: { time?: string; title?: string; description?: string }, index: number)'
            );
        });

        it('should display agenda item number', () => {
            expect(content).toContain('{index + 1}');
        });

        it('should display agenda item time', () => {
            expect(content).toContain('{item.time}');
        });

        it('should display agenda item title and description', () => {
            expect(content).toContain('{item.title}');
            expect(content).toContain('{item.description}');
        });
    });

    describe('Ticket/Pricing section', () => {
        it('should display price prominently', () => {
            expect(content).toContain('text-2xl font-bold text-primary');
        });

        it('should have external ticket link', () => {
            expect(content).toContain('href={event.ticketUrl}');
            expect(content).toContain('target="_blank"');
            expect(content).toContain('rel="noopener noreferrer"');
        });
    });

    describe('Page styling', () => {
        it('should have main heading with proper styling', () => {
            expect(content).toContain('text-4xl font-bold');
            expect(content).toContain('md:text-5xl');
        });

        it('should have section headings', () => {
            expect(content).toContain('text-2xl font-semibold');
            expect(content).toContain('text-3xl font-semibold');
        });

        it('should use card-like sections with background', () => {
            expect(content).toContain('rounded-lg bg-bg p-6 shadow-sm');
        });

        it('should have grid layout for main content and sidebar', () => {
            expect(content).toContain('grid gap-8 lg:grid-cols-3');
            expect(content).toContain('lg:col-span-2');
        });

        it('should have category badge styling', () => {
            expect(content).toContain('rounded-full bg-primary/10');
            expect(content).toContain('text-primary');
        });
    });

    describe('Icons and SVG', () => {
        it('should import icon components from @repo/icons', () => {
            expect(content).toContain("from '@repo/icons'");
        });

        it('should import CalendarIcon for date', () => {
            expect(content).toContain('CalendarIcon');
        });

        it('should import ClockIcon for time', () => {
            expect(content).toContain('ClockIcon');
        });

        it('should import LocationIcon for location', () => {
            expect(content).toContain('LocationIcon');
        });

        it('should import ImageIcon for images', () => {
            expect(content).toContain('ImageIcon');
        });
    });

    describe('Event data handling', () => {
        it('should handle event from props or API', () => {
            expect(content).toContain('let event = Astro.props.event');
        });

        it('should check for event slug', () => {
            expect(content).toContain('event.name');
            expect(content).toContain('event.category');
            expect(content).toContain('event.description');
        });

        it('should handle event date properties', () => {
            expect(content).toContain('event.startDate');
            expect(content).toContain('event.endDate');
        });

        it('should handle location object', () => {
            expect(content).toContain('event.location');
        });

        it('should handle pricing and ticketing info', () => {
            expect(content).toContain('event.price');
            expect(content).toContain('event.ticketUrl');
        });

        it('should handle agenda array', () => {
            expect(content).toContain('event.agenda');
        });

        it('should handle organizer info', () => {
            expect(content).toContain('event.organizer');
        });
    });

    describe('Accessibility', () => {
        it('should have proper heading hierarchy', () => {
            expect(content).toContain('<h1');
            expect(content).toContain('<h2');
            expect(content).toContain('<h3');
        });

        it('should have aria-label for related events region', () => {
            expect(content).toContain('aria-label={labels.relatedEvents[locale]}');
        });

        it('should have aria-hidden on decorative SVG icons', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });
});
