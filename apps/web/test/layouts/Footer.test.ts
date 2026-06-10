/**
 * @file Footer.test.ts
 * @description Source-reading unit tests for Footer.astro.
 * Astro components cannot be rendered in Vitest/jsdom so we assert on the
 * source text to verify the 4-zone vertical layout (brand+nav, newsletter
 * strip, trust signals, bottom bar), the 3-column nav with mobile accordion,
 * i18n usage, and all required navigation links.
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

        it('pulls platform stats at request time for trust signals', () => {
            expect(src).toContain('statsApi.getPlatformStats');
        });
    });

    describe('3-column nav structure', () => {
        it('defines exploreLinks array', () => {
            expect(src).toContain('exploreLinks');
        });

        it('defines forYouLinks array', () => {
            expect(src).toContain('forYouLinks');
        });

        it('defines companyLinks array', () => {
            expect(src).toContain('companyLinks');
        });

        it('links to the contribution hub in the Hospeda column (SPEC-191)', () => {
            expect(src).toContain('path: "/colaborar/"');
            expect(src).toContain('footer.collaborate');
        });

        it('renders exactly 3 nav column <details> elements', () => {
            const matches = src.match(/<details class="footer__nav-col"/g);
            expect(matches).not.toBeNull();
            expect((matches ?? []).length).toBe(3);
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

        it('uses i18n key for the column title', () => {
            expect(src).toContain('footer.exploreTitle');
        });
    });

    describe('Para vos column', () => {
        it('includes /suscriptores/propietarios/ link', () => {
            expect(src).toContain('/suscriptores/propietarios/');
        });

        it('includes /suscriptores/turistas/ link', () => {
            expect(src).toContain('/suscriptores/turistas/');
        });

        it('includes /suscriptores/planes/ link', () => {
            expect(src).toContain('/suscriptores/planes/');
        });

        it('uses i18n key for the column title', () => {
            expect(src).toContain('footer.forYouTitle');
        });
    });

    describe('Hospeda column', () => {
        it('includes /nosotros/ link', () => {
            expect(src).toContain('/nosotros/');
        });

        it('includes /contacto/ link', () => {
            expect(src).toContain('/contacto/');
        });

        it('uses i18n key for the column title', () => {
            expect(src).toContain('footer.hospedaTitle');
        });
    });

    describe('accordion pattern', () => {
        it('uses <details> elements for accordion columns', () => {
            expect(src).toContain('<details');
        });

        it('uses <summary> elements as column headings', () => {
            expect(src).toContain('<summary');
        });

        it('applies footer__nav-col class to <details>', () => {
            expect(src).toContain('class="footer__nav-col"');
        });

        it('applies footer__nav-heading class to summary elements', () => {
            expect(src).toContain('footer__nav-heading');
        });

        it('all nav columns default to open so content is visible without JS', () => {
            const openMatches = src.match(/<details class="footer__nav-col" open>/g);
            expect(openMatches).not.toBeNull();
            expect((openMatches ?? []).length).toBe(3);
        });

        it('disables accordion behaviour on tablet+ via pointer-events: none', () => {
            expect(src).toContain('pointer-events: none');
        });
    });

    describe('responsive nav layout', () => {
        it('stacks the nav into a single column on mobile', () => {
            expect(src).toContain('grid-template-columns: 1fr');
        });

        it('uses a 3-column nav grid on tablet (≥768px)', () => {
            expect(src).toContain('grid-template-columns: repeat(3, 1fr)');
        });
    });

    describe('newsletter zone', () => {
        it('mounts the NewsletterForm React island (SPEC-101 T-101-33)', () => {
            // The inert static form was replaced by the live double opt-in
            // island so we no longer assert on type="email" / button copy.
            expect(src).toContain('@/components/newsletter/NewsletterForm.client');
            expect(src).toMatch(/<NewsletterForm[\s\S]+client:visible/);
        });

        it('passes auth state, email, apiUrl and locale to the island', () => {
            expect(src).toContain('isAuthenticated={isAuthenticated}');
            expect(src).toContain('userEmail={userEmail}');
            expect(src).toContain('apiUrl={apiUrl}');
            expect(src).toContain('locale={locale}');
        });

        it('uses the newsletter short title i18n key', () => {
            expect(src).toContain('footer.newsletterShortTitle');
        });
    });

    describe('trust signals zone', () => {
        it('renders the accommodations count trust signal', () => {
            expect(src).toContain('footer.trustSignals.accommodationsCount');
        });

        it('renders the average rating trust signal', () => {
            expect(src).toContain('footer.trustSignals.averageRating');
        });

        it('renders the local-support trust signal', () => {
            expect(src).toContain('footer.trustSignals.localSupport');
        });

        it('renders the secure-payments trust signal', () => {
            expect(src).toContain('footer.trustSignals.securePayments');
        });

        it('renders the no-commissions trust signal', () => {
            expect(src).toContain('footer.trustSignals.noCommissions');
        });

        it('renders the payment methods row from @repo/icons (commit ce807e5e1 replaced simpleicons CDN)', () => {
            // Commit ce807e5e1 (feat: render footer payment marks from @repo/icons instead of CDN)
            // replaced the simpleicons.org <img> tags with inline SVG icon components for
            // theming and performance — no extra CDN round-trip.
            expect(src).toContain('MercadoPagoIcon');
            expect(src).toContain('VisaIcon');
            expect(src).toContain('MasterCardIcon');
        });
    });

    describe('bottom bar', () => {
        it('renders the contact email link', () => {
            expect(src).toContain('footer.contactEmail');
            expect(src).toContain('mailto:');
        });

        it('renders the contact phone link', () => {
            expect(src).toContain('footer.contactPhone');
            expect(src).toContain('tel:');
        });

        it('renders the legal links (terms, privacy, cookies)', () => {
            expect(src).toContain('/legal/terminos/');
            expect(src).toContain('/legal/privacidad/');
            expect(src).toContain('/legal/cookies/');
        });

        it('renders the cookie preferences button', () => {
            expect(src).toContain('data-cookie-consent-reopen');
        });

        it('renders the copyright notice', () => {
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
