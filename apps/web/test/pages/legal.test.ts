/**
 * @file legal.test.ts
 * @description Source-content tests for legal and utility pages:
 * - privacidad.astro (privacy policy)
 * - terminos-condiciones.astro (terms and conditions)
 * - mapa-del-sitio.astro (HTML sitemap)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const privacidadSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/privacidad.astro'),
    'utf8'
);

const terminosSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/terminos-condiciones.astro'),
    'utf8'
);

const mapaSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mapa-del-sitio.astro'),
    'utf8'
);

// ---------------------------------------------------------------------------
// Shared assertions for all three legal/utility pages
// ---------------------------------------------------------------------------

function describeLegalPage(name: string, src: string): void {
    describe(`${name} — shared patterns`, () => {
        it('has prerender = true for SSG', () => {
            expect(src).toContain('export const prerender = true');
        });

        it('re-exports getStaticLocalePaths as getStaticPaths', () => {
            expect(src).toContain('getStaticLocalePaths as getStaticPaths');
        });

        it('uses BaseLayout', () => {
            expect(src).toContain('BaseLayout');
        });

        it('uses SEOHead', () => {
            expect(src).toContain('SEOHead');
        });

        it('passes locale to SEOHead', () => {
            expect(src).toContain('locale={locale}');
        });

        it('calls getLocaleFromParams for locale validation', () => {
            expect(src).toContain('getLocaleFromParams(Astro.params)');
        });

        it('uses createT for i18n', () => {
            expect(src).toContain('createT');
        });

        it('builds canonical URL from Astro.site', () => {
            expect(src).toContain('canonicalUrl');
        });

        it('renders Breadcrumb component', () => {
            expect(src).toContain('Breadcrumb');
        });

        it('includes HOME_BREADCRUMB in breadcrumb', () => {
            expect(src).toContain('HOME_BREADCRUMB');
        });

        it('does not use bg-white', () => {
            expect(src).not.toContain('bg-white');
        });

        it('does not use text-gray-', () => {
            expect(src).not.toContain('text-gray-');
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
}

// ---------------------------------------------------------------------------
// privacidad.astro — Privacy policy
// ---------------------------------------------------------------------------

describeLegalPage('privacidad.astro', privacidadSrc);

describe('privacidad.astro — privacy policy page', () => {
    it('redirects to /es/privacidad/ on invalid locale', () => {
        expect(privacidadSrc).toContain("Astro.redirect('/es/privacidad/')");
    });

    it('imports formatDate and toBcp47Locale from @repo/i18n', () => {
        expect(privacidadSrc).toContain('formatDate');
        expect(privacidadSrc).toContain('toBcp47Locale');
        expect(privacidadSrc).toContain("from '@repo/i18n'");
    });

    it('formats last-updated date in active locale', () => {
        expect(privacidadSrc).toContain('lastUpdated');
        expect(privacidadSrc).toContain('formatDate({ date: new Date()');
    });

    it('renders 7 numbered legal sections', () => {
        expect(privacidadSrc).toContain('id="section-1"');
        expect(privacidadSrc).toContain('id="section-7"');
    });

    it('renders section about data collection', () => {
        expect(privacidadSrc).toContain('Informacion que recopilamos');
    });

    it('renders section about cookies', () => {
        expect(privacidadSrc).toContain('Cookies');
    });

    it('renders section about data sharing', () => {
        expect(privacidadSrc).toContain('Compartir datos');
    });

    it('renders section about user rights', () => {
        expect(privacidadSrc).toContain('Derechos del usuario');
    });

    it('renders contact link pointing to contacto page', () => {
        expect(privacidadSrc).toContain("path: 'contacto'");
    });

    it('renders last-updated footer', () => {
        expect(privacidadSrc).toContain('lastUpdated');
    });

    it('uses prose class for formatted text content', () => {
        expect(privacidadSrc).toContain('prose');
    });

    it('uses privacy.page i18n namespace', () => {
        expect(privacidadSrc).toContain('privacy.page.title');
    });
});

// ---------------------------------------------------------------------------
// terminos-condiciones.astro — Terms and conditions
// ---------------------------------------------------------------------------

describeLegalPage('terminos-condiciones.astro', terminosSrc);

describe('terminos-condiciones.astro — terms and conditions page', () => {
    it('redirects to /es/ on invalid locale', () => {
        expect(terminosSrc).toContain("Astro.redirect('/es/')");
    });

    it('imports formatDate and toBcp47Locale from @repo/i18n', () => {
        expect(terminosSrc).toContain('formatDate');
        expect(terminosSrc).toContain('toBcp47Locale');
        expect(terminosSrc).toContain("from '@repo/i18n'");
    });

    it('formats last-updated date in active locale', () => {
        expect(terminosSrc).toContain('formatDate({ date: new Date()');
    });

    it('renders 7 numbered legal sections', () => {
        expect(terminosSrc).toContain('id="section-1"');
        expect(terminosSrc).toContain('id="section-7"');
    });

    it('renders acceptance section', () => {
        expect(terminosSrc).toContain('terms.sections.acceptance');
    });

    it('renders usage section', () => {
        expect(terminosSrc).toContain('terms.sections.usage');
    });

    it('renders accounts section', () => {
        expect(terminosSrc).toContain('terms.sections.accounts');
    });

    it('renders content section', () => {
        expect(terminosSrc).toContain('terms.sections.content');
    });

    it('renders liability section', () => {
        expect(terminosSrc).toContain('terms.sections.liability');
    });

    it('renders modifications section', () => {
        expect(terminosSrc).toContain('terms.sections.modifications');
    });

    it('renders contact link pointing to contacto page', () => {
        expect(terminosSrc).toContain("path: 'contacto'");
    });

    it('uses prose class for formatted text content', () => {
        expect(terminosSrc).toContain('prose');
    });

    it('uses terms.page i18n namespace', () => {
        expect(terminosSrc).toContain('terms.page.title');
    });

    it('renders last-updated line', () => {
        expect(terminosSrc).toContain('terms.lastUpdated');
    });
});

// ---------------------------------------------------------------------------
// mapa-del-sitio.astro — HTML sitemap
// ---------------------------------------------------------------------------

describeLegalPage('mapa-del-sitio.astro', mapaSrc);

describe('mapa-del-sitio.astro — HTML sitemap page', () => {
    it('redirects to /es/ on invalid locale', () => {
        expect(mapaSrc).toContain("Astro.redirect('/es/')");
    });

    it('defines sitemapSections array', () => {
        expect(mapaSrc).toContain('sitemapSections');
    });

    it('includes principal section with home, about, benefits, contact links', () => {
        expect(mapaSrc).toContain("'principal'");
        expect(mapaSrc).toContain("path: 'quienes-somos'");
        expect(mapaSrc).toContain("path: 'beneficios'");
        expect(mapaSrc).toContain("path: 'contacto'");
    });

    it('includes alojamientos section', () => {
        expect(mapaSrc).toContain("'alojamientos'");
        expect(mapaSrc).toContain("path: 'alojamientos'");
    });

    it('includes destinos section', () => {
        expect(mapaSrc).toContain("'destinos'");
        expect(mapaSrc).toContain("path: 'destinos'");
    });

    it('includes eventos section', () => {
        expect(mapaSrc).toContain("'eventos'");
        expect(mapaSrc).toContain("path: 'eventos'");
    });

    it('includes publicaciones (blog) section', () => {
        expect(mapaSrc).toContain("'publicaciones'");
        expect(mapaSrc).toContain("path: 'publicaciones'");
    });

    it('includes cuenta section with signin, signup, forgot-password links', () => {
        expect(mapaSrc).toContain("'cuenta'");
        expect(mapaSrc).toContain("path: 'auth/signin'");
        expect(mapaSrc).toContain("path: 'auth/signup'");
        expect(mapaSrc).toContain("path: 'auth/forgot-password'");
    });

    it('includes informacion (legal) section with terms, privacy, sitemap', () => {
        expect(mapaSrc).toContain("'informacion'");
        expect(mapaSrc).toContain("path: 'terminos-condiciones'");
        expect(mapaSrc).toContain("path: 'privacidad'");
        expect(mapaSrc).toContain("path: 'mapa-del-sitio'");
    });

    it('renders each section as an article with nav and ul', () => {
        expect(mapaSrc).toContain('<article');
        expect(mapaSrc).toContain('<nav aria-label=');
        expect(mapaSrc).toContain('<ul');
    });

    it('uses buildUrl for all internal links', () => {
        const buildUrlCount = (mapaSrc.match(/buildUrl\(/g) ?? []).length;
        expect(buildUrlCount).toBeGreaterThan(5);
    });

    it('uses common.sitemap i18n namespace', () => {
        expect(mapaSrc).toContain('common.sitemap.title');
    });

    it('renders page h1 heading', () => {
        expect(mapaSrc).toContain('<h1');
    });

    it('uses bg-card for section card backgrounds', () => {
        expect(mapaSrc).toContain('bg-card');
    });
});
