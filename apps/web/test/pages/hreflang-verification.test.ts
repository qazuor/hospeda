/**
 * @file hreflang-verification.test.ts
 * @description Validates that hreflang alternate link tags are generated correctly
 * by SEOHead.astro, and that multiple representative pages import and use
 * SEOHead — ensuring every locale-prefixed page emits the required alternate
 * links for Spanish (es), English (en), Portuguese (pt), and x-default.
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

const page500Src = readFileSync(resolve(__dirname, '../../src/pages/500.astro'), 'utf8');

// ---------------------------------------------------------------------------
// SEOHead — hreflang tag generation
// ---------------------------------------------------------------------------

describe('SEOHead.astro — hreflang link generation', () => {
    it('generates a Spanish (es) alternate link', () => {
        // Arrange: source must emit the es hreflang link tag
        // Act + Assert
        expect(seoHeadSrc).toContain('hreflang="es"');
        expect(seoHeadSrc).toContain('href={esUrl}');
    });

    it('generates an English (en) alternate link', () => {
        expect(seoHeadSrc).toContain('hreflang="en"');
        expect(seoHeadSrc).toContain('href={enUrl}');
    });

    it('generates a Portuguese (pt) alternate link', () => {
        expect(seoHeadSrc).toContain('hreflang="pt"');
        expect(seoHeadSrc).toContain('href={ptUrl}');
    });

    it('generates an x-default alternate pointing to the Spanish URL', () => {
        // x-default should resolve to the default locale (es)
        expect(seoHeadSrc).toContain('hreflang="x-default"');
        expect(seoHeadSrc).toContain('hreflang="x-default" href={esUrl}');
    });

    it('emits all four alternate links via rel="alternate"', () => {
        // Arrange
        const alternateCount = (seoHeadSrc.match(/rel="alternate"/g) ?? []).length;
        // Act + Assert: es + en + pt + x-default = 4 tags
        expect(alternateCount).toBe(4);
    });

    it('generates alternate URLs by deriving them from the canonical URL', () => {
        // generateAlternateUrl uses the canonical URL as the base
        expect(seoHeadSrc).toContain('generateAlternateUrl');
        expect(seoHeadSrc).toContain('const url = new URL(canonical)');
    });

    it('replaces the existing locale segment in the URL path', () => {
        expect(seoHeadSrc).toContain('SUPPORTED_LOCALES.includes(pathParts[0]');
        expect(seoHeadSrc).toContain('pathParts[0] = targetLocale');
    });

    it('inserts the locale when no locale segment is present', () => {
        expect(seoHeadSrc).toContain('pathParts.unshift(targetLocale)');
    });

    it('adds a trailing slash to each alternate URL', () => {
        expect(seoHeadSrc).toContain("url.pathname = `/${pathParts.join('/')}/`");
    });

    it('imports SUPPORTED_LOCALES to validate locale membership', () => {
        expect(seoHeadSrc).toContain('SUPPORTED_LOCALES');
        expect(seoHeadSrc).toContain("from '../../lib/i18n'");
    });
});

// ---------------------------------------------------------------------------
// SEOHead — Open Graph locale mapping
// ---------------------------------------------------------------------------

describe('SEOHead.astro — Open Graph locale mapping', () => {
    it('maps es locale to og locale es_AR (Argentina)', () => {
        expect(seoHeadSrc).toContain("locale === 'es' ? 'es_AR'");
    });

    it('maps pt locale to og locale pt_BR', () => {
        expect(seoHeadSrc).toContain("locale === 'pt' ? 'pt_BR'");
    });

    it('maps en locale to og locale en_US', () => {
        expect(seoHeadSrc).toContain("'en_US'");
    });

    it('renders the og:locale meta tag with the resolved og locale', () => {
        expect(seoHeadSrc).toContain('property="og:locale"');
        expect(seoHeadSrc).toContain('content={ogLocale}');
    });
});

// ---------------------------------------------------------------------------
// Representative pages — SEOHead usage
// ---------------------------------------------------------------------------

describe('homepage ([lang]/index.astro) — SEOHead usage', () => {
    it('imports SEOHead', () => {
        expect(homepageSrc).toContain('import SEOHead from');
    });

    it('renders SEOHead in the head slot', () => {
        expect(homepageSrc).toContain('slot="head"');
        expect(homepageSrc).toContain('<SEOHead');
    });

    it('passes canonical URL derived from Astro.site', () => {
        expect(homepageSrc).toContain('canonicalUrl');
        expect(homepageSrc).toContain('new URL(Astro.url.pathname, Astro.site)');
    });

    it('passes locale to SEOHead', () => {
        expect(homepageSrc).toContain('locale={locale}');
    });
});

describe('contacto.astro — SEOHead usage', () => {
    it('imports SEOHead', () => {
        expect(contactoSrc).toContain('import SEOHead from');
    });

    it('renders SEOHead in the head slot with all required props', () => {
        expect(contactoSrc).toContain('slot="head"');
        expect(contactoSrc).toContain('title={pageTitle}');
        expect(contactoSrc).toContain('description={pageDescription}');
        expect(contactoSrc).toContain('canonical={canonicalUrl}');
        expect(contactoSrc).toContain('locale={locale}');
    });

    it('passes type="website" to SEOHead', () => {
        expect(contactoSrc).toContain('type="website"');
    });
});

describe('mapa-del-sitio.astro — SEOHead usage', () => {
    it('imports SEOHead', () => {
        expect(mapaSiteSrc).toContain('import SEOHead from');
    });

    it('passes canonical URL to SEOHead', () => {
        expect(mapaSiteSrc).toContain('canonical={canonicalUrl}');
    });

    it('passes locale to SEOHead', () => {
        expect(mapaSiteSrc).toContain('locale={locale}');
    });
});

describe('404.astro — SEOHead usage', () => {
    it('imports SEOHead', () => {
        expect(page404Src).toContain('import SEOHead from');
    });

    it('sets noindex to prevent the error page from being indexed', () => {
        expect(page404Src).toContain('noindex={true}');
    });

    it('passes locale detected from request to SEOHead', () => {
        expect(page404Src).toContain('locale={locale}');
    });
});

describe('500.astro — SEOHead usage', () => {
    it('imports SEOHead', () => {
        expect(page500Src).toContain('import SEOHead from');
    });

    it('sets noindex to prevent the error page from being indexed', () => {
        expect(page500Src).toContain('noindex={true}');
    });

    it('passes locale detected from request to SEOHead', () => {
        expect(page500Src).toContain('locale={locale}');
    });
});
