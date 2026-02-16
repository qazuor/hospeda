/**
 * SEO Validation Test Suite
 *
 * Validates SEO best practices across all key pages and components.
 * Tests read page source files and SEO component source files to verify correct implementation.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const srcDir = resolve(__dirname, '../../src');
const publicDir = resolve(__dirname, '../../public');
const rootDir = resolve(__dirname, '../..');

/**
 * Helper to read page file
 */
function readPage(relativePath: string): string {
    return readFileSync(resolve(srcDir, relativePath), 'utf8');
}

/**
 * Helper to read component file
 */
function readComponent(relativePath: string): string {
    return readFileSync(resolve(srcDir, relativePath), 'utf8');
}

/**
 * Helper to read public file
 */
function readPublicFile(relativePath: string): string {
    return readFileSync(resolve(publicDir, relativePath), 'utf8');
}

/**
 * Helper to read root config file
 */
function readRootConfig(relativePath: string): string {
    return readFileSync(resolve(rootDir, relativePath), 'utf8');
}

describe('SEO Component Validation', () => {
    describe('SEOHead Component', () => {
        let seoHeadContent: string;

        beforeAll(() => {
            seoHeadContent = readComponent('components/seo/SEOHead.astro');
        });

        it('should have title tag', () => {
            expect(seoHeadContent).toContain('<title>');
            expect(seoHeadContent).toContain('{fullTitle}');
        });

        it('should have meta description tag', () => {
            expect(seoHeadContent).toContain('<meta name="description"');
            expect(seoHeadContent).toContain('content={description}');
        });

        it('should have canonical link tag', () => {
            expect(seoHeadContent).toContain('<link rel="canonical"');
            expect(seoHeadContent).toContain('href={canonical}');
        });

        it('should have robots meta tag support', () => {
            expect(seoHeadContent).toContain('<meta name="robots"');
            expect(seoHeadContent).toContain('content="noindex,nofollow"');
            expect(seoHeadContent).toContain('{noindex &&');
        });

        describe('Open Graph tags', () => {
            it('should have og:type', () => {
                expect(seoHeadContent).toContain('<meta property="og:type"');
                expect(seoHeadContent).toContain('content={type}');
            });

            it('should have og:url', () => {
                expect(seoHeadContent).toContain('<meta property="og:url"');
                expect(seoHeadContent).toContain('content={canonical}');
            });

            it('should have og:title', () => {
                expect(seoHeadContent).toContain('<meta property="og:title"');
                expect(seoHeadContent).toContain('content={fullTitle}');
            });

            it('should have og:description', () => {
                expect(seoHeadContent).toContain('<meta property="og:description"');
                expect(seoHeadContent).toContain('content={description}');
            });

            it('should have og:locale', () => {
                expect(seoHeadContent).toContain('<meta property="og:locale"');
                expect(seoHeadContent).toContain('content={ogLocale}');
            });

            it('should have og:site_name', () => {
                expect(seoHeadContent).toContain('<meta property="og:site_name"');
                expect(seoHeadContent).toContain('content="Hospeda"');
            });

            it('should support custom og:image', () => {
                expect(seoHeadContent).toContain('<meta property="og:image"');
                expect(seoHeadContent).toContain('{image &&');
            });
        });

        describe('Twitter Card tags', () => {
            it('should have twitter:card', () => {
                expect(seoHeadContent).toContain('<meta name="twitter:card"');
                expect(seoHeadContent).toContain('content="summary_large_image"');
            });

            it('should have twitter:title', () => {
                expect(seoHeadContent).toContain('<meta name="twitter:title"');
                expect(seoHeadContent).toContain('content={fullTitle}');
            });

            it('should have twitter:description', () => {
                expect(seoHeadContent).toContain('<meta name="twitter:description"');
                expect(seoHeadContent).toContain('content={description}');
            });

            it('should support custom twitter:image', () => {
                expect(seoHeadContent).toContain('<meta name="twitter:image"');
                expect(seoHeadContent).toContain('{image &&');
            });
        });

        describe('Hreflang tags', () => {
            it('should have hreflang for Spanish', () => {
                expect(seoHeadContent).toContain('<link rel="alternate" hreflang="es"');
            });

            it('should have hreflang for English', () => {
                expect(seoHeadContent).toContain('<link rel="alternate" hreflang="en"');
            });

            it('should have hreflang x-default', () => {
                expect(seoHeadContent).toContain('<link rel="alternate" hreflang="x-default"');
            });
        });

        describe('Props interface', () => {
            it('should accept title prop', () => {
                expect(seoHeadContent).toContain('title: string');
            });

            it('should accept description prop', () => {
                expect(seoHeadContent).toContain('description: string');
            });

            it('should accept canonical prop', () => {
                expect(seoHeadContent).toContain('canonical: string');
            });

            it('should accept optional image prop', () => {
                expect(seoHeadContent).toContain('image?: string');
            });

            it('should accept optional noindex prop', () => {
                expect(seoHeadContent).toContain('noindex?: boolean');
            });

            it('should accept locale prop with type checking', () => {
                expect(seoHeadContent).toContain("locale?: 'es' | 'en'");
            });

            it('should accept type prop for OG type', () => {
                expect(seoHeadContent).toContain("type?: 'website' | 'article'");
            });
        });
    });

    describe('JsonLd Component', () => {
        let jsonLdContent: string;

        beforeAll(() => {
            jsonLdContent = readComponent('components/seo/JsonLd.astro');
        });

        it('should have script tag with application/ld+json type', () => {
            expect(jsonLdContent).toContain('<script type="application/ld+json"');
        });

        it('should serialize data as JSON', () => {
            expect(jsonLdContent).toContain('JSON.stringify');
        });

        it('should accept data prop', () => {
            expect(jsonLdContent).toContain('data: Record<string, unknown>');
        });
    });

    describe('LodgingBusinessJsonLd Component', () => {
        let lodgingContent: string;

        beforeAll(() => {
            lodgingContent = readComponent('components/seo/LodgingBusinessJsonLd.astro');
        });

        it('should have @type LodgingBusiness', () => {
            expect(lodgingContent).toContain("'@type': 'LodgingBusiness'");
        });

        it('should have required name property', () => {
            expect(lodgingContent).toContain('name: string');
            expect(lodgingContent).toContain('name,');
        });

        it('should have required description property', () => {
            expect(lodgingContent).toContain('description: string');
            expect(lodgingContent).toContain('description,');
        });

        it('should have required url property', () => {
            expect(lodgingContent).toContain('url: string');
            expect(lodgingContent).toContain('url,');
        });

        it('should have optional image property', () => {
            expect(lodgingContent).toContain('image?: string');
        });

        it('should have address property with PostalAddress type', () => {
            expect(lodgingContent).toContain("'@type': 'PostalAddress'");
            expect(lodgingContent).toContain('streetAddress:');
            expect(lodgingContent).toContain('addressLocality:');
            expect(lodgingContent).toContain('addressRegion:');
            expect(lodgingContent).toContain('addressCountry:');
        });

        it('should support optional priceRange', () => {
            expect(lodgingContent).toContain('priceRange?: string');
        });

        it('should support optional starRating', () => {
            expect(lodgingContent).toContain('starRating?: number');
            expect(lodgingContent).toContain("'@type': 'Rating'");
        });

        it('should support optional amenities array', () => {
            expect(lodgingContent).toContain('amenities?: string[]');
            expect(lodgingContent).toContain('amenityFeature');
        });

        it('should use JsonLd component', () => {
            expect(lodgingContent).toContain("import JsonLd from './JsonLd.astro'");
            expect(lodgingContent).toContain('<JsonLd data={structuredData}');
        });
    });

    describe('EventJsonLd Component', () => {
        let eventContent: string;

        beforeAll(() => {
            eventContent = readComponent('components/seo/EventJsonLd.astro');
        });

        it('should have @type Event', () => {
            expect(eventContent).toContain("'@type': 'Event'");
        });

        it('should have required name property', () => {
            expect(eventContent).toContain('name: string');
            expect(eventContent).toContain('name,');
        });

        it('should have required description property', () => {
            expect(eventContent).toContain('description: string');
        });

        it('should have required startDate property', () => {
            expect(eventContent).toContain('startDate: string');
            expect(eventContent).toContain('startDate,');
        });

        it('should have optional endDate property', () => {
            expect(eventContent).toContain('endDate?: string');
        });

        it('should have location property with Place type', () => {
            expect(eventContent).toContain("'@type': 'Place'");
            expect(eventContent).toContain('location:');
        });

        it('should support optional organizer', () => {
            expect(eventContent).toContain('organizer?: string');
            expect(eventContent).toContain("'@type': 'Organization'");
        });

        it('should use JsonLd component', () => {
            expect(eventContent).toContain("import JsonLd from './JsonLd.astro'");
            expect(eventContent).toContain('<JsonLd data={structuredData}');
        });
    });

    describe('ArticleJsonLd Component', () => {
        let articleContent: string;

        beforeAll(() => {
            articleContent = readComponent('components/seo/ArticleJsonLd.astro');
        });

        it('should have @type Article', () => {
            expect(articleContent).toContain("'@type': 'Article'");
        });

        it('should have required headline property', () => {
            expect(articleContent).toContain('headline: string');
            expect(articleContent).toContain('headline,');
        });

        it('should have required datePublished property', () => {
            expect(articleContent).toContain('datePublished: string');
            expect(articleContent).toContain('datePublished,');
        });

        it('should have optional dateModified property', () => {
            expect(articleContent).toContain('dateModified?: string');
        });

        it('should have author with Person type', () => {
            expect(articleContent).toContain('author: ArticleAuthor');
            expect(articleContent).toContain("'@type': 'Person'");
        });

        it('should have publisher with Organization type', () => {
            expect(articleContent).toContain("'@type': 'Organization'");
            expect(articleContent).toContain("name: 'Hospeda'");
        });

        it('should have optional image property', () => {
            expect(articleContent).toContain('image?: string');
        });

        it('should use JsonLd component', () => {
            expect(articleContent).toContain("import JsonLd from './JsonLd.astro'");
            expect(articleContent).toContain('<JsonLd data={structuredData}');
        });
    });
});

