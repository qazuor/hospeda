/**
 * @file sitemap-page.test.ts
 * @description Source-content tests for the HTML sitemap page (mapa-del-sitio.astro).
 *
 * The sitemap is a static SSG page that lists all major site sections with
 * locale-aware internal links.  Tests validate structure, i18n usage,
 * accessibility patterns, and completeness of the route catalogue.
 *
 * NOTE: The legal.test.ts file runs a broad suite against this same source.
 * This file focuses exclusively on sitemap-specific concerns: section
 * completeness, link structure, heading hierarchy, and accessible navigation.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source file under test
// ---------------------------------------------------------------------------

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/mapa-del-sitio.astro'), 'utf8');

// ---------------------------------------------------------------------------
// Rendering & routing
// ---------------------------------------------------------------------------

describe('mapa-del-sitio.astro — rendering and routing', () => {
    it('is pre-rendered (SSG)', () => {
        expect(src).toContain('export const prerender = true');
    });

    it('re-exports getStaticLocalePaths for locale-aware static generation', () => {
        expect(src).toContain('getStaticLocalePaths as getStaticPaths');
    });

    it('validates locale with getLocaleFromParams', () => {
        expect(src).toContain('getLocaleFromParams(Astro.params)');
    });

    it('redirects to /es/ on invalid locale', () => {
        expect(src).toContain("Astro.redirect('/es/')");
    });

    it('builds canonical URL from Astro.site for SEO', () => {
        expect(src).toContain('new URL(Astro.url.pathname, Astro.site)');
        expect(src).toContain('canonicalUrl');
    });
});

// ---------------------------------------------------------------------------
// SEO integration
// ---------------------------------------------------------------------------

describe('mapa-del-sitio.astro — SEO integration', () => {
    it('imports and uses SEOHead', () => {
        expect(src).toContain('import SEOHead from');
        expect(src).toContain('<SEOHead');
    });

    it('passes all required props to SEOHead', () => {
        expect(src).toContain('title={pageTitle}');
        expect(src).toContain('description={pageDescription}');
        expect(src).toContain('canonical={canonicalUrl}');
        expect(src).toContain('locale={locale}');
    });

    it('mounts SEOHead into the head slot', () => {
        expect(src).toContain('slot="head"');
    });

    it('sets OG type to website', () => {
        expect(src).toContain('type="website"');
    });

    it('uses common.sitemap i18n namespace for title', () => {
        expect(src).toContain("'common.sitemap.title'");
    });

    it('uses common.sitemap i18n namespace for description', () => {
        expect(src).toContain("'common.sitemap.description'");
    });
});

// ---------------------------------------------------------------------------
// Breadcrumb navigation
// ---------------------------------------------------------------------------

describe('mapa-del-sitio.astro — breadcrumb', () => {
    it('imports Breadcrumb component', () => {
        expect(src).toContain('import Breadcrumb from');
    });

    it('renders Breadcrumb in the page body', () => {
        expect(src).toContain('<Breadcrumb');
    });

    it('includes HOME_BREADCRUMB as the first breadcrumb item', () => {
        expect(src).toContain('HOME_BREADCRUMB');
    });

    it('uses buildUrl for breadcrumb hrefs', () => {
        expect(src).toContain('buildUrl({ locale })');
    });
});

// ---------------------------------------------------------------------------
// Page heading hierarchy
// ---------------------------------------------------------------------------

describe('mapa-del-sitio.astro — heading structure', () => {
    it('has an h1 page title', () => {
        expect(src).toContain('<h1');
    });

    it('uses h2 headings for each section card', () => {
        expect(src).toContain('<h2');
    });

    it('renders section headings from sitemapSections data', () => {
        expect(src).toContain('{section.heading}');
    });

    it('wraps the page heading area in a <header> element', () => {
        expect(src).toContain('<header');
    });
});

// ---------------------------------------------------------------------------
// Sitemap section completeness
// ---------------------------------------------------------------------------

describe('mapa-del-sitio.astro — section catalogue completeness', () => {
    it('defines a sitemapSections array with all site areas', () => {
        expect(src).toContain('sitemapSections');
    });

    it('has a principal section id', () => {
        expect(src).toContain("id: 'principal'");
    });

    it('has an alojamientos section id', () => {
        expect(src).toContain("id: 'alojamientos'");
    });

    it('has a destinos section id', () => {
        expect(src).toContain("id: 'destinos'");
    });

    it('has an eventos section id', () => {
        expect(src).toContain("id: 'eventos'");
    });

    it('has a publicaciones section id', () => {
        expect(src).toContain("id: 'publicaciones'");
    });

    it('has a cuenta section id', () => {
        expect(src).toContain("id: 'cuenta'");
    });

    it('has an informacion section id', () => {
        expect(src).toContain("id: 'informacion'");
    });
});

// ---------------------------------------------------------------------------
// Link completeness — major routes present
// ---------------------------------------------------------------------------

describe('mapa-del-sitio.astro — link coverage for major routes', () => {
    it('links to the home page', () => {
        // buildUrl({ locale }) with no path = home
        expect(src).toContain('buildUrl({ locale })');
    });

    it('links to /quienes-somos', () => {
        expect(src).toContain("path: 'quienes-somos'");
    });

    it('links to /beneficios', () => {
        expect(src).toContain("path: 'beneficios'");
    });

    it('links to /contacto', () => {
        expect(src).toContain("path: 'contacto'");
    });

    it('links to /alojamientos', () => {
        expect(src).toContain("path: 'alojamientos'");
    });

    it('links to /destinos', () => {
        expect(src).toContain("path: 'destinos'");
    });

    it('links to /eventos', () => {
        expect(src).toContain("path: 'eventos'");
    });

    it('links to /publicaciones (blog)', () => {
        expect(src).toContain("path: 'publicaciones'");
    });

    it('links to auth signin page', () => {
        expect(src).toContain("path: 'auth/signin'");
    });

    it('links to auth signup page', () => {
        expect(src).toContain("path: 'auth/signup'");
    });

    it('links to forgot-password page', () => {
        expect(src).toContain("path: 'auth/forgot-password'");
    });

    it('links to terminos-condiciones', () => {
        expect(src).toContain("path: 'terminos-condiciones'");
    });

    it('links to privacidad', () => {
        expect(src).toContain("path: 'privacidad'");
    });

    it('links to the sitemap itself (self-reference)', () => {
        expect(src).toContain("path: 'mapa-del-sitio'");
    });

    it('uses buildUrl for all internal links (locale-aware)', () => {
        // Each call to buildUrl ensures trailing-slash-safe locale-prefixed URLs
        const count = (src.match(/buildUrl\(/g) ?? []).length;
        expect(count).toBeGreaterThanOrEqual(10);
    });
});

// ---------------------------------------------------------------------------
// Accessible structure
// ---------------------------------------------------------------------------

describe('mapa-del-sitio.astro — accessible markup', () => {
    it('wraps each section in an <article> landmark', () => {
        expect(src).toContain('<article');
    });

    it('wraps each section link list in a <nav> with aria-label', () => {
        expect(src).toContain('<nav aria-label=');
    });

    it('renders links inside <ul><li> list structure', () => {
        expect(src).toContain('<ul');
        expect(src).toContain('<li>');
    });

    it('links have focus-visible outline styles', () => {
        expect(src).toContain('focus-visible:outline');
    });

    it('uses semantic color tokens on link text', () => {
        expect(src).toContain('text-muted-foreground');
        expect(src).toContain('hover:text-primary');
    });
});

// ---------------------------------------------------------------------------
// Design tokens — no hardcoded palette values
// ---------------------------------------------------------------------------

describe('mapa-del-sitio.astro — design token compliance', () => {
    it('uses bg-card for section card backgrounds', () => {
        expect(src).toContain('bg-card');
    });

    it('uses border-border for card borders', () => {
        expect(src).toContain('border-border');
    });

    it('uses text-foreground for headings', () => {
        expect(src).toContain('text-foreground');
    });

    it('does not contain hardcoded bg-white', () => {
        expect(src).not.toContain('bg-white');
    });

    it('does not contain hardcoded text-gray-', () => {
        expect(src).not.toContain('text-gray-');
    });
});
