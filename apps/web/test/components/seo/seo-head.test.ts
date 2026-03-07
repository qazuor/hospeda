/**
 * @file seo-head.test.ts
 * @description Tests for SEOHead.astro component.
 * Validates canonical URL, Open Graph, Twitter Card, hreflang, and locale support.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../../src/components/seo/SEOHead.astro'), 'utf8');

describe('SEOHead.astro', () => {
    describe('Props interface', () => {
        it('should export a Props interface', () => {
            expect(src).toContain('export interface Props');
        });

        it('should have a required title prop', () => {
            expect(src).toContain('title:');
        });

        it('should have a required description prop', () => {
            expect(src).toContain('description:');
        });

        it('should have a canonical prop', () => {
            expect(src).toContain('canonical:');
        });

        it('should have an optional image prop', () => {
            expect(src).toContain('image?:');
        });

        it('should have an optional noindex prop', () => {
            expect(src).toContain('noindex?:');
        });

        it('should have an optional locale prop typed as SupportedLocale', () => {
            expect(src).toContain('locale?:');
            expect(src).toContain('SupportedLocale');
        });

        it('should have an optional type prop with website/article union', () => {
            expect(src).toContain("'website' | 'article'");
        });
    });

    describe('Title', () => {
        it('should append site name to title', () => {
            expect(src).toContain('| Hospeda');
        });

        it('should render a <title> element', () => {
            expect(src).toContain('<title>');
        });
    });

    describe('Meta description', () => {
        it('should render a meta description tag', () => {
            expect(src).toContain('name="description"');
        });
    });

    describe('Canonical URL', () => {
        it('should render a canonical link element', () => {
            expect(src).toContain('rel="canonical"');
        });

        it('should bind href to the canonical prop', () => {
            expect(src).toContain('href={canonical}');
        });
    });

    describe('Robots', () => {
        it('should conditionally render noindex meta tag', () => {
            expect(src).toContain('noindex');
            expect(src).toContain('noindex,nofollow');
        });
    });

    describe('Open Graph', () => {
        it('should render og:title meta tag', () => {
            expect(src).toContain('property="og:title"');
        });

        it('should render og:description meta tag', () => {
            expect(src).toContain('property="og:description"');
        });

        it('should render og:url meta tag', () => {
            expect(src).toContain('property="og:url"');
        });

        it('should render og:type meta tag', () => {
            expect(src).toContain('property="og:type"');
        });

        it('should render og:locale meta tag', () => {
            expect(src).toContain('property="og:locale"');
        });

        it('should render og:site_name meta tag', () => {
            expect(src).toContain('property="og:site_name"');
            expect(src).toContain('Hospeda');
        });

        it('should conditionally render og:image meta tag', () => {
            expect(src).toContain('property="og:image"');
        });
    });

    describe('Twitter Card', () => {
        it('should render twitter:card meta tag', () => {
            expect(src).toContain('name="twitter:card"');
        });

        it('should use summary_large_image card type', () => {
            expect(src).toContain('summary_large_image');
        });

        it('should render twitter:title meta tag', () => {
            expect(src).toContain('name="twitter:title"');
        });

        it('should render twitter:description meta tag', () => {
            expect(src).toContain('name="twitter:description"');
        });

        it('should conditionally render twitter:image meta tag', () => {
            expect(src).toContain('name="twitter:image"');
        });
    });

    describe('Hreflang alternate links', () => {
        it('should render Spanish hreflang link', () => {
            expect(src).toContain('hreflang="es"');
        });

        it('should render English hreflang link', () => {
            expect(src).toContain('hreflang="en"');
        });

        it('should render Portuguese hreflang link', () => {
            expect(src).toContain('hreflang="pt"');
        });

        it('should render x-default hreflang link', () => {
            expect(src).toContain('hreflang="x-default"');
        });

        it('should generate alternate URLs from the canonical URL', () => {
            expect(src).toContain('generateAlternateUrl');
        });
    });

    describe('Locale mapping', () => {
        it('should map es locale to es_AR for Open Graph', () => {
            expect(src).toContain('es_AR');
        });

        it('should map pt locale to pt_BR for Open Graph', () => {
            expect(src).toContain('pt_BR');
        });

        it('should map en locale to en_US for Open Graph', () => {
            expect(src).toContain('en_US');
        });
    });
});