describe('Page-Level SEO Checks', () => {
    describe('Homepage', () => {
        let homepageContent: string;

        beforeAll(() => {
            homepageContent = readPage('pages/[lang]/index.astro');
        });

        it('should import BaseLayout', () => {
            expect(homepageContent).toContain(
                "import BaseLayout from '../../layouts/BaseLayout.astro'"
            );
        });

        it('should use BaseLayout with title prop', () => {
            expect(homepageContent).toContain('<BaseLayout');
            expect(homepageContent).toContain('title={t.pageTitle}');
        });

        it('should use BaseLayout with description prop', () => {
            expect(homepageContent).toContain('description={t.pageDescription}');
        });

        it('should use BaseLayout with locale prop', () => {
            expect(homepageContent).toContain('locale={locale}');
        });

        it('should have localized title', () => {
            expect(homepageContent).toContain('pageTitle:');
        });

        it('should have localized description', () => {
            expect(homepageContent).toContain('pageDescription:');
        });
    });

    describe('Accommodation Detail Page', () => {
        let accommodationContent: string;

        beforeAll(() => {
            accommodationContent = readPage('pages/[lang]/alojamientos/[slug].astro');
        });

        it('should import SEOHead', () => {
            expect(accommodationContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
        });

        it('should import LodgingBusinessJsonLd', () => {
            expect(accommodationContent).toContain(
                "import LodgingBusinessJsonLd from '../../../components/seo/LodgingBusinessJsonLd.astro'"
            );
        });

        it('should use SEOHead component', () => {
            expect(accommodationContent).toContain('<SEOHead');
            expect(accommodationContent).toContain('slot="head"');
        });

        it('should use LodgingBusinessJsonLd component', () => {
            expect(accommodationContent).toContain('<LodgingBusinessJsonLd');
        });

        it('should pass dynamic title to SEOHead', () => {
            expect(accommodationContent).toContain('title={(accommodation as any).name}');
        });

        it('should pass dynamic description to SEOHead', () => {
            expect(accommodationContent).toContain('description={');
        });

        it('should pass locale to SEOHead', () => {
            expect(accommodationContent).toContain('locale={locale}');
        });

        it('should pass image to SEOHead', () => {
            expect(accommodationContent).toContain('image={(accommodation as any).images');
        });
    });

    describe('Blog Post Detail Page', () => {
        let blogPostContent: string;

        beforeAll(() => {
            blogPostContent = readPage('pages/[lang]/publicaciones/[slug].astro');
        });

        it('should import SEOHead', () => {
            expect(blogPostContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
        });

        it('should import ArticleJsonLd', () => {
            expect(blogPostContent).toContain(
                "import ArticleJsonLd from '../../../components/seo/ArticleJsonLd.astro'"
            );
        });

        it('should use SEOHead component', () => {
            expect(blogPostContent).toContain('<SEOHead');
            expect(blogPostContent).toContain('slot="head"');
        });

        it('should use ArticleJsonLd component', () => {
            expect(blogPostContent).toContain('<ArticleJsonLd');
        });

        it('should pass dynamic title from post', () => {
            expect(blogPostContent).toContain('title={(post as any).title}');
        });

        it('should set type to article', () => {
            expect(blogPostContent).toContain('type="article"');
        });
    });

    describe('Event Detail Page', () => {
        let eventContent: string;

        beforeAll(() => {
            eventContent = readPage('pages/[lang]/eventos/[slug].astro');
        });

        it('should import SEOHead', () => {
            expect(eventContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
        });

        it('should import EventJsonLd', () => {
            expect(eventContent).toContain(
                "import EventJsonLd from '../../../components/seo/EventJsonLd.astro'"
            );
        });

        it('should use SEOHead component', () => {
            expect(eventContent).toContain('<SEOHead');
        });

        it('should use EventJsonLd component', () => {
            expect(eventContent).toContain('<EventJsonLd');
        });

        it('should pass dynamic title', () => {
            expect(eventContent).toContain('title={pageTitle}');
        });
    });

    describe('Destination Detail Page', () => {
        let destinationContent: string;

        beforeAll(() => {
            destinationContent = readPage('pages/[lang]/destinos/[...path].astro');
        });

        it('should import SEOHead', () => {
            expect(destinationContent).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
        });

        it('should use SEOHead component', () => {
            expect(destinationContent).toContain('<SEOHead');
        });

        it('should pass dynamic title from destination name', () => {
            expect(destinationContent).toContain('title={destinationName}');
        });

        it('should pass locale to SEOHead', () => {
            expect(destinationContent).toContain('locale={locale}');
        });

        it('should pass image to SEOHead', () => {
            expect(destinationContent).toContain('image={destinationHeroImage}');
        });
    });

    describe('Accommodation List Page', () => {
        let accommodationListContent: string;

        beforeAll(() => {
            accommodationListContent = readPage('pages/[lang]/alojamientos/[slug].astro');
        });

        it('should use BaseLayout or SEOHead', () => {
            const hasBaseLayout = accommodationListContent.includes('BaseLayout');
            const hasSEOHead = accommodationListContent.includes('SEOHead');
            expect(hasBaseLayout || hasSEOHead).toBe(true);
        });
    });

    describe('Event List Page', () => {
        let eventListContent: string;

        beforeAll(() => {
            eventListContent = readPage('pages/[lang]/eventos/index.astro');
        });

        it('should use BaseLayout', () => {
            expect(eventListContent).toContain('BaseLayout');
        });
    });
});

describe('Canonical URL Validation', () => {
    describe('SEOHead Component', () => {
        let seoHeadContent: string;

        beforeAll(() => {
            seoHeadContent = readComponent('components/seo/SEOHead.astro');
        });

        it('should generate canonical URL from canonical prop', () => {
            expect(seoHeadContent).toContain('canonical: string');
            expect(seoHeadContent).toContain('<link rel="canonical" href={canonical}');
        });

        it('should include locale in hreflang URLs', () => {
            expect(seoHeadContent).toContain('generateAlternateUrl');
            expect(seoHeadContent).toContain("targetLocale: 'es' | 'en'");
        });
    });

    describe('BaseLayout Component', () => {
        let baseLayoutContent: string;

        beforeAll(() => {
            baseLayoutContent = readComponent('layouts/BaseLayout.astro');
        });

        it('should have canonical URL generation', () => {
            expect(baseLayoutContent).toContain('canonicalUrl');
            expect(baseLayoutContent).toContain('Astro.url');
        });

        it('should use canonical URL in link tag', () => {
            expect(baseLayoutContent).toContain('<link rel="canonical"');
        });

        it('should use Astro.site for base URL', () => {
            expect(baseLayoutContent).toContain('Astro.site');
        });
    });
});

describe('robots.txt Validation', () => {
    let robotsTxtContent: string;

    beforeAll(() => {
        robotsTxtContent = readPublicFile('robots.txt');
    });

    it('should have User-agent directive', () => {
        expect(robotsTxtContent).toContain('User-agent:');
    });

    it('should have Sitemap directive', () => {
        expect(robotsTxtContent).toContain('Sitemap:');
    });

    it('should disallow auth pages', () => {
        expect(robotsTxtContent).toContain('Disallow:');
        expect(robotsTxtContent).toContain('/auth/');
    });

    it('should disallow account pages', () => {
        expect(robotsTxtContent).toContain('/mi-cuenta/');
    });
});

describe('Sitemap Configuration', () => {
    let astroConfigContent: string;

    beforeAll(() => {
        astroConfigContent = readRootConfig('astro.config.mjs');
    });

    it('should have sitemap integration', () => {
        expect(astroConfigContent).toContain("from '@astrojs/sitemap'");
        expect(astroConfigContent).toContain('sitemap(');
    });

    it('should filter auth and account pages', () => {
        expect(astroConfigContent).toContain('filter:');
        expect(astroConfigContent).toContain('/auth/');
        expect(astroConfigContent).toContain('/mi-cuenta/');
    });
});

describe('Viewport and Charset', () => {
    let baseLayoutContent: string;

    beforeAll(() => {
        baseLayoutContent = readComponent('layouts/BaseLayout.astro');
    });

    it('should have charset UTF-8', () => {
        expect(baseLayoutContent).toContain('<meta charset="UTF-8"');
    });

    it('should have viewport meta tag', () => {
        expect(baseLayoutContent).toContain('<meta name="viewport"');
        expect(baseLayoutContent).toContain('width=device-width');
    });

    it('should have lang attribute on html tag', () => {
        expect(baseLayoutContent).toContain('<html lang={locale}');
    });
});
