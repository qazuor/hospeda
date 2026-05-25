/**
 * @file SEOHead.test.ts
 * @description Source-level tests for SEOHead.astro (Astro components cannot be
 * rendered in Vitest, so we assert on the component source — the project's
 * documented approach for .astro coverage).
 *
 * SPEC-157 REQ-8: og:image must be coerced to an absolute URL (relative paths
 * are ignored by social scrapers), and the image dimension + alt meta tags
 * (og:image:width/height/alt, twitter:image:alt) must be present.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/components/seo/SEOHead.astro'), 'utf8');

describe('SEOHead.astro (SPEC-157 REQ-8)', () => {
    it('coerces the image prop to an absolute URL with new URL(image, base)', () => {
        // The og:image value must be absolute even when a page passes a relative
        // path; new URL(image, siteBase) resolves both relative and absolute.
        expect(src).toMatch(/new URL\(\s*image/);
    });

    it('emits og:image:width and og:image:height meta tags', () => {
        expect(src).toContain('og:image:width');
        expect(src).toContain('og:image:height');
    });

    it('emits og:image:alt meta tag', () => {
        expect(src).toContain('og:image:alt');
    });

    it('emits twitter:image:alt meta tag', () => {
        expect(src).toContain('twitter:image:alt');
    });
});

describe('SEOHead.astro — og:locale:alternate + twitter:site', () => {
    it('emits og:locale:alternate for the non-current locales', () => {
        // hreflang covers Google; og:locale:alternate tells OG consumers
        // (Facebook etc.) the page has translations.
        expect(src).toContain('og:locale:alternate');
    });

    it('emits twitter:site referencing the brand handle constant', () => {
        expect(src).toContain('twitter:site');
        expect(src).toMatch(/import\s*\{[^}]*\bTWITTER_SITE_HANDLE\b[^}]*\}/);
        expect(src).toContain('{TWITTER_SITE_HANDLE}');
    });
});

describe('SEOHead.astro — robots directive', () => {
    it('emits noindex,follow (not nofollow) so crawlers still follow links on noindexed pages', () => {
        // noindex,follow is the modern standard: the page itself stays out of
        // the index but link equity flows through to linked detail pages
        // (e.g. faceted listing pages link to indexable detail pages).
        expect(src).toContain('content="noindex,follow"');
        expect(src).not.toContain('content="noindex,nofollow"');
    });
});
