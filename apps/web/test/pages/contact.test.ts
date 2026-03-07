/**
 * @file contact.test.ts
 * @description Source-content tests for contacto.astro.
 * Validates ContactForm island, contact info panel, social media links,
 * i18n usage, and semantic token compliance.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/contacto.astro'), 'utf8');

describe('contacto.astro — contact page', () => {
    describe('rendering strategy', () => {
        it('has prerender = true for SSG', () => {
            expect(src).toContain('export const prerender = true');
        });

        it('re-exports getStaticLocalePaths as getStaticPaths', () => {
            expect(src).toContain('getStaticLocalePaths as getStaticPaths');
        });
    });

    describe('layout and SEO', () => {
        it('uses BaseLayout', () => {
            expect(src).toContain('BaseLayout');
        });

        it('uses SEOHead', () => {
            expect(src).toContain('SEOHead');
            expect(src).toContain('slot="head"');
        });

        it('passes locale to BaseLayout', () => {
            expect(src).toContain('locale={locale}');
        });

        it('builds canonical URL from Astro.site', () => {
            expect(src).toContain('Astro.site');
            expect(src).toContain('canonicalUrl');
        });

        it('does not set noindex (page should be indexable)', () => {
            expect(src).not.toContain('noindex={true}');
        });
    });

    describe('imports and dependencies', () => {
        it('imports ContactForm as React island', () => {
            expect(src).toContain('ContactForm');
            expect(src).toContain("from '../../components/content/ContactForm.client'");
        });

        it('imports icons from @repo/icons', () => {
            expect(src).toContain("from '@repo/icons'");
            expect(src).toContain('EmailIcon');
            expect(src).toContain('LocationIcon');
            expect(src).toContain('ClockIcon');
            expect(src).toContain('InstagramIcon');
            expect(src).toContain('FacebookIcon');
            expect(src).toContain('TwitterIcon');
        });

        it('imports createT from i18n', () => {
            expect(src).toContain('createT');
        });

        it('imports Breadcrumb', () => {
            expect(src).toContain('Breadcrumb');
        });
    });

    describe('locale validation', () => {
        it('calls getLocaleFromParams', () => {
            expect(src).toContain('getLocaleFromParams(Astro.params)');
        });

        it('redirects on invalid locale', () => {
            expect(src).toContain("Astro.redirect('/es/contacto/')");
        });
    });

    describe('ContactForm island', () => {
        it('renders ContactForm island hydrated on visibility', () => {
            expect(src).toContain('client:visible');
            expect(src).toContain('<ContactForm');
        });

        it('passes locale to ContactForm', () => {
            expect(src).toContain('locale={locale}');
        });
    });

    describe('contact information panel', () => {
        it('renders contact info section as aside', () => {
            expect(src).toContain('<aside');
        });

        it('renders email link to info@hospeda.com.ar', () => {
            expect(src).toContain('info@hospeda.com.ar');
            expect(src).toContain('href="mailto:info@hospeda.com.ar"');
        });

        it('renders office hours information', () => {
            expect(src).toContain('officeHoursLabel');
            expect(src).toContain('officeHoursValue');
        });

        it('renders location information', () => {
            expect(src).toContain('locationLabel');
            expect(src).toContain('Concepcion del Uruguay');
        });
    });

    describe('social media links', () => {
        it('renders Instagram link with aria-label', () => {
            expect(src).toContain('https://instagram.com/hospeda');
            expect(src).toContain('aria-label="Instagram"');
        });

        it('renders Facebook link with aria-label', () => {
            expect(src).toContain('https://facebook.com/hospeda');
            expect(src).toContain('aria-label="Facebook"');
        });

        it('renders Twitter link with aria-label', () => {
            expect(src).toContain('https://twitter.com/hospeda');
            expect(src).toContain('aria-label="Twitter / X"');
        });

        it('uses rel="noopener noreferrer" on external links', () => {
            expect(src).toContain('rel="noopener noreferrer"');
        });

        it('opens social links in a new tab', () => {
            expect(src).toContain('target="_blank"');
        });
    });

    describe('semantic tokens — no hardcoded colors', () => {
        it('does not use bg-white', () => {
            expect(src).not.toContain('bg-white');
        });

        it('does not use text-gray-', () => {
            expect(src).not.toContain('text-gray-');
        });

        it('uses semantic token bg-card', () => {
            expect(src).toContain('bg-card');
        });

        it('uses semantic token text-foreground', () => {
            expect(src).toContain('text-foreground');
        });

        it('uses semantic token text-muted-foreground', () => {
            expect(src).toContain('text-muted-foreground');
        });

        it('uses semantic token border-border', () => {
            expect(src).toContain('border-border');
        });
    });

    describe('breadcrumb', () => {
        it('renders Breadcrumb component', () => {
            expect(src).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('includes contacto path in breadcrumb', () => {
            expect(src).toContain("path: 'contacto'");
        });
    });
});
