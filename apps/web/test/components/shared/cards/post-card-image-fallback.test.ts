/**
 * @file post-card-image-fallback.test.ts
 * @description Guards the "real cover, else category icon" contract shared by
 * every blog card surface (home, listings, related-post carousels).
 *
 * Two things can silently break it, and both did before this suite existed:
 *
 * 1. A card renders an emoji (or nothing) instead of the `@repo/icons`
 *    category icon the event cards use.
 * 2. A card treats the API transform's `placeholder-*.svg` sentinel as a real
 *    photo, so a grey placeholder box covers the icon.
 *
 * These are source-reading assertions because `.astro` components cannot be
 * rendered through Vitest.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const COMPONENT_DIR = resolve(__dirname, '../../../../src/components/shared/cards');

/** The blog card components that own a cover-image slot. */
const POST_CARDS = [
    { name: 'ArticleCard.astro', path: resolve(COMPONENT_DIR, 'ArticleCard.astro') },
    {
        name: 'FeaturedArticleCard.astro',
        path: resolve(COMPONENT_DIR, 'FeaturedArticleCard.astro')
    },
    { name: 'RelatedPostCard.astro', path: resolve(COMPONENT_DIR, 'RelatedPostCard.astro') }
] as const;

/** `CardImage.astro` owns the decision on ArticleCard's behalf. */
const CARD_IMAGE_SRC = readFileSync(resolve(COMPONENT_DIR, 'CardImage.astro'), 'utf8');

describe.each(POST_CARDS)('$name', ({ path }) => {
    const src = readFileSync(path, 'utf8');

    it('resolves its placeholder art through the shared post-category icon map', () => {
        expect(src).toContain('getPostCategoryIconComponent');
        expect(src).toMatch(/<CategoryIcon[\s\S]*?weight="duotone"/);
    });

    it('no longer renders an emoji placeholder', () => {
        expect(src).not.toContain('getPostCategoryEmoji');
        expect(src).not.toContain('placeholder-emoji');
    });
});

describe('placeholder-*.svg is never treated as a real cover', () => {
    it('CardImage.astro discounts a placeholder src (covers ArticleCard)', () => {
        expect(CARD_IMAGE_SRC).toMatch(
            /hasImage\s*=\s*Boolean\(src\)\s*&&\s*!src\.includes\('placeholder'\)/
        );
    });

    it('FeaturedArticleCard.astro discounts a placeholder src', () => {
        const src = readFileSync(resolve(COMPONENT_DIR, 'FeaturedArticleCard.astro'), 'utf8');
        expect(src).toMatch(
            /hasImage[\s\S]{0,160}?!data\.featuredImage\?\.url\?\.includes\('placeholder'\)/
        );
    });

    it('RelatedPostCard.astro discounts a placeholder src', () => {
        const src = readFileSync(resolve(COMPONENT_DIR, 'RelatedPostCard.astro'), 'utf8');
        expect(src).toMatch(/hasImage[\s\S]{0,120}?!featuredImage\?\.includes\('placeholder'\)/);
        // The <img> must be gated on the computed flag, not on raw truthiness.
        expect(src).toContain('{hasImage ? (');
    });
});

describe('RelatedPostCard receives the category from every call site', () => {
    const CALL_SITES = [
        resolve(__dirname, '../../../../src/pages/[lang]/publicaciones/[slug].astro'),
        resolve(__dirname, '../../../../src/pages/[lang]/alojamientos/[slug].astro'),
        resolve(__dirname, '../../../../src/components/destination/DestinationRelatedPosts.astro')
    ];

    it.each(CALL_SITES)('%s passes a category prop', (callSite) => {
        const src = readFileSync(callSite, 'utf8');
        const start = src.indexOf('<RelatedPostCard');
        expect(start).toBeGreaterThan(-1);
        const usage = src.slice(start, src.indexOf('/>', start));
        expect(usage).toContain('category=');
    });
});
