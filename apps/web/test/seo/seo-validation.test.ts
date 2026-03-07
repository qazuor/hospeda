/**
 * @file seo-validation.test.ts
 * @description Source-content tests for SEOHead.astro meta tag completeness.
 *
 * Validates that the component emits all required SEO meta tags:
 * title, description, canonical, Open Graph, Twitter Card, hreflang.
 * Also checks that representative pages in the app wire SEOHead correctly.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source files under test
// ---------------------------------------------------------------------------

const seoHeadSrc = readFileSync(
    resolve(__dirname, '../../src/components/seo/SEOHead.astro'),
    'utf8'
);

const homepageSrc = readFileSync(resolve(__dirname, '../../src/pages/[lang]/index.astro'), 'utf8');

const contactoSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/contacto.astro'),
    'utf8'
);

const mapaSiteSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mapa-del-sitio.astro'),
    'utf8'
);

const page404Src = readFileSync(resolve(__dirname, '../../src/pages/404.astro'), 'utf8');

// ---------------------------------------------------------------------------
// Title tag
// ---------------------------------------------------------------------------

describe('SEOHead.astro — title tag', () => {
    it('renders a <title> element', () => {
        expect(seoHeadSrc).toContain('<title>');
        expect(seoHeadSrc).toContain('</title>');
    });

    it('appends " | Hospeda" site name suffix to the provided title', () => {
        expect(seoHeadSrc).toContain('`${title} | Hospeda`');
        expect(seoHeadSrc).toContain('const fullTitle');
    });

    it('uses the combined fullTitle for the <title> element', () => {
        expect(seoHeadSrc).toContain('{fullTitle}');
    });

    it('accepts a required title prop', () => {
        expect(seoHeadSrc).toContain('title:');
        expect(seoHeadSrc).toContain('/** Page title');
    });
});

// ---------------------------------------------------------------------------
// Meta description
// ---------------------------------------------------------------------------

describe('SEOHead.astro — meta description', () => {
    it('renders a <meta name="description"> tag', () => {
        expect(seoHeadSrc).toContain('name="description"');
    });

    it('sets description content from the description prop', () => {
        expect(seoHeadSrc).toContain('content={description}');
    });

    it('accepts a required description prop', () => {
        expect(seoHeadSrc).toContain('description:');
        expect(seoHeadSrc).toContain('/** Meta description');
    });
});

// ---------------------------------------------------------------------------
// Canonical link
// ---------------------------------------------------------------------------

describe('SEOHead.astro — canonical link', () => {
    it('renders a <link rel="canonical"> tag', () => {
        expect(seoHeadSrc).toContain('rel="canonical"');
    });

    it('sets the canonical href from the canonical prop', () => {
        expect(seoHeadSrc).toContain('href={canonical}');
    });

    it('accepts a required canonical prop', () => {
        expect(seoHeadSrc).toContain('canonical:');
        expect(seoHeadSrc).toContain('/** Canonical URL');
    });
});

// ---------------------------------------------------------------------------
// Robots meta tag
// ---------------------------------------------------------------------------

describe('SEOHead.astro — robots meta tag', () => {
    it('renders robots noindex tag only when noindex prop is true', () => {
        expect(seoHeadSrc).toContain('noindex &&');
        expect(seoHeadSrc).toContain('name="robots"');
        expect(seoHeadSrc).toContain('content="noindex,nofollow"');
    });

    it('defaults noindex to false (no noindex tag on regular pages)', () => {
        expect(seoHeadSrc).toContain('noindex = false');
    });
});

// ---------------------------------------------------------------------------
// Open Graph meta tags
// ---------------------------------------------------------------------------

describe('SEOHead.astro — Open Graph meta tags', () => {
    it('renders og:type meta tag', () => {
        expect(seoHeadSrc).toContain('property="og:type"');
    });

    it('renders og:url meta tag using the canonical URL', () => {
        expect(seoHeadSrc).toContain('property="og:url"');
        // canonical is reused as og:url
        expect(seoHeadSrc).toContain('content={canonical}');
    });

    it('renders og:title using the full title with site suffix', () => {
        expect(seoHeadSrc).toContain('property="og:title"');
        expect(seoHeadSrc).toContain('content={fullTitle}');
    });

    it('renders og:description meta tag', () => {
        expect(seoHeadSrc).toContain('property="og:description"');
    });

    it('renders og:locale meta tag', () => {
        expect(seoHeadSrc).toContain('property="og:locale"');
        expect(seoHeadSrc).toContain('content={ogLocale}');
    });

    it('renders og:site_name set to "Hospeda"', () => {
        expect(seoHeadSrc).toContain('property="og:site_name"');
        expect(seoHeadSrc).toContain('content="Hospeda"');
    });

    it('conditionally renders og:image when image prop is provided', () => {
        expect(seoHeadSrc).toContain('property="og:image"');
        expect(seoHeadSrc).toContain('{image &&');
    });

    it('accepts website and article as valid og:type values', () => {
        expect(seoHeadSrc).toContain("'website' | 'article'");
    });

    it('defaults og:type to website', () => {
        expect(seoHeadSrc).toContain("type = 'website'");
    });
});

// ---------------------------------------------------------------------------
// Twitter Card meta tags
// ---------------------------------------------------------------------------

describe('SEOHead.astro — Twitter Card meta tags', () => {
    it('renders twitter:card set to summary_large_image', () => {
        expect(seoHeadSrc).toContain('name="twitter:card"');
        expect(seoHeadSrc).toContain('content="summary_large_image"');
    });

    it('renders twitter:title tag', () => {
        expect(seoHeadSrc).toContain('name="twitter:title"');
    });

    it('renders twitter:description tag', () => {
        expect(seoHeadSrc).toContain('name="twitter:description"');
    });

    it('conditionally renders twitter:image when image prop is provided', () => {
        expect(seoHeadSrc).toContain('name="twitter:image"');
        expect(seoHeadSrc).toContain('{image &&');
    });

    it('uses the fullTitle for the twitter:title (with site suffix)', () => {
        // Same fullTitle is used for both OG and Twitter
        const titleMatches = (seoHeadSrc.match(/content=\{fullTitle\}/g) ?? []).length;
        expect(titleMatches).toBeGreaterThanOrEqual(2);
    });
});

// ---------------------------------------------------------------------------
// Hreflang alternate links
// ---------------------------------------------------------------------------

describe('SEOHead.astro — hreflang alternate links', () => {
    it('generates hreflang link for es locale', () => {
        expect(seoHeadSrc).toContain('hreflang="es"');
    });

    it('generates hreflang link for en locale', () => {
        expect(seoHeadSrc).toContain('hreflang="en"');
    });

    it('generates hreflang link for pt locale', () => {
        expect(seoHeadSrc).toContain('hreflang="pt"');
    });

    it('generates x-default hreflang pointing to Spanish URL', () => {
        expect(seoHeadSrc).toContain('hreflang="x-default"');
        expect(seoHeadSrc).toContain('hreflang="x-default" href={esUrl}');
    });

    it('emits exactly 4 alternate link tags', () => {
        const count = (seoHeadSrc.match(/rel="alternate"/g) ?? []).length;
        expect(count).toBe(4);
    });
});

// ---------------------------------------------------------------------------
// Props interface completeness
// ---------------------------------------------------------------------------

describe('SEOHead.astro — Props interface', () => {
    it('exports a Props interface', () => {
        expect(seoHeadSrc).toContain('export interface Props');
    });

    it('declares title as required string prop', () => {
        expect(seoHeadSrc).toContain('title: string');
    });

    it('declares description as required string prop', () => {
        expect(seoHeadSrc).toContain('description: string');
    });

    it('declares canonical as required string prop', () => {
        expect(seoHeadSrc).toContain('canonical: string');
    });

    it('declares image as optional string prop', () => {
        expect(seoHeadSrc).toContain('image?: string');
    });

    it('declares noindex as optional boolean prop', () => {
        expect(seoHeadSrc).toContain('noindex?: boolean');
    });

    it('declares locale as optional SupportedLocale prop', () => {
        expect(seoHeadSrc).toContain('locale?: SupportedLocale');
    });

    it('declares type as optional website|article union prop', () => {
        expect(seoHeadSrc).toContain("type?: 'website' | 'article'");
    });

    it('imports SupportedLocale as a type-only import', () => {
        expect(seoHeadSrc).toContain('type SupportedLocale');
    });
});

// ---------------------------------------------------------------------------
// Multiple pages — SEOHead wired correctly
// ---------------------------------------------------------------------------

describe('pages — SEOHead integration across multiple pages', () => {
    it('homepage imports and uses SEOHead in the head slot', () => {
        expect(homepageSrc).toContain('import SEOHead from');
        expect(homepageSrc).toContain('slot="head"');
        expect(homepageSrc).toContain('canonical={canonicalUrl}');
        expect(homepageSrc).toContain('locale={locale}');
    });

    it('contacto.astro imports and uses SEOHead in the head slot', () => {
        expect(contactoSrc).toContain('import SEOHead from');
        expect(contactoSrc).toContain('slot="head"');
        expect(contactoSrc).toContain('canonical={canonicalUrl}');
        expect(contactoSrc).toContain('locale={locale}');
    });

    it('mapa-del-sitio.astro imports and uses SEOHead in the head slot', () => {
        expect(mapaSiteSrc).toContain('import SEOHead from');
        expect(mapaSiteSrc).toContain('slot="head"');
        expect(mapaSiteSrc).toContain('canonical={canonicalUrl}');
    });

    it('404.astro imports and uses SEOHead with noindex', () => {
        expect(page404Src).toContain('import SEOHead from');
        expect(page404Src).toContain('noindex={true}');
    });

    it('all sampled pages derive canonical from Astro.site to form absolute URLs', () => {
        for (const src of [homepageSrc, contactoSrc, mapaSiteSrc, page404Src]) {
            expect(src).toContain('new URL(Astro.url.pathname, Astro.site)');
        }
    });
});
