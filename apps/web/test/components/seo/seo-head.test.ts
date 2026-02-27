import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/seo/SEOHead.astro');
const content = readFileSync(componentPath, 'utf8');

describe('SEOHead.astro', () => {
    describe('Props', () => {
        it('should require title prop', () => {
            expect(content).toContain('title: string');
        });

        it('should require description prop', () => {
            expect(content).toContain('description: string');
        });

        it('should require canonical prop', () => {
            expect(content).toContain('canonical: string');
        });

        it('should accept optional image prop', () => {
            expect(content).toContain('image?: string');
        });

        it('should accept optional noindex prop', () => {
            expect(content).toContain('noindex?: boolean');
        });

        it('should accept locale prop with SupportedLocale type', () => {
            expect(content).toContain('locale?: SupportedLocale');
        });

        it('should accept type prop with website or article values', () => {
            expect(content).toContain("type?: 'website' | 'article'");
        });

        it('should default noindex to false', () => {
            expect(content).toContain('noindex = false');
        });

        it('should default locale to es', () => {
            expect(content).toContain("locale = 'es'");
        });

        it('should default type to website', () => {
            expect(content).toContain("type = 'website'");
        });
    });

    describe('Title rendering', () => {
        it('should render title with Hospeda suffix', () => {
            expect(content).toContain('| Hospeda');
        });

        it('should use fullTitle variable', () => {
            expect(content).toContain('fullTitle');
        });

        it('should render title tag with fullTitle', () => {
            expect(content).toContain('<title>{fullTitle}</title>');
        });
    });

    describe('Meta description', () => {
        it('should render meta description tag', () => {
            expect(content).toContain('<meta name="description"');
        });

        it('should use description prop in meta tag', () => {
            expect(content).toContain('content={description}');
        });
    });

    describe('Canonical link', () => {
        it('should render canonical link tag', () => {
            expect(content).toContain('<link rel="canonical"');
        });

        it('should use canonical prop in link tag', () => {
            expect(content).toContain('href={canonical}');
        });
    });

    describe('Robots meta tag', () => {
        it('should conditionally render robots meta when noindex is true', () => {
            expect(content).toContain('{noindex &&');
            expect(content).toContain('<meta name="robots"');
        });

        it('should use noindex,nofollow content', () => {
            expect(content).toContain('content="noindex,nofollow"');
        });
    });

    describe('Open Graph tags', () => {
        it('should render og:type meta tag', () => {
            expect(content).toContain('<meta property="og:type"');
        });

        it('should use type prop for og:type', () => {
            expect(content).toContain('content={type}');
        });

        it('should render og:url meta tag', () => {
            expect(content).toContain('<meta property="og:url"');
        });

        it('should use canonical for og:url', () => {
            expect(content).toContain('property="og:url"');
            expect(content).toContain('content={canonical}');
        });

        it('should render og:title meta tag', () => {
            expect(content).toContain('<meta property="og:title"');
        });

        it('should use fullTitle for og:title', () => {
            expect(content).toContain('property="og:title"');
            expect(content).toContain('content={fullTitle}');
        });

        it('should render og:description meta tag', () => {
            expect(content).toContain('<meta property="og:description"');
        });

        it('should use description for og:description', () => {
            expect(content).toContain('property="og:description"');
            expect(content).toContain('content={description}');
        });

        it('should render og:locale meta tag', () => {
            expect(content).toContain('<meta property="og:locale"');
        });

        it('should use ogLocale for og:locale', () => {
            expect(content).toContain('content={ogLocale}');
        });

        it('should render og:site_name meta tag', () => {
            expect(content).toContain('<meta property="og:site_name"');
        });

        it('should use Hospeda for og:site_name', () => {
            expect(content).toContain('content="Hospeda"');
        });

        it('should conditionally render og:image when image is provided', () => {
            expect(content).toContain('{image &&');
            expect(content).toContain('<meta property="og:image"');
        });

        it('should use image prop for og:image', () => {
            expect(content).toContain('property="og:image"');
            expect(content).toContain('content={image}');
        });
    });

    describe('Twitter Card tags', () => {
        it('should render twitter:card meta tag', () => {
            expect(content).toContain('<meta name="twitter:card"');
        });

        it('should use summary_large_image for twitter:card', () => {
            expect(content).toContain('content="summary_large_image"');
        });

        it('should render twitter:title meta tag', () => {
            expect(content).toContain('<meta name="twitter:title"');
        });

        it('should use fullTitle for twitter:title', () => {
            expect(content).toContain('name="twitter:title"');
            expect(content).toContain('content={fullTitle}');
        });

        it('should render twitter:description meta tag', () => {
            expect(content).toContain('<meta name="twitter:description"');
        });

        it('should use description for twitter:description', () => {
            expect(content).toContain('name="twitter:description"');
            expect(content).toContain('content={description}');
        });

        it('should conditionally render twitter:image when image is provided', () => {
            expect(content).toContain('{image &&');
            expect(content).toContain('<meta name="twitter:image"');
        });

        it('should use image prop for twitter:image', () => {
            expect(content).toContain('name="twitter:image"');
            expect(content).toContain('content={image}');
        });
    });

    describe('Hreflang tags', () => {
        it('should render hreflang link for Spanish', () => {
            expect(content).toContain('<link rel="alternate" hreflang="es"');
        });

        it('should use esUrl for Spanish hreflang', () => {
            expect(content).toContain('hreflang="es"');
            expect(content).toContain('href={esUrl}');
        });

        it('should render hreflang link for English', () => {
            expect(content).toContain('<link rel="alternate" hreflang="en"');
        });

        it('should use enUrl for English hreflang', () => {
            expect(content).toContain('hreflang="en"');
            expect(content).toContain('href={enUrl}');
        });

        it('should render x-default hreflang link', () => {
            expect(content).toContain('<link rel="alternate" hreflang="x-default"');
        });

        it('should use esUrl for x-default hreflang', () => {
            expect(content).toContain('hreflang="x-default"');
            expect(content).toContain('href={esUrl}');
        });

        it('should render hreflang link for Portuguese', () => {
            expect(content).toContain('<link rel="alternate" hreflang="pt"');
        });

        it('should use ptUrl for Portuguese hreflang', () => {
            expect(content).toContain('hreflang="pt"');
            expect(content).toContain('href={ptUrl}');
        });

        it('should have generateAlternateUrl function', () => {
            expect(content).toContain('generateAlternateUrl');
        });

        it('should generate alternate URLs for all three locales', () => {
            expect(content).toContain("generateAlternateUrl('es')");
            expect(content).toContain("generateAlternateUrl('en')");
            expect(content).toContain("generateAlternateUrl('pt')");
        });
    });

    describe('Locale mapping', () => {
        it('should map es locale to es_AR for Open Graph', () => {
            expect(content).toContain("locale === 'es' ? 'es_AR'");
        });

        it('should map pt locale to pt_BR for Open Graph', () => {
            expect(content).toContain("'pt_BR'");
        });

        it('should map en locale to en_US for Open Graph', () => {
            expect(content).toContain("'en_US'");
        });

        it('should define ogLocale variable', () => {
            expect(content).toContain('ogLocale');
        });
    });

    describe('JSDoc documentation', () => {
        it('should have JSDoc for Props interface', () => {
            expect(content).toContain('/**');
            expect(content).toContain('Props interface');
        });

        it('should document all props with JSDoc', () => {
            expect(content).toContain('Page title');
            expect(content).toContain('Meta description');
            expect(content).toContain('Canonical URL');
            expect(content).toContain('Open Graph');
            expect(content).toContain('noindex');
            expect(content).toContain('locale');
            expect(content).toContain('@default');
        });

        it('should have component-level JSDoc with example', () => {
            expect(content).toContain('@example');
        });
    });

    describe('TypeScript types', () => {
        it('should export Props interface', () => {
            expect(content).toContain('export interface Props');
        });

        it('should use SupportedLocale type for locale', () => {
            expect(content).toContain('SupportedLocale');
        });

        it('should use strict type for Open Graph type', () => {
            expect(content).toContain("'website' | 'article'");
        });
    });
});
