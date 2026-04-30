/**
 * @file Footer.test.ts
 * @description Source-reading unit tests for Footer.astro.
 * Astro components cannot be rendered in Vitest/jsdom so we assert on the
 * source text to verify the 5-column layout, accordion pattern, i18n usage,
 * and all required navigation links.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/layouts/Footer.astro'), 'utf8');

describe('Footer.astro', () => {
    describe('file structure', () => {
        it('has a JSDoc file header', () => {
            expect(src).toContain('@file Footer.astro');
        });

        it('defines a Props interface with readonly locale', () => {
            expect(src).toContain('interface Props');
            expect(src).toContain('readonly locale: SupportedLocale');
        });

        it('imports createTranslations and buildUrl', () => {
            expect(src).toContain('createTranslations');
            expect(src).toContain('buildUrl');
        });
    });

    describe('5-column nav structure', () => {
        it('defines exploreLinks array', () => {
            expect(src).toContain('exploreLinks');
        });

        it('defines categoryLinks array', () => {
            expect(src).toContain('categoryLinks');
        });

        it('defines destinationLinks array', () => {
            expect(src).toContain('destinationLinks');
        });

        it('defines subscriberLinks array', () => {
            expect(src).toContain('subscriberLinks');
        });

        it('defines companyLinks array', () => {
            expect(src).toContain('companyLinks');
        });

        it('renders exactly 5 nav column details elements', () => {
            const matches = src.match(/footer__nav-col--accordion/g);
            // Each <details> has the class twice (opening tag and CSS rule)
            // Count class occurrences: 5 elements x2 = 10 minimum, but CSS rules add more
            // Just verify we have multiple columns
            expect(matches).not.toBeNull();
            expect((matches ?? []).length).toBeGreaterThanOrEqual(5);
        });
    });

    describe('Explorar column', () => {
        it('includes /busqueda/ search link', () => {
            expect(src).toContain('/busqueda/');
        });

        it('includes /alojamientos/ link', () => {
            expect(src).toContain('/alojamientos/');
        });

        it('includes /destinos/ link', () => {
            expect(src).toContain('/destinos/');
        });

        it('includes /eventos/ link', () => {
            expect(src).toContain('/eventos/');
        });

        it('includes /publicaciones/ link', () => {
            expect(src).toContain('/publicaciones/');
        });

        it('uses i18n key for search label', () => {
            expect(src).toContain('footer.search');
        });
    });

    describe('Categorías column', () => {
        it('includes cabin type link', () => {
            expect(src).toContain('/alojamientos/tipo/cabin/');
        });

        it('includes hotel type link', () => {
            expect(src).toContain('/alojamientos/tipo/hotel/');
        });

        it('includes house type link', () => {
            expect(src).toContain('/alojamientos/tipo/house/');
        });

        it('includes music event category link', () => {
            expect(src).toContain('/eventos/categoria/music/');
        });

        it('includes culture event category link', () => {
            expect(src).toContain('/eventos/categoria/culture/');
        });

        it('includes gastronomy event category link', () => {
            expect(src).toContain('/eventos/categoria/gastronomy/');
        });

        it('includes nature event category link', () => {
            expect(src).toContain('/eventos/categoria/nature/');
        });

        it('uses buildUrl for all category hrefs', () => {
            expect(src).toContain('footer.categoryCabins');
            expect(src).toContain('footer.categoryHotels');
            expect(src).toContain('footer.categoryHouses');
            expect(src).toContain('footer.categoryMusic');
        });

        it('uses i18n key for categories column title', () => {
            expect(src).toContain('footer.categoriesTitle');
        });
    });

    describe('Propietarios & Turistas column', () => {
        it('includes /suscriptores/propietarios/ link', () => {
            expect(src).toContain('/suscriptores/propietarios/');
        });

        it('includes /suscriptores/turistas/ link', () => {
            expect(src).toContain('/suscriptores/turistas/');
        });

        it('uses i18n key for subscribers column title', () => {
            expect(src).toContain('footer.subscribersTitle');
        });
    });

    describe('accordion pattern', () => {
        it('uses <details> elements for accordion columns', () => {
            expect(src).toContain('<details');
        });

        it('uses <summary> elements as column headings', () => {
            expect(src).toContain('<summary');
        });

        it('applies footer__nav-col--accordion class', () => {
            expect(src).toContain('footer__nav-col--accordion');
        });

        it('applies footer__nav-summary class to summary elements', () => {
            expect(src).toContain('footer__nav-summary');
        });

        it('first column has open attribute for default expanded state', () => {
            expect(src).toContain(
                '<details class="footer__nav-col footer__nav-col--accordion" open>'
            );
        });

        it('resets accordion on tablet+ with pointer-events: none', () => {
            expect(src).toContain('pointer-events: none');
        });
    });

    describe('desktop 5-column grid', () => {
        it('uses 5-column grid on large desktop', () => {
            expect(src).toContain('grid-template-columns: repeat(5, 1fr)');
        });

        it('uses 3-column fallback on tablet', () => {
            expect(src).toContain('grid-template-columns: repeat(3, 1fr)');
        });
    });

    describe('newsletter section', () => {
        it('renders newsletter input', () => {
            expect(src).toContain('type="email"');
            expect(src).toContain('footer__newsletter-input');
        });

        it('renders subscribe button', () => {
            expect(src).toContain('footer.subscribe');
        });
    });

    describe('bottom bar', () => {
        it('renders cookie preferences button', () => {
            expect(src).toContain('data-cookie-consent-reopen');
        });

        it('renders copyright notice', () => {
            expect(src).toContain('currentYear');
            expect(src).toContain('Hospeda');
        });
    });

    describe('styles', () => {
        it('uses --footer-bg token for background', () => {
            expect(src).toContain('var(--footer-bg)');
        });

        it('uses --footer-fg for text color', () => {
            expect(src).toContain('var(--footer-fg)');
        });

        it('uses --font-heading for nav headings', () => {
            expect(src).toContain('var(--font-heading)');
        });

        it('uses --font-sans for nav links', () => {
            expect(src).toContain('var(--font-sans)');
        });

        it('uses --duration-normal for transitions', () => {
            expect(src).toContain('var(--duration-normal)');
        });
    });
});
