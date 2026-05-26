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

describe('SEOHead.astro — OG card props (redesign)', () => {
    it('accepts the new OG-card props (ogType/ogImage/ogSubtitle/ogRating/ogTagline)', () => {
        for (const prop of ['ogType', 'ogImage', 'ogSubtitle', 'ogRating', 'ogTagline']) {
            expect(src).toContain(`${prop}?:`);
            expect(src).toContain(prop);
        }
    });

    it('assembles the generated OG URL via the shared buildOgImagePath helper', () => {
        expect(src).toMatch(
            /import\s*\{[^}]*\bbuildOgImagePath\b[^}]*\}\s*from\s*'@\/lib\/og-template'/
        );
        expect(src).toContain('buildOgImagePath({');
    });

    it('keeps the explicit `image` prop as the precedence override (backward compat)', () => {
        // An explicit final image URL still wins over the generated card URL.
        expect(src).toMatch(/new URL\(\s*image\s*\?\?\s*generatedOgPath/);
    });

    it('forwards the OG-card props into buildOgImagePath', () => {
        for (const field of [
            'type: ogType',
            'image: ogImage',
            'subtitle: ogSubtitle',
            'rating: ogRating',
            'tagline: ogTagline'
        ]) {
            expect(src).toContain(field);
        }
    });
});

describe('SEOHead.astro — og:type article metadata', () => {
    it('declares the article:published_time/modified_time props', () => {
        expect(src).toContain('articlePublishedTime?:');
        expect(src).toContain('articleModifiedTime?:');
    });

    it('emits article:published_time guarded by type === article', () => {
        // The temporal meta is only valid on article pages; a website must not
        // emit it. The guard keeps the tags off non-article pages.
        expect(src).toMatch(/type === 'article'[\s\S]*?article:published_time/);
    });

    it('emits article:modified_time guarded by type === article', () => {
        expect(src).toMatch(/type === 'article'[\s\S]*?article:modified_time/);
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
