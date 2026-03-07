/**
 * @file hreflang.test.ts
 * @description Integration tests verifying the hreflang implementation across
 * the web application.
 *
 * Validates:
 * - SEOHead.astro generates hreflang link tags for all supported locales (es, en, pt)
 * - x-default hreflang points to the Spanish (default) URL
 * - Canonical URL is generated correctly
 * - Open Graph locale meta tag is generated per locale
 * - Key pages import and use SEOHead with locale prop
 * - The generateAlternateUrl logic correctly swaps locale segments in paths
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source fixtures
// ---------------------------------------------------------------------------

const WEB_ROOT = resolve(__dirname, '../../');
const SRC = resolve(WEB_ROOT, 'src');

const SEO_HEAD_PATH = resolve(SRC, 'components/seo/SEOHead.astro');
const HOMEPAGE_PATH = resolve(SRC, 'pages/[lang]/index.astro');
const ACCOUNT_DASHBOARD_PATH = resolve(SRC, 'pages/[lang]/mi-cuenta/index.astro');
const ACCOUNT_EDIT_PATH = resolve(SRC, 'pages/[lang]/mi-cuenta/editar.astro');

const seoHeadSrc = readFileSync(SEO_HEAD_PATH, 'utf8');
const homepageSrc = readFileSync(HOMEPAGE_PATH, 'utf8');
const accountDashboardSrc = readFileSync(ACCOUNT_DASHBOARD_PATH, 'utf8');
const accountEditSrc = readFileSync(ACCOUNT_EDIT_PATH, 'utf8');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hreflang integration', () => {
    describe('SEOHead hreflang link tags', () => {
        it('should output a hreflang link for Spanish (es)', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('hreflang="es"');
        });

        it('should output a hreflang link for English (en)', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('hreflang="en"');
        });

        it('should output a hreflang link for Portuguese (pt)', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('hreflang="pt"');
        });

        it('should output an x-default hreflang pointing to the Spanish URL', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('hreflang="x-default"');
            // x-default should use the same href as the Spanish (es) alternate
            expect(seoHeadSrc).toContain('hreflang="x-default" href={esUrl}');
        });

        it('should generate alternate URLs for all three supported locales', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain("const esUrl = generateAlternateUrl('es')");
            expect(seoHeadSrc).toContain("const enUrl = generateAlternateUrl('en')");
            expect(seoHeadSrc).toContain("const ptUrl = generateAlternateUrl('pt')");
        });

        it('hreflang es link should use esUrl variable', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('hreflang="es" href={esUrl}');
        });

        it('hreflang en link should use enUrl variable', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('hreflang="en" href={enUrl}');
        });

        it('hreflang pt link should use ptUrl variable', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('hreflang="pt" href={ptUrl}');
        });
    });

    describe('SEOHead canonical URL', () => {
        it('should output a canonical link tag', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('rel="canonical"');
            expect(seoHeadSrc).toContain('href={canonical}');
        });

        it('should accept canonical as a required prop', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('canonical: string');
        });
    });

    describe('SEOHead Open Graph locale meta tag', () => {
        it('should output og:locale meta tag', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('property="og:locale"');
            expect(seoHeadSrc).toContain('content={ogLocale}');
        });

        it('should map es locale to es_AR Open Graph value', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain("locale === 'es' ? 'es_AR'");
        });

        it('should map pt locale to pt_BR Open Graph value', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain("locale === 'pt' ? 'pt_BR'");
        });

        it('should map en locale to en_US Open Graph value', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain("'en_US'");
        });
    });

    describe('SEOHead generateAlternateUrl logic', () => {
        it('should import SUPPORTED_LOCALES to validate locale path segments', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('SUPPORTED_LOCALES');
            expect(seoHeadSrc).toContain("from '../../lib/i18n'");
        });

        it('generateAlternateUrl should replace existing locale segment in pathname', () => {
            // Arrange / Act / Assert
            // Validates the function replaces pathParts[0] when it matches a locale
            expect(seoHeadSrc).toContain('pathParts[0] = targetLocale');
        });

        it('generateAlternateUrl should prepend locale when no locale segment exists', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('pathParts.unshift(targetLocale)');
        });

        it('generateAlternateUrl should use new URL() for safe URL construction', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('new URL(canonical)');
        });
    });

    describe('SEOHead props interface', () => {
        it('should accept a locale prop of type SupportedLocale', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('locale?: SupportedLocale');
        });

        it('should have es as the default locale', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain("locale = 'es'");
        });

        it('should accept title and description as required props', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('title: string');
            expect(seoHeadSrc).toContain('description: string');
        });

        it('should support noindex prop for preventing search engine indexing', () => {
            // Arrange / Act / Assert
            expect(seoHeadSrc).toContain('noindex');
            expect(seoHeadSrc).toContain('noindex = false');
        });
    });

    describe('page-level SEOHead usage', () => {
        it('homepage should import SEOHead', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain(
                "import SEOHead from '../../components/seo/SEOHead.astro'"
            );
        });

        it('homepage should render SEOHead with canonical URL', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain('<SEOHead');
            expect(homepageSrc).toContain('canonical={canonicalUrl}');
        });

        it('homepage should pass locale to SEOHead', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain('locale={locale}');
        });

        it('homepage should build canonicalUrl from Astro.url.pathname and Astro.site', () => {
            // Arrange / Act / Assert
            expect(homepageSrc).toContain('new URL(Astro.url.pathname, Astro.site).href');
        });

        it('account dashboard page should use SEOHead with noindex', () => {
            // Arrange / Act / Assert
            expect(accountDashboardSrc).toContain('<SEOHead');
            expect(accountDashboardSrc).toContain('noindex={true}');
            expect(accountDashboardSrc).toContain('locale={locale}');
        });

        it('account edit page should use SEOHead with noindex', () => {
            // Arrange / Act / Assert
            expect(accountEditSrc).toContain('<SEOHead');
            expect(accountEditSrc).toContain('noindex={true}');
            expect(accountEditSrc).toContain('locale={locale}');
        });
    });

    describe('supported locale constants', () => {
        it('i18n library should export SUPPORTED_LOCALES array', () => {
            // Arrange
            const i18nSrc = readFileSync(resolve(SRC, 'lib/i18n.ts'), 'utf8');

            // Act / Assert
            expect(i18nSrc).toContain('SUPPORTED_LOCALES');
        });

        it('i18n library should include es, en, and pt as supported locales', () => {
            // Arrange
            const i18nSrc = readFileSync(resolve(SRC, 'lib/i18n.ts'), 'utf8');

            // Act / Assert
            expect(i18nSrc).toContain("'es'");
            expect(i18nSrc).toContain("'en'");
            expect(i18nSrc).toContain("'pt'");
        });
    });
});
