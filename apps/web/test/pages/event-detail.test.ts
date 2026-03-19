import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/eventos/[slug].astro');
const content = readFileSync(pagePath, 'utf8');

describe('[lang]/eventos/[slug].astro', () => {
    describe('Rendering mode', () => {
        it('should use SSR (no prerender export)', () => {
            expect(content).not.toContain('export const prerender = true');
        });

        it('should use getLocaleFromParams for runtime locale resolution', () => {
            expect(content).toContain('getLocaleFromParams');
        });
    });

    describe('Imports', () => {
        it('should import BaseLayout', () => {
            expect(content).toContain('import BaseLayout from');
            expect(content).toContain('BaseLayout.astro');
        });

        it('should import SEOHead', () => {
            expect(content).toContain('import SEOHead from');
            expect(content).toContain('SEOHead.astro');
        });

        it('should import EventJsonLd from seo', () => {
            expect(content).toContain('EventJsonLd');
            expect(content).toContain('seo/EventJsonLd.astro');
        });

        it('should import Breadcrumb from shared', () => {
            expect(content).toContain('import Breadcrumb from');
            expect(content).toContain('shared/Breadcrumb.astro');
        });

        it('should import ShareButtons client island from shared', () => {
            expect(content).toContain('ShareButtons');
            expect(content).toContain('shared/ShareButtons.client');
        });

        it('should import icon components from @repo/icons', () => {
            expect(content).toContain('@repo/icons');
            expect(content).toContain('CalendarIcon');
            expect(content).toContain('ClockIcon');
            expect(content).toContain('LocationIcon');
            expect(content).toContain('TagIcon');
            expect(content).toContain('UserIcon');
        });

        it('should import eventsApi with alias eventsApiEndpoints', () => {
            expect(content).toContain('eventsApi as eventsApiEndpoints');
        });

        it('should import getLocaleFromParams and HOME_BREADCRUMB from page-helpers', () => {
            expect(content).toContain('getLocaleFromParams');
            expect(content).toContain('HOME_BREADCRUMB');
            expect(content).toContain("from '../../../lib/page-helpers'");
        });

        it('should import toEventCardProps transform', () => {
            expect(content).toContain('toEventCardProps');
        });

        it('should import extractFeaturedImageUrl', () => {
            expect(content).toContain('extractFeaturedImageUrl');
        });

        it('should import date formatting from @repo/i18n', () => {
            expect(content).toContain('formatDate as i18nFormatDate');
            expect(content).toContain('toBcp47Locale');
            expect(content).toContain('@repo/i18n');
        });

        it('should import buildUrl from urls', () => {
            expect(content).toContain('buildUrl');
            expect(content).toContain("from '../../../lib/urls'");
        });

        it('should import EventPublic from @repo/schemas', () => {
            expect(content).toContain('@repo/schemas');
            expect(content).toContain('EventPublic');
        });

        it('should import createT from i18n', () => {
            expect(content).toContain('createT');
            expect(content).toContain("from '../../../lib/i18n'");
        });
    });

    describe('SSR data fetching', () => {
        it('should fetch event by slug on every request', () => {
            expect(content).toContain('eventsApiEndpoints.getBySlug');
        });

        it('should read slug from Astro.params', () => {
            expect(content).toContain('Astro.params');
            expect(content).toContain('slug');
        });
    });

    describe('Data fetching', () => {
        it('should fetch event via SSR API call', () => {
            expect(content).toContain('eventsApiEndpoints.getBySlug');
        });

        it('should redirect on API error', () => {
            expect(content).toContain("buildUrl({ locale, path: 'eventos' })");
            expect(content).toContain('Astro.redirect');
        });

        it('should extract featured image URL', () => {
            expect(content).toContain('extractFeaturedImageUrl');
            expect(content).toContain('eventImageUrl');
        });

        it('should calculate if event is past', () => {
            expect(content).toContain('isPastEvent');
            expect(content).toContain('endDateRaw');
            expect(content).toContain('new Date()');
        });

        it('should fetch related upcoming events', () => {
            expect(content).toContain('eventsApiEndpoints.getUpcoming');
            expect(content).toContain('relatedEventCards');
        });

        it('should filter current event from related events', () => {
            expect(content).toContain('.filter((e) => e.slug !== slug)');
        });

        it('should limit related events to 3', () => {
            expect(content).toContain('.slice(0, 3)');
        });
    });

    describe('Date formatting', () => {
        it('should convert locale to BCP47 format', () => {
            expect(content).toContain('toBcp47Locale');
            expect(content).toContain('bcp47Locale');
        });

        it('should define formatDate function', () => {
            expect(content).toContain('function formatDate(dateString: string)');
            expect(content).toContain('i18nFormatDate');
        });

        it('should define formatTime function', () => {
            expect(content).toContain('function formatTime(dateString: string)');
            expect(content).toContain("'2-digit'");
        });

        it('should use date options with year month day', () => {
            expect(content).toContain("year: 'numeric'");
            expect(content).toContain("month: 'long'");
            expect(content).toContain("day: 'numeric'");
        });
    });

    describe('JSON-LD location', () => {
        it('should build jsonLdLocation object', () => {
            expect(content).toContain('jsonLdLocation');
            expect(content).toContain('Concepcion del Uruguay');
        });
    });

    describe('i18n', () => {
        it('should use locale from params', () => {
            expect(content).toContain('getLocaleFromParams');
        });

        it('should redirect on invalid locale', () => {
            expect(content).toContain("Astro.redirect('/es/')");
        });

        it('should use createT for translations', () => {
            expect(content).toContain('createT(locale)');
        });

        it('should use HOME_BREADCRUMB for breadcrumb home label', () => {
            expect(content).toContain('HOME_BREADCRUMB');
        });
    });

    describe('Template structure', () => {
        it('should render BaseLayout with event name as title', () => {
            expect(content).toContain('<BaseLayout');
            expect(content).toContain('title={eventName}');
        });

        it('should render SEOHead with article type', () => {
            expect(content).toContain('<SEOHead');
            expect(content).toContain('slot="head"');
            expect(content).toContain('type="article"');
        });

        it('should render EventJsonLd in head slot conditionally', () => {
            expect(content).toContain('<EventJsonLd');
            expect(content).toContain('slot="head"');
            expect(content).toContain('name={eventName}');
            expect(content).toContain('startDate={startDateRaw}');
        });

        it('should render Breadcrumb', () => {
            expect(content).toContain('<Breadcrumb');
            expect(content).toContain('items={breadcrumbItems}');
        });

        it('should render event header with id', () => {
            expect(content).toContain('id="event-header"');
        });

        it('should render TagIcon for category badge', () => {
            expect(content).toContain('<TagIcon');
            expect(content).toContain('eventCategory');
        });

        it('should render past event badge conditionally', () => {
            expect(content).toContain('id="past-event-badge"');
            expect(content).toContain('isPastEvent');
        });

        it('should render event name as h1', () => {
            expect(content).toContain('{eventName}');
            expect(content).toContain('text-4xl font-bold');
        });

        it('should render event metadata with id', () => {
            expect(content).toContain('id="event-meta"');
        });

        it('should render CalendarIcon for date', () => {
            expect(content).toContain('<CalendarIcon');
            expect(content).toContain('formatDate(startDateRaw)');
        });

        it('should render ClockIcon for time', () => {
            expect(content).toContain('<ClockIcon');
            expect(content).toContain('formatTime(startDateRaw)');
        });

        it('should render LocationIcon for location', () => {
            expect(content).toContain('<LocationIcon');
            expect(content).toContain('eventLocation');
        });

        it('should render event image area with id', () => {
            expect(content).toContain('id="event-image"');
            expect(content).toContain('aspect-video');
        });

        it('should apply view transition on event image', () => {
            expect(content).toContain('transition:name={`entity-${slug}`}');
        });

        it('should render 2/3 + 1/3 grid layout', () => {
            expect(content).toContain('lg:grid-cols-3');
            expect(content).toContain('lg:col-span-2');
        });

        it('should render description section with id', () => {
            expect(content).toContain('id="event-description"');
            expect(content).toContain('eventDescription');
        });

        it('should render agenda section conditionally', () => {
            expect(content).toContain('id="event-schedule"');
            expect(content).toContain('Array.isArray(eventAgenda)');
        });

        it('should render agenda as ordered list', () => {
            expect(content).toContain('<ol');
            expect(content).toContain('item.time');
            expect(content).toContain('item.title');
        });

        it('should render ShareButtons with client:visible', () => {
            expect(content).toContain('ShareButtons');
            expect(content).toContain('client:visible');
            expect(content).toContain('id="share-buttons"');
        });

        it('should render pricing section conditionally in sidebar', () => {
            expect(content).toContain('id="event-pricing"');
            expect(content).toContain('eventPrice');
        });

        it('should render get tickets link for future events', () => {
            expect(content).toContain('!isPastEvent && eventTicketUrl');
        });

        it('should render organizer section with UserIcon', () => {
            expect(content).toContain('id="event-organizer"');
            expect(content).toContain('eventOrganizer');
            expect(content).toContain('<UserIcon');
        });

        it('should render location detail sidebar section', () => {
            expect(content).toContain('id="event-location-detail"');
            expect(content).toContain('eventLocation?.address');
        });

        it('should render related events section with inline cards', () => {
            expect(content).toContain('id="related-events"');
            expect(content).toContain('relatedEventCards');
        });

        it('should render related events with aria-label', () => {
            expect(content).toContain('aria-label=');
        });
    });

    describe('Canonical URL', () => {
        it('should build canonical URL from Astro.url and Astro.site', () => {
            expect(content).toContain('canonicalUrl');
            expect(content).toContain('Astro.url.pathname');
            expect(content).toContain('Astro.site');
        });
    });
});
